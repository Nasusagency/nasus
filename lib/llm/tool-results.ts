/**
 * Tipos de respuesta para cada herramienta.
 * Usado para tipar los handlers y validar outputs.
 *
 * Nota: Algunos handlers devuelven { exito, mensaje }, otros devuelven
 * información específica. Todos usan ToolResult que es una union.
 */

// ─── Tool 1: Consultar Contexto Contacto ────────────────────────────────────

export interface ConsultarContextoContactoResult {
  encontrado: boolean;
  es_cliente: boolean;
  es_lead: boolean;

  cliente?: {
    numero: string;
    nombre_negocio: string;
    contexto_negocio: string;
  };

  lead?: {
    numero: string;
    nombre_contacto?: string;
    nombre_empresa?: string;
    stage: "exploring" | "opportunity" | "qualified" | "high_intent";
    problema_descrito?: string;
    servicio_probable?: string;
    resumen?: string;
    requiere_humano: boolean;
  };

  mensajes_recientes?: Array<{
    direccion: "entrante" | "saliente";
    contenido?: string;
    created_at: string;
  }>;

  mensaje?: string;
  razon?: string;
}

// ─── Tool 2: Consultar Servicios ────────────────────────────────────────────

export interface ServicioNasus {
  nombre: string;
  descripcion: string;
  categoria: string;
}

export interface ConsultarServiciosResult {
  servicios: ServicioNasus[];
  total: number;
}

// ─── Tool 3: Consultar Portafolio ───────────────────────────────────────────

export interface ProyectoPortafolio {
  nombre: string;
  descripcion: string;
  cliente?: string;
  resultado?: string;
}

export interface ConsultarPortafolioResult {
  proyectos: ProyectoPortafolio[];
  total: number;
}

// ─── Tool 4: Guardar / Actualizar Lead ───────────────────────────────────────

export interface GuardarActualizarLeadResult {
  exito: boolean;
  lead_id: string;
  operacion: "creado" | "actualizado";
  mensaje: string;
  error?: string;
}

// ─── Tool 5: Registrar Requerimiento ─────────────────────────────────────────

export interface RegistrarRequerimientoResult {
  exito: boolean;
  requerimiento_id: string;
  mensaje: string;
  guardado_en_bd: boolean;
  error?: string;
}

// ─── Tool 6: Notificar Humano ───────────────────────────────────────────────

export interface NotificarHumanoResult {
  exito: boolean;
  mensaje: string;
  email_enviado: boolean;
  motivo_fallo?: string;
}

// ─── Union Type ──────────────────────────────────────────────────────────────

export type ToolResult =
  | ConsultarContextoContactoResult
  | ConsultarServiciosResult
  | ConsultarPortafolioResult
  | GuardarActualizarLeadResult
  | RegistrarRequerimientoResult
  | NotificarHumanoResult;
