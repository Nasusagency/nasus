export interface CertificadoBachilleratoFields {
  nombre_completo: string | null;
  institucion: string | null;
  promedio: string | null;
  fecha_egreso: string | null;
  cct: string | null;
  folio_certificado: string | null;
}

// CCT: 2 letras (estado) + 2 dígitos (nivel) + 4 dígitos (número) + 1 letra (tipo) + 1 dígito (verificador)
const CCT_REGEX = /^[A-Z]{2}\d{6}[A-Z]\d$/;

export function validateCertificadoBachillerato(raw: CertificadoBachilleratoFields): {
  valid: boolean;
  issues: string[];
  fields: CertificadoBachilleratoFields;
} {
  const fields = { ...raw };
  const issues: string[] = [];

  if (!fields.nombre_completo) issues.push("Nombre del estudiante no detectado o ilegible");
  if (!fields.institucion) issues.push("Institución emisora no detectada");

  if (fields.cct) {
    const norm = fields.cct.trim().toUpperCase().replace(/\s/g, "");
    if (!CCT_REGEX.test(norm)) {
      issues.push(
        `Clave de Centro de Trabajo (CCT) con formato inválido — formato esperado: 2 letras + 6 dígitos + 1 letra + 1 dígito (ej. DF021234P3)`
      );
    } else {
      fields.cct = norm;
    }
  }

  if (fields.promedio) {
    const avg = parseFloat(fields.promedio);
    if (isNaN(avg) || avg < 0 || avg > 10) {
      issues.push(`Promedio fuera de rango válido (0.0 – 10.0): "${fields.promedio}"`);
    }
  }

  return { valid: issues.length === 0, issues, fields };
}
