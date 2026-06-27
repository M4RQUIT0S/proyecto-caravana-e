-- ============================================================================
-- Esquema Supabase — Caravanas Electrónicas (Trazabilidad Ganadera)
-- Patrón: columnas clave (para RLS/queries) + columna `data jsonb` con el objeto
-- completo del modelo. Preserva los ids generados en el cliente y minimiza el mapeo.
-- Seguridad: RLS por membresía de campo (array de uuids en `campos`).
-- Ejecutar TODO el archivo en el SQL Editor de Supabase.
-- ============================================================================

-- ---------- schema privado para helpers internos ----------
-- Las funciones SECURITY DEFINER usadas SÓLO por RLS/triggers viven acá, fuera del
-- schema `public` que expone PostgREST. Así NO son llamables vía /rest/v1/rpc y se
-- resuelven los lints 0028/0029 ("SECURITY DEFINER ejecutable por anon/authenticated"),
-- sin perder la RLS: el rol que consulta necesita poder ejecutarlas, por eso se le da
-- USAGE sobre el schema (no lo expone; sólo permite que la policy las invoque).
create schema if not exists private;
grant usage on schema private to anon, authenticated;

-- ---------- profiles (espejo de auth.users con username) ----------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text unique not null,
  email text,
  created_at timestamptz not null default now()
);

create or replace function private.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  base_username text;
  try_username text;
  n int := 0;
begin
  -- username del metadata (registro propio) o derivado del email (Google/Apple).
  base_username := coalesce(
    nullif(trim(new.raw_user_meta_data ->> 'username'), ''),
    nullif(split_part(new.email, '@', 1), ''),
    'usuario'
  );
  try_username := base_username;
  -- profiles.username es UNIQUE: si choca (típico en OAuth por el local-part del mail),
  -- agregamos un sufijo numérico para no abortar la creación del usuario de auth.
  while exists (select 1 from public.profiles where lower(username) = lower(try_username)) loop
    n := n + 1;
    try_username := base_username || n::text;
  end loop;
  insert into public.profiles (id, username, email)
  values (new.id, try_username, new.email)
  on conflict (id) do nothing;
  return new;
end; $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users for each row execute function private.handle_new_user();

-- ---------- campos (establecimientos). miembros_uuids = espejo para RLS ----------
create table if not exists public.campos (
  id text primary key,
  owner_id uuid not null references auth.users (id) on delete cascade,
  codigo text unique not null,
  miembros_uuids uuid[] not null default '{}',
  data jsonb not null,
  updated_at timestamptz not null default now()
);
create index if not exists campos_miembros_idx on public.campos using gin (miembros_uuids);

-- ---------- helpers de autorización (SECURITY DEFINER: evitan recursión RLS) ----------
-- En schema `private` (no expuesto por la API). Las policies los invocan como private.*
create or replace function private.is_campo_member(cid text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.campos c
    where c.id = cid and (c.owner_id = auth.uid() or auth.uid() = any (c.miembros_uuids))
  );
$$;

create or replace function private.can_write_campo(cid text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.campos c where c.id = cid and c.owner_id = auth.uid())
  or exists (
    select 1
    from public.campos c, jsonb_array_elements(coalesce(c.data -> 'miembros', '[]'::jsonb)) m
    where c.id = cid
      and (m ->> 'userId')::uuid = auth.uid()
      and coalesce(m ->> 'rol', 'vista') <> 'vista'
      and coalesce((m ->> 'activo')::boolean, true) = true
  );
$$;

-- La RLS evalúa estos helpers como el rol que consulta → necesita EXECUTE.
grant execute on function private.is_campo_member(text) to anon, authenticated;
grant execute on function private.can_write_campo(text) to anon, authenticated;

-- ---------- tablas de datos (id text, campo_id text, data jsonb) ----------
do $$ declare t text; begin
  foreach t in array array[
    'lotes','animales','catalogos','productos','proveedores',
    'lecturas','eventos','documentos','sincronizaciones','costos'
  ] loop
    execute format($f$
      create table if not exists public.%I (
        id text primary key,
        campo_id text not null references public.campos (id) on delete cascade,
        data jsonb not null,
        updated_at timestamptz not null default now()
      );
      create index if not exists %I on public.%I (campo_id);
    $f$, t, t || '_campo_idx', t);
  end loop;
end $$;

-- ---------- invitaciones ----------
create table if not exists public.invitaciones (
  id text primary key,
  campo_id text not null references public.campos (id) on delete cascade,
  email text not null,
  data jsonb not null
);
create index if not exists invitaciones_email_idx on public.invitaciones (lower(email));

-- ============================================================================
-- RLS
-- ============================================================================
alter table public.profiles enable row level security;
alter table public.campos enable row level security;
alter table public.invitaciones enable row level security;

-- profiles SELECT: cada quien ve su propio perfil y el de los co-miembros de sus
-- campos (para mostrar nombres). NO se expone la tabla entera (evita el dump masivo
-- de emails/usernames a cualquier usuario o anónimo). La disponibilidad de username
-- en el registro se resuelve con la RPC `username_disponible` (booleana).
drop policy if exists profiles_sel on public.profiles;
create policy profiles_sel on public.profiles for select using (
  id = auth.uid()
  or exists (
    select 1 from public.campos c
    where (c.owner_id = auth.uid() or auth.uid() = any (c.miembros_uuids))
      and (profiles.id = c.owner_id or profiles.id = any (c.miembros_uuids))
  )
);
drop policy if exists profiles_ins on public.profiles;
create policy profiles_ins on public.profiles for insert with check (id = auth.uid());
drop policy if exists profiles_upd on public.profiles;
create policy profiles_upd on public.profiles for update using (id = auth.uid());

drop policy if exists campos_sel on public.campos;
create policy campos_sel on public.campos for select using (private.is_campo_member(id));
drop policy if exists campos_ins on public.campos;
create policy campos_ins on public.campos for insert with check (owner_id = auth.uid());
drop policy if exists campos_upd on public.campos;
create policy campos_upd on public.campos for update using (private.can_write_campo(id)) with check (private.can_write_campo(id));
drop policy if exists campos_del on public.campos;
create policy campos_del on public.campos for delete using (owner_id = auth.uid());

-- invitaciones: las ve el campo o el invitado (por su email); el invitado puede marcar la suya
drop policy if exists inv_sel on public.invitaciones;
create policy inv_sel on public.invitaciones for select using (
  private.is_campo_member(campo_id) or lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
);
drop policy if exists inv_ins on public.invitaciones;
create policy inv_ins on public.invitaciones for insert with check (private.can_write_campo(campo_id));
drop policy if exists inv_upd on public.invitaciones;
create policy inv_upd on public.invitaciones for update using (
  private.can_write_campo(campo_id) or lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
);
drop policy if exists inv_del on public.invitaciones;
create policy inv_del on public.invitaciones for delete using (
  private.can_write_campo(campo_id) or lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
);

-- tablas de datos: SELECT si sos miembro; escribir si tenés permiso (rol <> vista)
do $$ declare t text; begin
  foreach t in array array[
    'lotes','animales','catalogos','productos','proveedores',
    'lecturas','eventos','documentos','sincronizaciones','costos'
  ] loop
    execute format('alter table public.%I enable row level security;', t);
    execute format('drop policy if exists %I on public.%I;', t || '_sel', t);
    execute format('create policy %I on public.%I for select using (private.is_campo_member(campo_id));', t || '_sel', t);
    execute format('drop policy if exists %I on public.%I;', t || '_mod', t);
    execute format('create policy %I on public.%I for all using (private.can_write_campo(campo_id)) with check (private.can_write_campo(campo_id));', t || '_mod', t);
  end loop;
end $$;

-- ============================================================================
-- RPCs (operaciones que cruzan la frontera de RLS de forma controlada)
-- ============================================================================

create or replace function public.email_for_username(p_username text)
returns text language sql stable security definer set search_path = public as $$
  select email from public.profiles where lower(username) = lower(p_username) limit 1;
$$;

-- Disponibilidad de username para el registro. Devuelve SÓLO un booleano: a diferencia
-- de un SELECT directo sobre profiles, no permite enumerar ni leer emails.
create or replace function public.username_disponible(p_username text)
returns boolean language sql stable security definer set search_path = public as $$
  select not exists (
    select 1 from public.profiles where lower(username) = lower(trim(p_username))
  );
$$;

-- Unirse a un campo con su código (el invitado todavía no puede leer el campo por RLS).
create or replace function public.unirme_con_codigo(p_codigo text)
returns text language plpgsql security definer set search_path = public as $$
declare v public.campos; v_now bigint := (extract(epoch from now()) * 1000)::bigint;
begin
  select * into v from public.campos where codigo = upper(p_codigo) limit 1;
  if v.id is null then return 'NO_ENCONTRADO'; end if;
  if v.owner_id = auth.uid() then return 'YA_OWNER'; end if;
  if auth.uid() = any (v.miembros_uuids) then return 'YA_MIEMBRO'; end if;
  -- Flujo confiable: habilita el cambio de membresía pese a la guardia anti-escalada.
  perform set_config('app.campos_guard_bypass', 'on', true);
  update public.campos set
    miembros_uuids = array_append(miembros_uuids, auth.uid()),
    data = jsonb_set(data, '{miembros}',
      coalesce(data -> 'miembros', '[]'::jsonb) ||
      jsonb_build_object('userId', auth.uid()::text, 'rol', 'vista', 'addedAt', v_now)),
    updated_at = now()
  where id = v.id;
  return v.id;
end; $$;

-- Aceptar una invitación dirigida a mi email.
create or replace function public.aceptar_invitacion(p_inv_id text)
returns text language plpgsql security definer set search_path = public as $$
declare v_inv public.invitaciones; v_rol text; v_now bigint := (extract(epoch from now()) * 1000)::bigint;
begin
  select * into v_inv from public.invitaciones where id = p_inv_id limit 1;
  if v_inv.id is null then return 'NO_ENCONTRADO'; end if;
  if lower(v_inv.email) <> lower(coalesce(auth.jwt() ->> 'email', '')) then return 'NO_AUTORIZADO'; end if;
  v_rol := coalesce(v_inv.data ->> 'rol', 'vista');
  -- Flujo confiable: habilita el cambio de membresía pese a la guardia anti-escalada.
  perform set_config('app.campos_guard_bypass', 'on', true);
  update public.campos set
    miembros_uuids = case when auth.uid() = any (miembros_uuids) then miembros_uuids
                          else array_append(miembros_uuids, auth.uid()) end,
    data = jsonb_set(data, '{miembros}',
      coalesce(data -> 'miembros', '[]'::jsonb) ||
      jsonb_build_object('userId', auth.uid()::text, 'rol', v_rol, 'addedAt', v_now)),
    updated_at = now()
  where id = v_inv.campo_id and not (auth.uid() = any (miembros_uuids));
  update public.invitaciones set data = jsonb_set(data, '{estado}', '"aceptada"') where id = p_inv_id;
  return v_inv.campo_id;
end; $$;

-- email_for_username es intencionalmente anónima (login por username → resuelve el email).
-- unirme/aceptar son sólo para usuarios autenticados: se les quita anon y PUBLIC para que
-- no queden expuestas a anónimos por el grant por defecto de CREATE FUNCTION.
revoke execute on function public.email_for_username(text) from public;
revoke execute on function public.username_disponible(text) from public;
revoke execute on function public.unirme_con_codigo(text) from public, anon;
revoke execute on function public.aceptar_invitacion(text) from public, anon;
grant execute on function public.email_for_username(text) to anon, authenticated;
grant execute on function public.username_disponible(text) to anon, authenticated;
grant execute on function public.unirme_con_codigo(text) to authenticated;
grant execute on function public.aceptar_invitacion(text) to authenticated;

-- Limpieza: `public.rls_auto_enable()` es una función huérfana (no la define este
-- esquema ni la usa la app) que quedó en la base como SECURITY DEFINER ejecutable por
-- anon/authenticated → la marcaban los lints 0028/0029. Se elimina; el `if exists`
-- hace el statement idempotente para bases donde nunca existió.
drop function if exists public.rls_auto_enable();

-- ============================================================================
-- Endurecimiento RLS por rol (permisos granulares del Operador delegado)
-- ============================================================================
-- Devuelve si el usuario actual puede ejecutar `accion` en el campo `cid`.
-- owner/admin/usuario: roles operativos plenos. operador: sólo sus permisos.
-- vista: nada.
-- Espejo EXACTO de `puede()` en src/lib/permisos.ts:
--   operador: niega {costos,reportes,senasa,documentacion,catalogos,admin}; el resto
--             según permisos granulares (capturar/sanidad/pesaje/movimiento); 'ver' siempre.
--   usuario : niega {admin,catalogos}; el resto sí.
--   admin/owner: todo. vista: nada.
create or replace function private.member_permite(cid text, accion text)
returns boolean language sql stable security definer set search_path = public as $$
  select
    exists (select 1 from public.campos c where c.id = cid and c.owner_id = auth.uid())
    or exists (
      select 1
      from public.campos c, jsonb_array_elements(coalesce(c.data -> 'miembros', '[]'::jsonb)) m
      where c.id = cid
        and (m ->> 'userId')::uuid = auth.uid()
        and coalesce((m ->> 'activo')::boolean, true) = true
        and case coalesce(m ->> 'rol', 'vista')
              when 'vista' then false
              when 'operador' then case
                  when accion in ('costos','reportes','senasa','documentacion','catalogos','admin') then false
                  when accion = 'ver' then true
                  else coalesce((m -> 'permisos' ->> accion)::boolean, false)
                end
              when 'usuario' then accion not in ('admin','catalogos')
              else true
            end
    );
$$;
grant execute on function private.member_permite(text, text) to anon, authenticated;

-- Tablas con escritura restringida por rol (no sólo rol<>vista). Se sustituye el
-- `_mod` genérico (can_write_campo) por member_permite con la acción correspondiente,
-- cerrando el escalado del Operador delegado vía API directa (RN21).
do $$
declare r record;
begin
  for r in (select * from (values
    ('costos','costos'),
    ('documentos','documentacion'),
    ('sincronizaciones','senasa'),
    ('catalogos','catalogos'),
    ('productos','catalogos'),
    ('proveedores','catalogos')
  ) as x(tabla, accion)) loop
    execute format('drop policy if exists %I on public.%I;', r.tabla || '_mod', r.tabla);
    execute format(
      'create policy %I on public.%I for all using (private.member_permite(campo_id, %L)) with check (private.member_permite(campo_id, %L));',
      r.tabla || '_mod', r.tabla, r.accion, r.accion);
  end loop;
end $$;

-- eventos: el INSERT exige el permiso correspondiente al tipo (para operadores).
drop policy if exists eventos_mod on public.eventos;
create policy eventos_mod on public.eventos for all
  using (private.can_write_campo(campo_id))
  with check (private.member_permite(
    campo_id,
    case data ->> 'tipo'
      when 'sanitario' then 'sanidad'
      when 'pesaje' then 'pesaje'
      when 'movimiento' then 'movimiento'
      else 'capturar'
    end
  ));

-- lecturas RFID: requieren permiso de captura.
drop policy if exists lecturas_mod on public.lecturas;
create policy lecturas_mod on public.lecturas for all
  using (private.can_write_campo(campo_id))
  with check (private.member_permite(campo_id, 'capturar'));

-- ============================================================================
-- Guardia anti-escalada de privilegios sobre `campos`
-- ============================================================================
-- La policy campos_upd permite escribir a cualquier miembro con rol <> vista, y el
-- rol/permisos de cada miembro viven dentro de `data->miembros`. Sin esta guardia, un
-- miembro `usuario`/`operador` podía: (a) auto-promoverse de rol o concederse permisos
-- reescribiendo `data->miembros`, o (b) robar el campo seteando `owner_id = auth.uid()`.
-- El trigger restringe owner_id, codigo y la membresía SÓLO al dueño actual; las RPCs
-- de unión (SECURITY DEFINER) activan un bypass local de transacción para sus updates.
create or replace function private.guard_campos_membership()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  -- Rol del que llama según el estado PREVIO (old): un usuario/operador no puede
  -- declararse admin en el mismo UPDATE para saltearse el control.
  caller_is_admin boolean := exists (
    select 1
    from jsonb_array_elements(coalesce(old.data -> 'miembros', '[]'::jsonb)) m
    where (m ->> 'userId')::uuid = auth.uid()
      and coalesce((m ->> 'activo')::boolean, true) = true
      and coalesce(m ->> 'rol', 'vista') = 'admin'
  );
begin
  -- Flujos confiables (unirme_con_codigo / aceptar_invitacion) marcan este GUC.
  if coalesce(current_setting('app.campos_guard_bypass', true), '') = 'on' then
    return new;
  end if;
  -- El dueño actual del campo puede cambiar cualquier cosa.
  if old.owner_id = auth.uid() then
    return new;
  end if;
  -- La transferencia de titularidad es SÓLO del dueño (ni siquiera un admin la hace).
  if new.owner_id is distinct from old.owner_id then
    raise exception 'No autorizado: sólo el dueño del campo puede transferir la titularidad';
  end if;
  -- Cambiar código o la lista de miembros requiere rol admin (o dueño). Esto cierra la
  -- escalada del usuario/operador que reescribía data->miembros para auto-promoverse.
  if not caller_is_admin then
    if new.codigo is distinct from old.codigo
       or new.miembros_uuids is distinct from old.miembros_uuids
       or coalesce(new.data -> 'miembros', '[]'::jsonb)
            is distinct from coalesce(old.data -> 'miembros', '[]'::jsonb)
    then
      raise exception 'No autorizado: modificar la membresía requiere rol de dueño o admin';
    end if;
  end if;
  return new;
end; $$;

drop trigger if exists campos_guard_membership on public.campos;
create trigger campos_guard_membership
  before update on public.campos for each row
  execute function private.guard_campos_membership();

-- ============================================================================
-- Validación de integridad del `data` jsonb (defensa en profundidad)
-- ============================================================================
-- La RLS controla QUIÉN escribe y EN QUÉ campo, pero no la FORMA del `data`. Un miembro
-- con permiso de escritura podría, vía PostgREST directo, saltearse las validaciones del
-- cliente (reglas.ts) e inyectar datos malformados. Este trigger espeja SÓLO las reglas
-- DURAS y estructurales (las que nunca varían legítimamente), para no crear una segunda
-- fuente de verdad frágil: el resto de la validación de negocio sigue en el cliente.
-- Corre BEFORE INSERT OR UPDATE, así sólo afecta escrituras nuevas (no rechaza filas
-- viejas retroactivamente).
create or replace function private.validar_data_row()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  -- `data` debe ser un objeto JSON (no array, escalar ni null).
  if jsonb_typeof(new.data) is distinct from 'object' then
    raise exception 'data debe ser un objeto JSON';
  end if;

  -- Consistencia de identidad: el objeto no puede declarar un id/campo distinto al de la
  -- fila (cierra que un miembro escriba `data` apuntando a un campo ajeno o con id falseado).
  if (new.data ? 'id') and (new.data ->> 'id') is distinct from new.id then
    raise exception 'data.id (%) no coincide con la fila (%)', new.data ->> 'id', new.id;
  end if;
  if (new.data ? 'campoId') and (new.data ->> 'campoId') is distinct from new.campo_id then
    raise exception 'data.campoId (%) no coincide con la fila (%)', new.data ->> 'campoId', new.campo_id;
  end if;

  -- Reglas duras por tabla (espejo de reglas.ts).
  if tg_table_name = 'animales' then
    -- RN01: CII = exactamente 10 dígitos numéricos (bloqueo duro).
    if (new.data ? 'caravana') and not ((new.data ->> 'caravana') ~ '^\d{10}$') then
      raise exception 'CII inválido: debe ser 10 dígitos numéricos (RN01)';
    end if;
  elsif tg_table_name = 'eventos' then
    -- Discriminador de subtipo conocido (lo usan la RLS y el dominio).
    if coalesce(new.data ->> 'tipo', '') not in ('sanitario', 'pesaje', 'movimiento') then
      raise exception 'Tipo de evento inválido: %', new.data ->> 'tipo';
    end if;
    -- Peso físicamente posible (espejo de pesoFueraDeRango: 0 < peso <= 1500).
    if (new.data ->> 'tipo') = 'pesaje' and jsonb_typeof(new.data -> 'pesoKg') = 'number' then
      if (new.data ->> 'pesoKg')::numeric <= 0 or (new.data ->> 'pesoKg')::numeric > 1500 then
        raise exception 'Peso fuera del rango físico (0–1500 kg)';
      end if;
    end if;
  end if;

  return new;
end; $$;

-- Se aplica a las tablas de datos de dominio (no a campos/profiles/invitaciones, que ya
-- tienen sus propias guardias o esquema fijo).
do $$ declare t text; begin
  foreach t in array array[
    'lotes','animales','catalogos','productos','proveedores',
    'lecturas','eventos','documentos','sincronizaciones','costos'
  ] loop
    execute format('drop trigger if exists %I on public.%I;', t || '_validar', t);
    execute format(
      'create trigger %I before insert or update on public.%I for each row execute function private.validar_data_row();',
      t || '_validar', t);
  end loop;
end $$;
