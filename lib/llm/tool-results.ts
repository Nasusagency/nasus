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
    stage: "exploring" | "opportunity" | "qualified" | "proposal" | "won" | "lost";
    lifecycle?: "lead" | "client" | "former_client";
    high_intent?: boolean;
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

  propuestas_activas?: Array<{ id: string; status: string; title: string }>;
  requerimientos_abiertos?: Array<{ id: string; tipo: string; estado: string }>;
  conversation_mode?: "ai" | "human" | "paused";

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

// ─── Tool 7: Consultar Estado de Pago ───────────────────────────────────────

export type PaymentStatusCode = "pending" | "paid" | "failed" | "cancelled" | "refunded";

export interface ConsultarEstadoPagoResult {
  encontrado: boolean;
  payment_id?: string;
  status?: PaymentStatusCode;
  monto?: number;
  moneda?: string;
  descripcion?: string;
  pagado_en?: string | null;
  mensaje?: string;
}

// ─── Tool 8: Consultar Pagos Pendientes ─────────────────────────────────────

export interface PagoPendiente {
  payment_id: string;
  monto: number;
  moneda: string;
  descripcion: string;
  vence?: string | null;
  link_pago?: string | null;
}

export interface ConsultarPagosPendientesResult {
  encontrado: boolean;
  pagos: PagoPendiente[];
  total: number;
}

// ─── Tool 9: Recuperar Link de Pago Existente ───────────────────────────────

export interface RecuperarLinkPagoExistenteResult {
  encontrado: boolean;
  link_pago?: string;
  monto?: number;
  moneda?: string;
  descripcion?: string;
  mensaje?: string;
}

// ─── Union Type ──────────────────────────────────────────────────────────────

export type ToolResult =
  | ConsultarContextoContactoResult
  | ConsultarServiciosResult
  | ConsultarPortafolioResult
  | GuardarActualizarLeadResult
  | RegistrarRequerimientoResult
  | NotificarHumanoResult
  | ConsultarEstadoPagoResult
  | ConsultarPagosPendientesResult
  | RecuperarLinkPagoExistenteResult;
