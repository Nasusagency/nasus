import FieldsTable from "./FieldsTable";

const DOC_TYPE_LABELS: Record<string, string> = {
  ine: "INE / IFE — Credencial para Votar",
  curp: "CURP — Clave Única de Registro de Población",
  rfc: "RFC — Registro Federal de Contribuyentes",
  pasaporte: "Pasaporte Mexicano",
  acta: "Acta Oficial",
  dni: "DNI / Cédula de Identidad",
};

interface Props {
  valid: boolean;
  issues: string[];
  fields: Record<string, unknown>;
  docType?: string;
}

export default function ValidationResult({ valid, issues, fields, docType }: Props) {
  return (
    <div className="flex flex-col gap-4 w-full">
      {/* Tipo de documento */}
      {docType && (
        <p className="text-xs font-medium text-zinc-400 dark:text-zinc-500 uppercase tracking-wide">
          {DOC_TYPE_LABELS[docType] ?? docType.toUpperCase()}
        </p>
      )}

      {/* Badge de resultado */}
      <div
        className={`flex items-center gap-3 rounded-2xl px-5 py-4 ${
          valid
            ? "bg-emerald-50 border border-emerald-200 dark:bg-emerald-950 dark:border-emerald-800"
            : "bg-red-50 border border-red-200 dark:bg-red-950 dark:border-red-800"
        }`}
      >
        {valid ? (
          <svg
            className="w-6 h-6 shrink-0 text-emerald-600 dark:text-emerald-400"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        ) : (
          <svg
            className="w-6 h-6 shrink-0 text-red-600 dark:text-red-400"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
            />
          </svg>
        )}
        <div>
          <p
            className={`font-semibold ${
              valid
                ? "text-emerald-700 dark:text-emerald-300"
                : "text-red-700 dark:text-red-300"
            }`}
          >
            {valid ? "Documento válido" : "Documento con problemas"}
          </p>
          {!valid && (
            <p className="text-xs text-red-600 dark:text-red-400 mt-0.5">
              Se encontraron {issues.length} problema
              {issues.length !== 1 ? "s" : ""}
            </p>
          )}
        </div>
      </div>

      {/* Lista de problemas */}
      {issues.length > 0 && (
        <ul className="flex flex-col gap-1.5">
          {issues.map((issue, i) => (
            <li
              key={i}
              className="flex items-start gap-2 text-sm text-red-700 dark:text-red-400"
            >
              <span className="mt-0.5 shrink-0">•</span>
              {issue}
            </li>
          ))}
        </ul>
      )}

      {/* Campos extraídos */}
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-zinc-400 mb-2">
          Campos extraídos
        </p>
        <FieldsTable fields={fields} />
      </div>
    </div>
  );
}
