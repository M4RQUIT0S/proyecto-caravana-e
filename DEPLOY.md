# Deploy — Supabase + Vercel

La app usa **Supabase** (Postgres + Auth + RLS) como backend y se despliega en **Vercel**.
El bot SIGSA (Playwright) **no corre en Vercel**: se despliega aparte (Docker/Cloud Run).

## 1. Supabase

1. Crear un proyecto en https://supabase.com.
2. **SQL Editor → New query** → pegar y ejecutar todo `supabase/schema.sql`.
   Crea tablas (`campos`, `animales`, `eventos`, …), políticas RLS por membresía y las RPCs
   (`unirme_con_codigo`, `aceptar_invitacion`, `email_for_username`).
3. **Authentication → Providers → Email**: para registro inmediato, desactivá
   *"Confirm email"*. (Si lo dejás activo, los usuarios deben confirmar por correo antes de entrar.)
4. **Project Settings → API**: copiá `Project URL` y `anon public key`.

## 2. Variables de entorno

Local: copiá `.env.example` a `.env.local` (ya está en `.gitignore`) y completá:

```
NEXT_PUBLIC_SUPABASE_URL=https://TU-PROYECTO.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
NEXT_PUBLIC_BOT_URL=            # URL pública del bot SIGSA (Cloud Run/Docker). Vacío si no aplica.
```

> El `anon key` es público (va al cliente); la seguridad la dan las políticas RLS.

## 3. Vercel

Opción dashboard: importar el repo de GitHub, framework **Next.js** (autodetectado), y cargar las
mismas variables en **Settings → Environment Variables** (Production + Preview).

Opción CLI:

```
npm i -g vercel
vercel link            # vincular el proyecto
vercel env add NEXT_PUBLIC_SUPABASE_URL
vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY
vercel --prod          # deploy
```

## 4. Bot SIGSA (aparte de Vercel)

El bot vive en `src/app/api/sigsa/declarar` + `src/lib/sigsa-bot.ts` y usa Playwright/Chromium.
La ruta ya trae CORS + preflight + un GET de health. **No corre en Vercel serverless.**

> Estado: la automatización SIGSA (navegar al servicio + subir el archivo) todavía es **placeholder
> (`// TODO`)** en `sigsa-bot.ts`; el bot llega hasta el login de AFIP y falla en el paso SIGSA.
> Completarla requiere acceso real al portal para fijar los selectores.

### Opción A — Local + túnel gratis (sin Docker, sin tarjeta)

Corre el bot con el Chrome instalado y lo expone con cloudflared:

```
powershell -ExecutionPolicy Bypass -File scripts\bot-local.ps1
```

Imprime una URL `https://...trycloudflare.com`. Ponela en Vercel como `NEXT_PUBLIC_BOT_URL`
(Settings → Environment Variables) y redeployá. La máquina tiene que estar prendida.
La URL de trycloudflare **cambia cada vez** que reiniciás el túnel; para una URL **estable y gratis**
usá un *named tunnel* de Cloudflare (necesita cuenta Cloudflare + un dominio):
`cloudflared tunnel create sigsa` → `cloudflared tunnel route dns sigsa bot.tudominio.com` →
`cloudflared tunnel run --url http://localhost:3000 sigsa`.

Sin instalar Node global, el bot también se puede levantar a mano:
`set BOT_CHROME_CHANNEL=chrome && npm run build && npm start` (Chrome del sistema; en Linux/Mac
usá `BOT_CHROME_CHANNEL=chrome`).

### Opción B — Contenedor (cuando definas hosting pago/Cloud Run)

```
docker build -t sigsa-bot .
docker run -p 8080:8080 sigsa-bot          # la imagen trae Chromium; no precisa BOT_CHROME_*
```

Desplegá esa imagen en Cloud Run (`gcloud run deploy --source .`, ~1GB RAM) u otro host con Docker,
y apuntá `NEXT_PUBLIC_BOT_URL` a su URL pública.

Si `NEXT_PUBLIC_BOT_URL` queda vacío, la app llama la ruta interna `/api/sigsa/declarar`
(sólo sirve en hosts no-serverless).

## Notas de arquitectura

- La capa de datos mantiene la fachada local (`db` + `update()`): cada cambio es optimista en
  `localStorage` y se sincroniza a Supabase (`src/lib/supabase/sync.ts`, `pushDiff`). Al iniciar
  sesión, `hydrate()` baja de Supabase lo que el usuario puede ver (RLS).
- Las variables `NEXT_PUBLIC_SUPABASE_*` son **obligatorias** (la autenticación es Supabase Auth):
  sin ellas no se puede iniciar sesión. Deben estar presentes en **build time** (Next inlinea las
  `NEXT_PUBLIC_*`), por eso se cargan en Vercel antes del deploy.
- Las credenciales AFIP del bot (`campo.afip`) son **sólo locales** (nunca se suben a Supabase).
- RLS: el acceso a un campo y sus datos depende de ser owner o estar en `campos.miembros_uuids`.
  El control fino por rol (que un `vista` no escriba) se valida en `can_write_campo` y en la UI.
