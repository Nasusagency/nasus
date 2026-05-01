export interface TituloFields {
  nombre_completo: string | null;
  institucion: string | null;
  carrera: string | null;
  fecha_expedicion: string | null;
  cedula_profesional: string | null;
  firmante: string | null;
}

export function validateTituloProfesional(raw: TituloFields): {
  valid: boolean;
  issues: string[];
  fields: TituloFields;
} {
  const fields = { ...raw };
  const issues: string[] = [];

  if (!fields.nombre_completo) issues.push("Nombre completo del profesionista no detectado o ilegible");
  if (!fields.institucion) issues.push("Institución emisora no detectada");
  if (!fields.carrera) issues.push("Carrera o área de estudio no detectada");

  if (fields.cedula_profesional) {
    const digits = fields.cedula_profesional.replace(/\D/g, "");
    if (!/^\d{7,8}$/.test(digits)) {
      issues.push(`Número de cédula profesional con formato inválido — se esperan 7 u 8 dígitos numéricos (SEP)`);
    } else {
      fields.cedula_profesional = digits;
    }
  }

  return { valid: issues.length === 0, issues, fields };
}
