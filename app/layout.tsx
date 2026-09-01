import type { Metadata, Viewport } from "next";
import { Playfair_Display, Space_Mono } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import Script from "next/script";
import VoiceAssistant from "./_components/VoiceAssistant";
import AcquisitionTracker from "./_components/AcquisitionTracker";
import { Suspense } from "react";
import "./globals.css";

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

const TITLE = "Nasus Agency — Desarrollo web y automatización con IA";
const DESCRIPTION =
  "Páginas web, aplicaciones, CRMs y automatización para empresas en crecimiento. Implementación directa, sin intermediarios.";

export const metadata: Metadata = {
  title: {
    default: TITLE,
    template: "%s — Nasus Agency",
  },
  description: DESCRIPTION,
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
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon.svg", type: "image/svg+xml" },
    ],
    shortcut: "/favicon.ico",
    apple: "/apple-touch-icon.png",
  },
  manifest: "/site.webmanifest",
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    type: "website",
    siteName: "Nasus Agency",
    url: "https://nasus.lat",
    locale: "es_MX",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "Nasus Agency — Soluciones tecnológicas artesanales para empresas en escala",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
    images: ["/og-image.png"],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#050508",
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
      <Script
        src="https://www.googletagmanager.com/gtag/js?id=AW-18354242244"
        strategy="afterInteractive"
      />
      <Script id="google-ads-tag" strategy="afterInteractive">
        {`window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', 'AW-18354242244');`}
      </Script>
      <Script id="microsoft-clarity" strategy="afterInteractive">
        {`(function(c,l,a,r,i,t,y){
c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
})(window, document, "clarity", "script", "y72szzmdhx");`}
      </Script>
    </html>
  );
}
