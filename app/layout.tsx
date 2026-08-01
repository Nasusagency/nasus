import type { Metadata } from "next";
import { Crimson_Pro, JetBrains_Mono } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import FloatingWhatsApp from "./_components/FloatingWhatsApp";
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
      className={`${crimsonPro.variable} ${jetbrainsMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-[#050508] text-white">
        {children}
        <FloatingWhatsApp />
        <Analytics />
      </body>
    </html>
  );
}
