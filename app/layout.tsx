import type { Metadata } from "next";
import { Crimson_Pro, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { createClient } from "@/lib/supabase/server";
import LogoutButton from "@/components/auth/LogoutButton";

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
  title: "Validador de documentos — Nasus Agency",
  description:
    "Valida documentos mexicanos (INE, CURP, RFC, pasaporte, actas) con IA y base de datos oficial.",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <html
      lang="es"
      className={`${crimsonPro.variable} ${jetbrainsMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-[#050508] text-white">
        <nav className="sticky top-0 z-50 bg-[#050508]/90 backdrop-blur border-b border-zinc-900">
          <div className="max-w-5xl mx-auto px-6 h-14 flex items-center justify-between">
            <a
              href="/"
              className="text-[#c4a882] font-mono font-bold tracking-wide text-sm"
            >
              Nasus Agency
            </a>
            <div className="flex items-center gap-4">
              {user ? (
                <>
                  <span className="text-xs text-zinc-500 truncate max-w-[200px] hidden sm:block">
                    {user.email}
                  </span>
                  <LogoutButton />
                </>
              ) : (
                <a
                  href="mailto:nasusagency@gmail.com"
                  className="text-sm border border-[#c4a882] text-[#c4a882] px-4 py-2 rounded-lg hover:bg-[#c4a882] hover:text-[#050508] transition-colors"
                >
                  Hablar con Nasus
                </a>
              )}
            </div>
          </div>
        </nav>
        {children}
      </body>
    </html>
  );
}
