import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Simulador de MMU — Paginación y Reemplazo de Páginas",
  description:
    "Simulador visual de Unidad de Gestión de Memoria (MMU) comparando OPT vs FIFO, SC, LRU y LFU.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body className="antialiased">{children}</body>
    </html>
  );
}

