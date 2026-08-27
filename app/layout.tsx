import type { Metadata } from "next";
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