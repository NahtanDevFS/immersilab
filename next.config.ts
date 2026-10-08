import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // En desarrollo, Next bloquea los pedidos que llegan desde otra dirección
  // que no sea localhost. Para probar en el celular con el visor, el celular
  // abre el servidor por la IP de la computadora en la red local; sin esto la
  // página no termina de cargar. Solo afecta a `next dev`.
  allowedDevOrigins: ["192.168.*.*", "10.*.*.*"],
};

export default nextConfig;
