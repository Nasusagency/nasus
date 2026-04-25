interface Props {
  fields: Record<string, unknown>;
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (Array.isArray(value)) return value.length ? value.join(", ") : "—";
  return String(value);
}

const LABELS: Record<string, string> = {
  // Campos comunes
  nombres: "Nombres",
  apellidos: "Apellidos",
  apellido_paterno: "Apellido paterno",
  apellido_materno: "Apellido materno",
  fecha_nacimiento: "Fecha de nacimiento",
  fecha_vencimiento: "Fecha de vencimiento",
  pais: "País",
  nacionalidad: "Nacionalidad",
  // INE
  clave_elector: "Clave de elector",
  seccion: "Sección electoral",
  // CURP
  curp: "CURP",
  sexo: "Sexo",
  entidad_nacimiento: "Entidad de nacimiento",
  // RFC
  rfc: "RFC",
  nombre: "Nombre / Razón social",
  tipo_persona: "Tipo de persona",
  fecha: "Fecha",
  // Pasaporte
  numero_pasaporte: "N.º de pasaporte",
  // DNI genérico
  numero_documento: "N.º documento",
  // Acta
  tipo_acta: "Tipo de acta",
  numero_acta: "N.º acta",
  fecha_emision: "Fecha de emisión",
  entidad_emisora: "Entidad emisora",
  nombres_involucrados: "Personas involucradas",
};

export default function FieldsTable({ fields }: Props) {
  const rows = Object.entries(fields);
  if (rows.length === 0) return null;

  return (
    <div className="w-full overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-700">
      <table className="w-full text-sm">
        <tbody>
          {rows.map(([key, value], i) => (
            <tr
              key={key}
              className={
                i % 2 === 0
                  ? "bg-white dark:bg-zinc-900"
                  : "bg-zinc-50 dark:bg-zinc-800"
              }
            >
              <td className="px-4 py-2.5 font-medium text-zinc-500 dark:text-zinc-400 w-48 whitespace-nowrap">
                {LABELS[key] ?? key}
              </td>
              <td className="px-4 py-2.5 text-zinc-800 dark:text-zinc-200">
                {formatValue(value)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
