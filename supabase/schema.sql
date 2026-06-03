-- ============================================================================
-- Esquema Supabase — Caravanas Electrónicas (Trazabilidad Ganadera)
-- Patrón: columnas clave (para RLS/queries) + columna `data jsonb` con el objeto
-- completo del modelo. Preserva los ids generados en el cliente y minimiza el mapeo.
-- Seguridad: RLS por membresía de campo (array de uuids en `campos`).
-- Ejecutar TODO el archivo en el SQL Editor de Supabase.
-- ============================================================================

-- ---------- profiles (espejo de auth.users con username) ----------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text unique not null,
  email text,
  created_at timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, username, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'username', split_part(new.email, '@', 1)),
    new.email
  )
  on conflict (id) do nothing;
  return new;
end; $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users for each row execute function public.handle_new_user();

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
create or replace function public.is_campo_member(cid text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.campos c
    where c.id = cid and (c.owner_id = auth.uid() or auth.uid() = any (c.miembros_uuids))
  );
$$;

create or replace function public.can_write_campo(cid text)
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

drop policy if exists profiles_sel on public.profiles;
create policy profiles_sel on public.profiles for select using (true);
drop policy if exists profiles_ins on public.profiles;
create policy profiles_ins on public.profiles for insert with check (id = auth.uid());
drop policy if exists profiles_upd on public.profiles;
create policy profiles_upd on public.profiles for update using (id = auth.uid());

drop policy if exists campos_sel on public.campos;
create policy campos_sel on public.campos for select using (public.is_campo_member(id));
drop policy if exists campos_ins on public.campos;
create policy campos_ins on public.campos for insert with check (owner_id = auth.uid());
drop policy if exists campos_upd on public.campos;
create policy campos_upd on public.campos for update using (public.can_write_campo(id)) with check (public.can_write_campo(id));
drop policy if exists campos_del on public.campos;
create policy campos_del on public.campos for delete using (owner_id = auth.uid());

-- invitaciones: las ve el campo o el invitado (por su email); el invitado puede marcar la suya
drop policy if exists inv_sel on public.invitaciones;
create policy inv_sel on public.invitaciones for select using (
  public.is_campo_member(campo_id) or lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
);
drop policy if exists inv_ins on public.invitaciones;
create policy inv_ins on public.invitaciones for insert with check (public.can_write_campo(campo_id));
drop policy if exists inv_upd on public.invitaciones;
create policy inv_upd on public.invitaciones for update using (
  public.can_write_campo(campo_id) or lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
);
drop policy if exists inv_del on public.invitaciones;
create policy inv_del on public.invitaciones for delete using (
  public.can_write_campo(campo_id) or lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
);

-- tablas de datos: SELECT si sos miembro; escribir si tenés permiso (rol <> vista)
do $$ declare t text; begin
  foreach t in array array[
    'lotes','animales','catalogos','productos','proveedores',
    'lecturas','eventos','documentos','sincronizaciones','costos'
  ] loop
    execute format('alter table public.%I enable row level security;', t);
    execute format('drop policy if exists %I on public.%I;', t || '_sel', t);
    execute format('create policy %I on public.%I for select using (public.is_campo_member(campo_id));', t || '_sel', t);
    execute format('drop policy if exists %I on public.%I;', t || '_mod', t);
    execute format('create policy %I on public.%I for all using (public.can_write_campo(campo_id)) with check (public.can_write_campo(campo_id));', t || '_mod', t);
  end loop;
end $$;

-- ============================================================================
-- RPCs (operaciones que cruzan la frontera de RLS de forma controlada)
-- ============================================================================

create or replace function public.email_for_username(p_username text)
returns text language sql stable security definer set search_path = public as $$
  select email from public.profiles where lower(username) = lower(p_username) limit 1;
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

grant execute on function public.email_for_username(text) to anon, authenticated;
grant execute on function public.unirme_con_codigo(text) to authenticated;
grant execute on function public.aceptar_invitacion(text) to authenticated;
