import type { Metadata } from "next";
import { Crimson_Pro, JetBrains_Mono } from "next/font/google";
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
  title: "Nasus Agency — Soluciones tecnológicas artesanales",
  description:
    "Implementamos IA directamente en tus sistemas. Validador de documentos oficiales mexicanos, automatización de procesos y desarrollo a medida para startups en escala.",
  openGraph: {
    title: "Nasus Agency — Soluciones tecnológicas artesanales",
    description:
      "Implementamos IA directamente en tus sistemas. Validador de documentos oficiales mexicanos, automatización de procesos y desarrollo a medida para startups en escala.",
    type: "website",
    siteName: "Nasus Agency",
    url: "https://nasus.lat",
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
      </body>
    </html>
  );
}
