import { createClient } from "@/lib/supabase/server";
import ValidatorForm from "@/components/ValidatorForm";

// Fuerza render en cada request y deshabilita el Full Route Cache de Next.js.
export const dynamic = "force-dynamic";

interface Validation {
  id: string;
  doc_type: string;
  valid: boolean;
  created_at: string;
}

const DOC_TYPE_SHORT: Record<string, string> = {
  ine: "INE / IFE",
  curp: "CURP",
  rfc: "RFC",
  pasaporte: "Pasaporte",
  acta: "Acta oficial",
  dni: "DNI / Cédula",
};

export default async function Home() {
  const supabase = await createClient();
  const { data: validations } = await supabase
    .from("validations")
    .select("id, doc_type, valid, created_at")
    .order("created_at", { ascending: false })
    .limit(5);

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

        {validations && validations.length > 0 && (
          <section className="flex flex-col gap-3">
            <h2 className="text-xs font-mono text-zinc-600 uppercase tracking-[0.2em]">
              Historial reciente
            </h2>
            <ul className="flex flex-col gap-2">
              {(validations as Validation[]).map((v) => (
                <li
                  key={v.id}
                  className="flex items-center justify-between rounded-xl border border-zinc-800 bg-zinc-900/50 px-4 py-3"
                >
                  <div className="flex items-center gap-3">
                    <span
                      className={`w-2 h-2 rounded-full flex-shrink-0 ${
                        v.valid ? "bg-green-500" : "bg-red-500"
                      }`}
                    />
                    <span className="text-sm text-zinc-300">
                      {DOC_TYPE_SHORT[v.doc_type] ?? v.doc_type.toUpperCase()}
                    </span>
                  </div>
                  <span className="text-xs text-zinc-600 font-mono">
                    {new Date(v.created_at).toLocaleDateString("es", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                    })}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </div>
  );
}
