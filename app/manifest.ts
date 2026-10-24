import type { MetadataRoute } from "next";

/**
 * Manifiesto de la app (PWA): con esto Chrome ofrece "Instalar app" y el
 * iPhone "Agregar a inicio", y queda un ícono como el de cualquier app.
 *
 * Lo que más importa para el visor: abierta desde el ícono arranca a
 * pantalla completa y en horizontal, sin las barras del navegador. En el
 * iPhone es la única forma, porque Safari no deja poner una página a
 * pantalla completa.
 *
 * No hay service worker a propósito: guardar en caché escenas, modelos y
 * texturas para usarla sin internet se vuelve difícil de mantener (una
 * versión vieja guardada da errores raros), y el tutor y las cuentas
 * necesitan internet igual. Chrome ya no lo pide para instalarla.
 *
 * Los íconos salen del logo de ImmersiLab
 * (public/brand/immersilab-logo.jpg): solo el matraz, porque el texto no se
 * leería en un ícono chico. El fondo de la pantalla de carga es el morado
 * del logo, para que el ícono no quede con un recuadro de otro color.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "ImmersiLab",
    short_name: "ImmersiLab",
    description: "Laboratorios interactivos en 3D — Universidad Mariano Gálvez",
    lang: "es",
    start_url: "/lab",
    scope: "/",
    display: "fullscreen",
    orientation: "landscape",
    background_color: "#101431",
    theme_color: "#0b1220",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
