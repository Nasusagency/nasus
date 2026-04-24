import { createClient } from "@/lib/supabase/server";
import ValidatorForm from "@/components/ValidatorForm";

interface Validation {
  id: string;
  doc_type: string;
  valid: boolean;
  created_at: string;
}

export default async function Home() {
  const supabase = await createClient();
  const { data: validations } = await supabase
    .from("validations")
    .select("id, doc_type, valid, created_at")
    .order("created_at", { ascending: false })
    .limit(5);

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex flex-col items-center px-4 py-16">
      <div className="w-full max-w-xl flex flex-col gap-8">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50 tracking-tight">
            Validador de documentos
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
            Sube una imagen de un DNI o acta oficial para verificar su integridad.
          </p>
        </div>

        <ValidatorForm />

        {validations && validations.length > 0 && (
          <section className="flex flex-col gap-3">
            <h2 className="text-xs font-semibold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest">
              Historial reciente
            </h2>
            <ul className="flex flex-col gap-2">
              {(validations as Validation[]).map((v) => (
                <li
                  key={v.id}
                  className="flex items-center justify-between rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-4 py-3"
                >
                  <div className="flex items-center gap-3">
                    <span
                      className={`w-2 h-2 rounded-full flex-shrink-0 ${
                        v.valid ? "bg-green-500" : "bg-red-500"
                      }`}
                    />
                    <span className="text-sm text-zinc-700 dark:text-zinc-300">
                      {v.doc_type === "dni" ? "DNI / Cédula" : "Acta oficial"}
                    </span>
                  </div>
                  <span className="text-xs text-zinc-400 dark:text-zinc-500">
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
