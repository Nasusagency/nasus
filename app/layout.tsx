import type { Metadata } from "next";
import { Crimson_Pro, JetBrains_Mono } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";

export const dynamic = "force-dynamic";

const crimsonPro = Crimson_Pro({
  variable: "--font-crimson",
  subsets: ["latin"],
  weight: ["400", "600", "700"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains",
  subsets: ["latin"],
  weight: ["400", "500", "700"],
});

export const metadata: Metadata = {
  title: {
    default: "Nasus Agency — Soluciones tecnológicas artesanales para empresas en escala",
    template: "%s — Nasus Agency",
  },
  description:
    "Automatiza la validación de documentos oficiales y el análisis de facturas publicitarias con IA. Implementación directa en tus sistemas. Sin intermediarios.",
  keywords: [
    "validador documentos México",
    "extractor facturas Google Ads Excel",
    "agencia IA México",
    "automatización empresas",
    "validar INE CURP RFC",
    "factura Meta Ads Excel",
  ],
  metadataBase: new URL("https://nasus.lat"),
  alternates: { canonical: "/" },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
  openGraph: {
    title: "Nasus Agency — Soluciones tecnológicas artesanales para empresas en escala",
    description:
      "Automatiza la validación de documentos oficiales y el análisis de facturas publicitarias con IA. Implementación directa en tus sistemas. Sin intermediarios.",
    type: "website",
    siteName: "Nasus Agency",
    url: "https://nasus.lat",
  },
  twitter: {
    card: "summary_large_image",
    title: "Nasus Agency — Soluciones tecnológicas artesanales",
    description:
      "Automatiza la validación de documentos oficiales y el análisis de facturas publicitarias con IA.",
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
      className={`${crimsonPro.variable} ${jetbrainsMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-[#050508] text-white">
        {children}
        <Analytics />
      </body>
    </html>
  );
}
