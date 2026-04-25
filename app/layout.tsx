import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { createClient } from "@/lib/supabase/server";
import LogoutButton from "@/components/auth/LogoutButton";

export const dynamic = "force-dynamic";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Validador de documentos — Nasus Agency",
  description: "Valida documentos mexicanos (INE, CURP, RFC, pasaporte, actas) con IA y base de datos oficial.",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <html
      lang="es"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {user && (
          <header className="border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950">
            <div className="max-w-xl mx-auto px-4 h-12 flex items-center justify-between">
              <span className="text-xs text-zinc-400 dark:text-zinc-500 truncate max-w-[70%]">
                {user.email}
              </span>
              <LogoutButton />
            </div>
          </header>
        )}
        {children}
      </body>
    </html>
  );
}
