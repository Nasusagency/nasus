import type { Metadata } from "next";
import { Playfair_Display, Space_Mono } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import VoiceAssistant from "./_components/VoiceAssistant";
import AcquisitionTracker from "./_components/AcquisitionTracker";
import { Suspense } from "react";
import "./globals.css";

export const dynamic = "force-dynamic";

// Playfair para titulares editoriales, Space Mono para datos y etiquetas.
// Se cargan con next/font (self-host + preload) en vez del <link> a Google
// que trae el prototipo: evita una petición bloqueante a otro dominio.
const displaySerif = Playfair_Display({
  variable: "--font-display-serif",
  subsets: ["latin"],
  weight: ["400", "600", "700", "800", "900"],
  display: "swap",
});

const monoSpace = Space_Mono({
  variable: "--font-mono-space",
  subsets: ["latin"],
  weight: ["400", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Nasus Agency — Desarrollo web, apps y soluciones tecnológicas a medida",
    template: "%s — Nasus Agency",
  },
  description:
    "Páginas web, aplicaciones, CRMs y automatización para empresas en crecimiento. Implementación directa, sin intermediarios.",
  keywords: [
    "páginas web a medida México",
    "desarrollo de aplicaciones web y móviles",
    "CRM a medida",
    "automatización de procesos",
    "agencia IA México",
    "validador documentos México",
    "extractor facturas Google Ads Excel",
    "validar INE CURP RFC",
  ],
  metadataBase: new URL("https://nasus.lat"),
  alternates: { canonical: "/" },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
    apple: "/favicon.svg",
  },
  openGraph: {
    title: "Nasus Agency — Desarrollo web, apps y soluciones tecnológicas a medida",
    description:
      "Páginas web, aplicaciones, CRMs y automatización para empresas en crecimiento. Implementación directa, sin intermediarios.",
    type: "website",
    siteName: "Nasus Agency",
    url: "https://nasus.lat",
  },
  twitter: {
    card: "summary_large_image",
    title: "Nasus Agency — Desarrollo web, apps y soluciones tecnológicas a medida",
    description:
      "Páginas web, aplicaciones, CRMs y automatización para empresas en crecimiento. Implementación directa, sin intermediarios.",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="es"
      className={`${displaySerif.variable} ${monoSpace.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-[#050508] text-white">
        {children}
        <Suspense fallback={null}><AcquisitionTracker /></Suspense>
        {/* Única acción flotante permanente: el asistente IA. */}
        <VoiceAssistant />
        <Analytics />
      </body>
    </html>
  );
}
