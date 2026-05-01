import type { Metadata } from "next";
import ValidatorForm from "@/components/ValidatorForm";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Validador de Documentos Oficiales — Nasus Agency",
  description:
    "Valida INE, CURP, RFC, Pasaporte y Acta de Nacimiento automáticamente con IA. Extrae campos y cruza contra bases de datos oficiales en segundos.",
  alternates: { canonical: "https://nasus.lat/validador" },
  openGraph: {
    title: "Validador de Documentos Oficiales — Nasus Agency",
    description:
      "Valida INE, CURP, RFC, Pasaporte y Acta de Nacimiento automáticamente con IA. Extrae campos y cruza contra bases de datos oficiales en segundos.",
    url: "https://nasus.lat/validador",
  },
};

export default function ValidadorPage() {
  return (
    <div className="min-h-screen bg-[#050508] flex flex-col items-center px-4 py-16">
      <div className="w-full max-w-xl flex flex-col gap-8">
        <div>
          <p className="text-[#00f2ff] text-xs font-mono tracking-[0.3em] uppercase mb-3">
            Validador de documentos
          </p>
          <h1 className="text-3xl font-display font-semibold text-white tracking-tight">
            Documentos mexicanos
          </h1>
          <p className="text-sm text-zinc-500 mt-2">
            Sube una imagen de tu INE, CURP, RFC, pasaporte o acta oficial para
            verificar su integridad.
          </p>
        </div>

        <ValidatorForm />
      </div>
    </div>
  );
}
