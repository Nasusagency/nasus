export const dynamic = "force-dynamic";

import PhotoValidatorForm from "@/components/photos/PhotoValidatorForm";

export default function FotosPage() {
  return (
    <div className="min-h-screen bg-[#050508] flex flex-col items-center px-4 py-16">
      <div className="w-full max-w-xl flex flex-col gap-8">
        <div>
          <p className="text-[#00f2ff] text-xs font-mono tracking-[0.3em] uppercase mb-3">
            Validador de fotografías
          </p>
          <h1 className="text-3xl font-display font-semibold text-white tracking-tight">
            Fotos oficiales
          </h1>
          <p className="text-sm text-zinc-500 mt-2">
            Verifica si tu fotografía cumple los requisitos oficiales para pasaporte
            mexicano, visa americana o credenciales escolares.
          </p>
        </div>

        <PhotoValidatorForm />
      </div>
    </div>
  );
}
