import type { Metadata, Viewport } from "next";
import { Space_Grotesk, JetBrains_Mono } from "next/font/google";
import "./globals.css";

// Fuente de "instrumento": la usamos para números y lecturas de datos
// (ángulo, velocidad, resultados) porque los dígitos tienen ancho fijo,
// se leen más rápido cuando cambian en vivo.
const spaceGrotesk = Space_Grotesk({
  variable: "--font-display",
  subsets: ["latin"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "ImmersiLab",
  description: "Laboratorios interactivos en 3D — Universidad Mariano Gálvez",
};

/**
 * `viewportFit: "cover"` es lo que hace que `env(safe-area-inset-*)` deje de
 * valer 0 en celulares con muesca — sin esto, los paneles del HUD siguen
 * quedando debajo del hardware aunque el CSS lo contemple.
 *
 * El zoom se bloquea porque un doble tap sobre el canvas 3D hacía zoom del
 * navegador en vez de interactuar con la escena.
 */
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#0b1220",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="es"
      className={`${spaceGrotesk.variable} ${jetbrainsMono.variable}`}
    >
      <body>{children}</body>
    </html>
  );
}