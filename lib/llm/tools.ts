/**
 * Definiciones de herramientas para el Groq Agent v1.
 *
 * Estos son los únicos 6 tools disponibles en esta fase.
 * Handlers se implementan en lib/whatsapp/agent-handlers.ts.
 */

import type { LLMToolDefinition } from "./provider";

export type ToolName =
  | "consultar_contexto_contacto"
  | "consultar_servicios"
  | "consultar_portafolio"
  | "guardar_actualizar_lead"
  | "registrar_requerimiento"
  | "notificar_humano"
  | "consultar_estado_pago"
  | "consultar_pagos_pendientes"
  | "recuperar_link_pago_existente";

// ─── Tool 1: Consultar Contexto del Contacto ───────────────────────────────

export interface ConsultarContextoContactoInput {
  numero: string;
  buscar_lead?: boolean;
  buscar_cliente?: boolean;
}

export const consultarContextoContactoTool: LLMToolDefinition = {
  name: "consultar_contexto_contacto",
  description:
    "Obtiene información actual del contacto: si es cliente registrado, si existe como lead, historial, notas. Permite al agente entender qué sabemos del contacto antes de actuar.",
  input_schema: {
    type: "object",
    properties: {
      numero: {
        type: "string",
        description:
          "Número de teléfono del contacto. Formato: codigo_país + número sin espacios. Ej: 523312345678",
      },
      buscar_lead: {
        type: "boolean",
        description: "Si true, buscar registro en whatsapp_leads. Default: true",
      },
      buscar_cliente: {
        type: "boolean",
        description: "Si true, buscar registro en whatsapp_clientes. Default: true",
      },
    },
    required: ["numero"],
    additionalProperties: false,
  },
};

// ─── Tool 2: Consultar Servicios ───────────────────────────────────────────

export interface ConsultarServiciosInput {
  categoria?: string;
}

export const consultarServiciosTool: LLMToolDefinition = {
  name: "consultar_servicios",
  description:
    "Obtiene lista de servicios que ofrece Nasus Agency. Sirve para responder preguntas genéricas sobre qué hace la agencia.",
  input_schema: {
    type: "object",
    properties: {
      categoria: {
        type: "string",
        description:
          "Filtro opcional: 'validacion', 'automatizacion', 'desarrollo', etc. Si se omite, devuelve todos.",
      },
    },
    required: [],
    additionalProperties: false,
  },
};

// ─── Tool 3: Consultar Portafolio ──────────────────────────────────────────

export interface ConsultarPortafolioInput {
  filtro?: string;
}

export const consultarPortafolioTool: LLMToolDefinition = {
  name: "consultar_portafolio",
  description:
    "Obtiene ejemplos de trabajos anteriores, clientes o proyectos públicos de Nasus. Sirve para demostrar capacidades.",
  input_schema: {
    type: "object",
    properties: {
      filtro: {
        type: "string",
        description:
          "Filtro opcional por tipo de proyecto, industria o caso de uso. Ej: 'validacion_documentos', 'automatizacion', etc.",
      },
    },
    required: [],
    additionalProperties: false,
  },
};

// ─── Tool 4: Guardar / Actualizar Lead ──────────────────────────────────────

export interface GuardarActualizarLeadInput {
  numero: string;
  nombre_contacto?: string;
  nombre_empresa?: string;
  sector?: string;
  stage: "exploring" | "opportunity" | "qualified";
  problema_descrito?: string;
  servicio_probable?: string;
  resumen?: string;
  requiere_humano?: boolean;
  razon_handoff?: string;
  sugerir_conversion?: boolean;
  razon_sugerencia?: string;
  datos_estructurados?: Record<string, unknown>;
}

export const guardarActualizarLeadTool: LLMToolDefinition = {
  name: "guardar_actualizar_lead",
  description:
    "Crea o actualiza un registro de prospecto (lead) en la base de datos. Permite persistir información del pipeline de ventas.",
  input_schema: {
    type: "object",
    properties: {
      nombre_contacto: {
        type: "string",
        description: "Nombre de la persona de contacto, si se conoce.",
      },
      nombre_empresa: {
        type: "string",
        description: "Nombre de la empresa o negocio del prospecto.",
      },
      sector: {
        type: "string",
        description: "Sector/industria: 'retail', 'servicios', 'fintech', etc.",
      },
      stage: {
        type: "string",
        enum: ["exploring", "opportunity", "qualified"],
        description:
          "Etapa automática: exploring → opportunity → qualified. La alta intención se expresa con requiere_humano; proposal/won/lost no los decide Groq.",
      },
      problema_descrito: {
        type: "string",
        description: "Problema o necesidad que mencionó el prospecto.",
      },
      servicio_probable: {
        type: "string",
        description:
          "Servicio de Nasus que probablemente resuelve su necesidad.",
      },
      resumen: {
        type: "string",
        description: "Resumen breve del contexto del lead (máx 500 chars).",
      },
      requiere_humano: {
        type: "boolean",
        description:
          "Si true, marca que necesita intervención de asesor humano (no es etapa, es bandera).",
      },
      razon_handoff: {
        type: "string",
        description: "Razón por la que requiere humano (si requiere_humano=true).",
      },
      sugerir_conversion: {
        type: "boolean",
        description: "Solo si el contacto parece aceptar una propuesta. Crea una recomendación para revisión humana; nunca convierte al contacto.",
      },
      razon_sugerencia: {
        type: "string",
        description: "Razón breve y verificable para recomendar la conversión.",
      },
      datos_estructurados: {
        type: "object",
        description:
          "JSON libre con información adicional estructurada (presupuesto estimado, timeline, etc.)",
      },
    },
    required: ["stage"],
    additionalProperties: false,
  },
};

// ─── Tool 5: Registrar Requerimiento ────────────────────────────────────────

export interface RegistrarRequerimientoInput {
  numero_contacto: string;
  tipo: "ajuste" | "nuevo_feature" | "problema" | "consulta";
  descripcion_original: string;
  resumen?: string;
  seccion_o_pagina?: string;
  prioridad?: "baja" | "media" | "alta";
  cliente_slug?: string;
  proyecto?: string;
  conversation_id?: string;
  tiene_imagen?: boolean;
  url_imagen?: string;
  datos_adicionales?: Record<string, unknown>;
}

export const registrarRequerimientoTool: LLMToolDefinition = {
  name: "registrar_requerimiento",
  description:
    "Crea un ticket/requerimiento en la base de datos cuando un cliente (o prospecto calificado) pide algo específico. El requerimiento se persiste antes de enviar email.",
  input_schema: {
    type: "object",
    properties: {
      tipo: {
        type: "string",
        enum: ["ajuste", "nuevo_feature", "problema", "consulta"],
        description: "Tipo de solicitud.",
      },
      descripcion_original: {
        type: "string",
        description: "Lo que el contacto describió (casi textual).",
      },
      resumen: {
        type: "string",
        description: "Resumen estructurado de la solicitud (máx 300 chars).",
      },
      seccion_o_pagina: {
        type: "string",
        description: "Parte del producto afectada, si aplica.",
      },
      prioridad: {
        type: "string",
        enum: ["baja", "media", "alta"],
        description:
          "Urgencia estimada: alta (está caído), media (funciona mal), baja (mejora).",
      },
      proyecto: {
        type: "string",
        description: "Nombre del proyecto/producto relacionado.",
      },
      tiene_imagen: {
        type: "boolean",
        description: "Si la solicitud incluye imagen.",
      },
      url_imagen: {
        type: "string",
        description: "URL de Graph para descargar imagen (caduca en minutos).",
      },
      datos_adicionales: {
        type: "object",
        description: "JSON libre con información técnica o contexto extra.",
      },
    },
    required: ["tipo", "descripcion_original"],
    additionalProperties: false,
  },
};

// ─── Tool 6: Notificar Humano ──────────────────────────────────────────────

export interface NotificarHumanoInput {
  asunto: string;
  cuerpo: string;
  numero_contacto?: string;
  nombre_contacto?: string;
  tipo?: "escalacion" | "nueva_solicitud" | "otro";
}

export const notificarHumanoTool: LLMToolDefinition = {
  name: "notificar_humano",
  description:
    "Envía una notificación por email al equipo de Nasus (nasusagency@gmail.com) para escalar o reportar algo que requiere atención humana. Ejemplos: pide hablar con asesor, requiere autorización ejecutiva, caso especial.",
  input_schema: {
    type: "object",
    properties: {
      asunto: {
        type: "string",
        description:
          "Línea de asunto concisa para el email. Ej: 'Escalación: cliente pide asesor'",
      },
      cuerpo: {
        type: "string",
        description:
          "Cuerpo del email con contexto para el equipo (máx 1000 chars). Sin incluir datos sensibles del usuario a menos que sea necesario.",
      },
      nombre_contacto: {
        type: "string",
        description: "Nombre del contacto para referencia.",
      },
      tipo: {
        type: "string",
        enum: ["escalacion", "nueva_solicitud", "otro"],
        description:
          "Categoría de la notificación, para ayudar al equipo a priorizar.",
      },
    },
    required: ["asunto", "cuerpo"],
    additionalProperties: false,
  },
};

// ─── Tool 7: Consultar Estado de Pago ──────────────────────────────────────

export interface ConsultarEstadoPagoInput {
  numero: string;
  payment_id?: string;
}

export const consultarEstadoPagoTool: LLMToolDefinition = {
  name: "consultar_estado_pago",
  description:
    "Consulta el estado real de un pago del contacto (pending/paid/failed/cancelled/refunded). Usar cuando el contacto pregunta si ya se registró su pago. El estado viene siempre del backend/proveedor de pagos, nunca se debe inventar ni asumir 'pagado' sin este resultado.",
  input_schema: {
    type: "object",
    properties: {
      payment_id: {
        type: "string",
        description:
          "Id del pago específico a consultar, si se conoce (de una consulta previa). Si se omite, se consulta el pago más reciente del contacto.",
      },
    },
    required: [],
    additionalProperties: false,
  },
};

// ─── Tool 8: Consultar Pagos Pendientes ─────────────────────────────────────

export interface ConsultarPagosPendientesInput {
  numero: string;
}

export const consultarPagosPendientesTool: LLMToolDefinition = {
  name: "consultar_pagos_pendientes",
  description:
    "Lista los pagos pendientes (status=pending) del contacto: monto, moneda, descripción, vencimiento y link de pago. Usar cuando el contacto pregunta qué debe pagar o cuánto falta.",
  input_schema: {
    type: "object",
    properties: {},
    required: [],
    additionalProperties: false,
  },
};

// ─── Tool 9: Recuperar Link de Pago Existente ───────────────────────────────

export interface RecuperarLinkPagoExistenteInput {
  numero: string;
  payment_id?: string;
}

export const recuperarLinkPagoExistenteTool: LLMToolDefinition = {
  name: "recuperar_link_pago_existente",
  description:
    "Reenvía el link de un pago pendiente YA CREADO (no crea un pago nuevo, no genera cargos, no cambia montos). Usar cuando el contacto pide de nuevo el link de pago o dice que lo perdió.",
  input_schema: {
    type: "object",
    properties: {
      payment_id: {
        type: "string",
        description:
          "Id del pago pendiente a reenviar, si se conoce. Si se omite, se reenvía el pago pendiente más reciente del contacto.",
      },
    },
    required: [],
    additionalProperties: false,
  },
};

/**
 * Array con todas las definiciones de tools.
 * Ordenadas: consultar (sin estado) → guardar (con estado) → notificar (salida).
 */
export const ALL_TOOLS: LLMToolDefinition[] = [
  consultarServiciosTool,
  consultarPortafolioTool,
  guardarActualizarLeadTool,
  registrarRequerimientoTool,
  notificarHumanoTool,
  consultarEstadoPagoTool,
  consultarPagosPendientesTool,
  recuperarLinkPagoExistenteTool,
];

/**
 * Tipos de input por nombre de tool.
 * Usado para tipado en handlers.
 */
export type ToolInput<T extends ToolName> = T extends "consultar_contexto_contacto"
  ? ConsultarContextoContactoInput
  : T extends "consultar_servicios"
    ? ConsultarServiciosInput
    : T extends "consultar_portafolio"
      ? ConsultarPortafolioInput
      : T extends "guardar_actualizar_lead"
        ? GuardarActualizarLeadInput
        : T extends "registrar_requerimiento"
          ? RegistrarRequerimientoInput
          : T extends "notificar_humano"
            ? NotificarHumanoInput
            : T extends "consultar_estado_pago"
              ? ConsultarEstadoPagoInput
              : T extends "consultar_pagos_pendientes"
                ? ConsultarPagosPendientesInput
                : T extends "recuperar_link_pago_existente"
                  ? RecuperarLinkPagoExistenteInput
                  : never;
