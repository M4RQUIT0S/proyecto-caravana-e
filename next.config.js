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
];

const nextConfig = {
  reactStrictMode: true,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

module.exports = nextConfig;
