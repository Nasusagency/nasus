import { diditPost } from "./client";

export type DiditStatus =
  | "full_match"
  | "partial_match"
  | "no_match"
  | "not_found"
  | "unavailable"
  | "skipped";

export interface DiditCheck {
  status: DiditStatus;
  details?: Record<string, unknown>;
}

// Llama al endpoint de Didit y normaliza la respuesta
async function callDatabaseValidation(body: FormData): Promise<DiditCheck> {
  try {
    const res = await diditPost("/database-validation/", body);

    if (!res.ok) {
      console.error("[didit] database-validation respondió con status", res.status);
      return { status: "unavailable" };
    }

    const data = (await res.json()) as {
      database_validation?: {
        status?: string;
        validation_details?: Record<string, unknown>;
      };
    };

    const raw = data.database_validation?.status?.toLowerCase() ?? "";
    const status: DiditStatus =
      raw === "full_match"    ? "full_match"
      : raw === "partial_match" ? "partial_match"
      : raw === "no_match"    ? "no_match"
      : raw === "not_found"   ? "not_found"
      : "unavailable";

    return { status, details: data.database_validation?.validation_details };
  } catch {
    console.error("[didit] Error al contactar database-validation API");
    return { status: "unavailable" };
  }
}

/**
 * Verifica una CURP contra la base de datos de RENAPO vía Didit.
 * Con nombres/apellidos usa validation_type=two_by_two para mayor rigor.
 */
export async function validateCurpWithDidit(params: {
  curp: string;
  nombres?: string | null;
  apellido_paterno?: string | null;
  apellido_materno?: string | null;
  fecha_nacimiento?: string | null;
}): Promise<DiditCheck> {
  const body = new FormData();
  body.append("issuing_state", "MEX");
  body.append("identification_number", params.curp);

  const tieneExtra = !!(params.nombres || params.apellido_paterno);
  body.append("validation_type", tieneExtra ? "two_by_two" : "one_by_one");

  if (params.nombres) body.append("first_name", params.nombres);

  if (params.apellido_paterno) {
    const apellidos = [params.apellido_paterno, params.apellido_materno]
      .filter(Boolean)
      .join(" ");
    body.append("last_name", apellidos);
  }

  if (params.fecha_nacimiento) body.append("date_of_birth", params.fecha_nacimiento);

  return callDatabaseValidation(body);
}

/**
 * Verifica la CURP embebida en la INE contra la base de datos de RENAPO vía Didit.
 * Didit para MEX valida por CURP (no por clave de elector).
 */
export async function validateIneWithDidit(params: {
  curp: string;
  nombres?: string | null;
  apellido_paterno?: string | null;
  apellido_materno?: string | null;
  fecha_nacimiento?: string | null;
}): Promise<DiditCheck> {
  const body = new FormData();
  body.append("issuing_state", "MEX");
  body.append("identification_number", params.curp);

  const tieneExtra = !!(params.nombres || params.apellido_paterno);
  body.append("validation_type", tieneExtra ? "two_by_two" : "one_by_one");

  if (params.nombres) body.append("first_name", params.nombres);

  if (params.apellido_paterno) {
    const apellidos = [params.apellido_paterno, params.apellido_materno]
      .filter(Boolean)
      .join(" ");
    body.append("last_name", apellidos);
  }

  if (params.fecha_nacimiento) body.append("date_of_birth", params.fecha_nacimiento);

  return callDatabaseValidation(body);
}
