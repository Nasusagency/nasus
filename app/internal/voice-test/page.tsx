import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { verifyAdminToken, ADMIN_COOKIE } from "@/lib/admin/auth";

export const metadata: Metadata = { robots: "noindex, nofollow" };

// Fuera de app/admin a propósito: es una herramienta de QA interna, no parte
// del CRM operativo, así que no debe aparecer en AdminNav ni en su shell.
// Usa la misma cookie/JWT admin para no abrir una superficie sin auth.
export default async function VoiceTestPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_COOKIE)?.value;
  if (!token || !(await verifyAdminToken(token))) redirect("/admin/login");

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#050508] px-6 text-center text-white">
      <div className="max-w-md">
        <p className="font-mono text-xs tracking-widest text-[#c4a882]">HERRAMIENTA INTERNA</p>
        <h1 className="mt-3 text-2xl font-semibold">Prueba del asistente de voz</h1>
        <p className="mt-3 text-sm text-zinc-400">
          El botón flotante del asistente (esquina inferior derecha) es el mismo componente que corre en nasus.lat.
          Esta página solo existe para probarlo sin que aparezca dentro del panel de administración.
        </p>
      </div>
    </div>
  );
}
