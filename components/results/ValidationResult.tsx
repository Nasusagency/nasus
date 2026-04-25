import FieldsTable from "./FieldsTable";

const DOC_TYPE_LABELS: Record<string, string> = {
  ine: "INE / IFE — Credencial para Votar",
  curp: "CURP — Clave Única de Registro de Población",
  rfc: "RFC — Registro Federal de Contribuyentes",
  pasaporte: "Pasaporte Mexicano",
  acta: "Acta Oficial",
  dni: "DNI / Cédula de Identidad",
};

type DiditStatus =
  | "full_match"
  | "partial_match"
  | "no_match"
  | "not_found"
  | "unavailable"
  | "skipped";

interface DiditCheck {
  status: DiditStatus;
  details?: Record<string, unknown>;
}

interface Props {
  valid: boolean;
  issues: string[];
  fields: Record<string, unknown>;
  docType?: string;
  diditCheck?: DiditCheck;
}

const DIDIT_CONFIG: Record<
  Exclude<DiditStatus, "skipped">,
  { label: string; classes: string }
> = {
  full_match: {
    label: "Verificado en base de datos oficial",
    classes:
      "bg-emerald-50 border-emerald-200 text-emerald-700 dark:bg-emerald-950 dark:border-emerald-800 dark:text-emerald-300",
  },
  partial_match: {
    label: "Coincidencia parcial en base de datos oficial",
    classes:
      "bg-amber-50 border-amber-200 text-amber-700 dark:bg-amber-950 dark:border-amber-800 dark:text-amber-300",
  },
  no_match: {
    label: "No coincide con la base de datos oficial",
    classes:
      "bg-red-50 border-red-200 text-red-700 dark:bg-red-950 dark:border-red-800 dark:text-red-300",
  },
  not_found: {
    label: "Documento no encontrado en base de datos oficial",
    classes:
      "bg-red-50 border-red-200 text-red-700 dark:bg-red-950 dark:border-red-800 dark:text-red-300",
  },
  unavailable: {
    label: "Verificación en base de datos no disponible",
    classes:
      "bg-zinc-50 border-zinc-200 text-zinc-500 dark:bg-zinc-900 dark:border-zinc-700 dark:text-zinc-400",
  },
};

function DiditBadge({ diditCheck }: { diditCheck: DiditCheck }) {
  if (diditCheck.status === "skipped") return null;

  const cfg = DIDIT_CONFIG[diditCheck.status];

  const iconPath =
    diditCheck.status === "full_match"
      ? "M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
      : diditCheck.status === "partial_match"
      ? "M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
      : diditCheck.status === "unavailable"
      ? "M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9 5.25h.008v.008H12v-.008z"
      : "M9.75 9.75l4.5 4.5m0-4.5l-4.5 4.5M21 12a9 9 0 11-18 0 9 9 0 0118 0z";

  return (
    <div
      className={`flex items-center gap-2.5 rounded-xl border px-4 py-3 text-sm ${cfg.classes}`}
    >
      <svg
        className="w-4 h-4 shrink-0"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        viewBox="0 0 24 24"
      >
        <path strokeLinecap="round" strokeLinejoin="round" d={iconPath} />
      </svg>
      <span className="font-medium">{cfg.label}</span>
      <span className="ml-auto text-xs opacity-50 shrink-0">Didit</span>
    </div>
  );
}

export default function ValidationResult({
  valid,
  issues,
  fields,
  docType,
  diditCheck,
}: Props) {
  return (
    <div className="flex flex-col gap-4 w-full">
      {/* Tipo de documento */}
      {docType && (
        <p className="text-xs font-medium text-zinc-400 dark:text-zinc-500 uppercase tracking-wide">
          {DOC_TYPE_LABELS[docType] ?? docType.toUpperCase()}
        </p>
      )}

      {/* Badge de resultado offline */}
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

      {/* Badge de verificación Didit */}
      {diditCheck && <DiditBadge diditCheck={diditCheck} />}

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
