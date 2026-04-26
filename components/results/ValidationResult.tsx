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
    classes: "bg-emerald-950/50 border-emerald-800 text-emerald-400",
  },
  partial_match: {
    label: "Coincidencia parcial en base de datos oficial",
    classes: "bg-amber-950/50 border-amber-800 text-amber-400",
  },
  no_match: {
    label: "No coincide con la base de datos oficial",
    classes: "bg-red-950/50 border-red-800 text-red-400",
  },
  not_found: {
    label: "Documento no encontrado en base de datos oficial",
    classes: "bg-red-950/50 border-red-800 text-red-400",
  },
  unavailable: {
    label: "Verificación en base de datos no disponible",
    classes: "bg-zinc-900 border-zinc-700 text-zinc-500",
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
      className={`flex items-center gap-2.5 rounded-xl border px-4 py-3 text-sm font-mono ${cfg.classes}`}
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
      <span className="ml-auto text-xs opacity-40 shrink-0">Didit</span>
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
      {docType && (
        <p className="text-xs font-mono text-[#00f2ff] uppercase tracking-[0.2em]">
          {DOC_TYPE_LABELS[docType] ?? docType.toUpperCase()}
        </p>
      )}

      <div
        className={`flex items-center gap-3 rounded-2xl px-5 py-4 border ${
          valid
            ? "bg-emerald-950/40 border-emerald-800"
            : "bg-red-950/40 border-red-800"
        }`}
      >
        {valid ? (
          <svg
            className="w-6 h-6 shrink-0 text-emerald-400"
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
            className="w-6 h-6 shrink-0 text-red-400"
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
            className={`font-semibold font-display text-lg ${
              valid ? "text-emerald-300" : "text-red-300"
            }`}
          >
            {valid ? "Documento válido" : "Documento con problemas"}
          </p>
          {!valid && (
            <p className="text-xs text-red-500 font-mono mt-0.5">
              {issues.length} problema{issues.length !== 1 ? "s" : ""} encontrado
              {issues.length !== 1 ? "s" : ""}
            </p>
          )}
        </div>
      </div>

      {diditCheck && <DiditBadge diditCheck={diditCheck} />}

      {issues.length > 0 && (
        <ul className="flex flex-col gap-1.5">
          {issues.map((issue, i) => (
            <li
              key={i}
              className="flex items-start gap-2 text-sm text-red-400 font-mono"
            >
              <span className="mt-0.5 shrink-0 text-red-600">•</span>
              {issue}
            </li>
          ))}
        </ul>
      )}

      <div>
        <p className="text-xs font-mono uppercase tracking-[0.2em] text-[#c4a882] mb-2">
          Campos extraídos
        </p>
        <FieldsTable fields={fields} />
      </div>
    </div>
  );
}
