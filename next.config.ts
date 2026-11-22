import type { NextConfig } from "next";

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-XSS-Protection", value: "1; mode=block" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // `microphone=(self)` — el asistente de voz necesita getUserMedia desde
  // nuestro propio origen. Una lista vacía `microphone=()` lo bloquea incluso
  // con el permiso concedido en el navegador. Cámara y ubicación siguen cerradas.
  { key: "Permissions-Policy", value: "camera=(), microphone=(self), geolocation=()" },
];

const nextConfig: NextConfig = {
  /**
   * nasus.mx es el dominio principal; nasus.lat redirige conservando la ruta y la
   * query (propuestas, pagos y enlaces ya enviados siguen funcionando).
   *
   * /api NO se redirige: el webhook de WhatsApp en Meta, los avisos de Mercado Pago
   * de pagos ya creados y otros servicios apuntan a nasus.lat/api/... y no siguen
   * redirecciones en POST. Esas rutas responden igual en ambos dominios.
   */
  async redirects() {
    return [
      {
        source: "/:path((?!api/).*)",
        has: [{ type: "host", value: "(www\\.)?nasus\\.lat" }],
        destination: "https://nasus.mx/:path",
        permanent: true,
      },
    ];
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
