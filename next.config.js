/** @type {import('next').NextConfig} */

const isDev = process.env.NODE_ENV !== "production";

// Origen del bot SIGSA (Cloud Run/Docker) para permitir el fetch del navegador en connect-src.
const botOrigin = (() => {
  try {
    return process.env.NEXT_PUBLIC_BOT_URL
      ? new URL(process.env.NEXT_PUBLIC_BOT_URL).origin
      : "";
  } catch {
    return "";
  }
})();

// connect-src: la app habla con Supabase (REST por https + realtime por wss) y con el bot.
// En dev se agrega el websocket de HMR de Next.
const connectSrc = [
  "'self'",
  "https://*.supabase.co",
  "wss://*.supabase.co",
  botOrigin,
  isDev ? "ws://localhost:* http://localhost:*" : "",
]
  .filter(Boolean)
  .join(" ");

// script-src sin nonce: Next inyecta scripts inline de bootstrap/RSC, así que se necesita
// 'unsafe-inline'. Aun así, fijar el origen ('self') BLOQUEA la carga de scripts externos
// inyectados (p.ej. <script src="//evil">), que es el principal vector de XSS por inyección.
// En dev se agrega 'unsafe-eval' para el HMR/overlay de Next (sólo desarrollo, nunca producción).
const scriptSrc = isDev ? "'self' 'unsafe-inline' 'unsafe-eval'" : "'self' 'unsafe-inline'";

// CSP endurecida. Antes sólo fijaba object-src/base-uri/frame-ancestors/form-action; ahora
// acota también de dónde pueden venir scripts, estilos, imágenes, fuentes y conexiones.
// No usa nonce a propósito: hacerlo obligaría a render dinámico por request y rompería el
// prerender estático, a cambio de poca ganancia (la app no tiene sinks de XSS de scripts).
const csp = [
  "default-src 'self'",
  `script-src ${scriptSrc}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  `connect-src ${connectSrc}`,
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "frame-src 'none'",
  "worker-src 'self' blob:",
  "manifest-src 'self'",
].join("; ");

// Cabeceras de seguridad (defensa en profundidad). No se nombra `bluetooth` en
// Permissions-Policy para no deshabilitar el lector RFID.
const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  // Fuerza HTTPS por 2 años en el dominio y subdominios. Vercel ya lo agrega en
  // *.vercel.app; lo fijamos explícito para que valga también en dominio propio.
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
];

const nextConfig = {
  reactStrictMode: true,
  // No revelar la tecnología del servidor (quita el header `X-Powered-By: Next.js`).
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

module.exports = nextConfig;
