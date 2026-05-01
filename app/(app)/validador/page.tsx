import ValidatorForm from "@/components/ValidatorForm";

export const dynamic = "force-dynamic";

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
