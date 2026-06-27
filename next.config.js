/** @type {import('next').NextConfig} */

// Cabeceras de seguridad (defensa en profundidad). La CSP se mantiene conservadora a
// propósito: sólo fija las directivas que NO rompen Next/Supabase/OAuth (sin default-src,
// para no restringir scripts/estilos/connect). frame-ancestors 'none' + X-Frame-Options
// cierran el clickjacking; object-src/base-uri/form-action limitan vectores de inyección.
// No se nombra `bluetooth` en Permissions-Policy para no deshabilitar el lector RFID.
const securityHeaders = [
  {
    key: "Content-Security-Policy",
    value: "object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'",
  },
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
