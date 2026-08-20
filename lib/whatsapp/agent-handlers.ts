/**
 * Handlers para las 6 herramientas del Groq Agent.
 *
 * Cada handler es llamado cuando Groq selecciona esa tool.
 * El backend valida y ejecuta; Groq NO tiene acceso directo a BD/email.
 *
 * FASE 1: Estructura definida. Algunos handlers aún sin lógica completa.
 */

import type {
  ToolName,
  ConsultarContextoContactoInput,
  ConsultarServiciosInput,
  ConsultarPortafolioInput,
  GuardarActualizarLeadInput,
  RegistrarRequerimientoInput,
  NotificarHumanoInput,
  ToolInput,
} from "@/lib/llm/tools";

import type {
  ConsultarContextoContactoResult,
  ConsultarServiciosResult,
  ConsultarPortafolioResult,
  GuardarActualizarLeadResult,
  RegistrarRequerimientoResult,
  NotificarHumanoResult,
  ToolResult,
} from "@/lib/llm/tool-results";

// ─── Handler 1: Consultar Contexto Contacto ─────────────────────────────────

async function handleConsultarContextoContacto(
  input: ConsultarContextoContactoInput
): Promise<ConsultarContextoContactoResult> {
  // TODO: Implementar
  // 1. Buscar en whatsapp_clientes si existe (activo=true)
  // 2. Buscar en whatsapp_leads si existe
  // 3. Obtener últimos 3-5 mensajes de whatsapp_mensajes
  // 4. Compilar resultado

  return {
    encontrado: false,
    es_cliente: false,
    es_lead: false,
    razon: "[STUB] Handler no implementado aún",
  };
}

// ─── Handler 2: Consultar Servicios ────────────────────────────────────────

async function handleConsultarServicios(
  input: ConsultarServiciosInput
): Promise<ConsultarServiciosResult> {
  // TODO: Implementar
  // Por ahora, retornar lista de servicios hardcoded de Nasus
  // Futuros cambios pueden venir de base de datos

  const servicios = [
    {
      nombre: "Validador de Documentos",
      descripcion: "Valida documentos oficiales mexicanos (INE, CURP, RFC, etc.)",
      categoria: "validacion",
    },
    {
      nombre: "Extractor de Facturas",
      descripcion: "Extrae datos estructurados de PDFs de facturas en Excel",
      categoria: "validacion",
    },
    {
      nombre: "Validador de Fotografías",
      descripcion: "Valida fotos para requisitos institucionales (pasaportes, visas, etc.)",
      categoria: "validacion",
    },
    {
      nombre: "Desarrollo Web/Apps",
      descripcion: "Desarrollo a medida de páginas web y aplicaciones",
      categoria: "desarrollo",
    },
    {
      nombre: "Automatización de Procesos",
      descripcion: "Automatiza workflows y procesos con IA",
      categoria: "automatizacion",
    },
    {
      nombre: "Ecosistemas de Marketing",
      descripcion: "Integración de herramientas de marketing y CRM",
      categoria: "marketing",
    },
  ];

  const filtered = input.categoria
    ? servicios.filter((s) => s.categoria === input.categoria)
    : servicios;

  return {
    servicios: filtered,
    total: filtered.length,
  };
}

// ─── Handler 3: Consultar Portafolio ─────────────────────────────────────────

async function handleConsultarPortafolio(
  input: ConsultarPortafolioInput
): Promise<ConsultarPortafolioResult> {
  // TODO: Implementar
  // Por ahora, retornar lista de proyectos públicos de ejemplo
  // Futuros cambios pueden venir de base de datos o CLAUDE.md

  const proyectos = [
    {
      nombre: "Universidad Autónoma de Guadalajara (UAG)",
      descripcion: "Sistema de validación de documentos para admisión",
      cliente: "UAG",
      resultado: "API v1.0 lista, validadores configurados",
    },
    {
      nombre: "Automatización de Facturas",
      descripcion: "Extractor de facturas PDF → Excel con Claude",
      cliente: "Clientes B2B",
      resultado: "Herramienta en producción",
    },
  ];

  return {
    proyectos,
    total: proyectos.length,
  };
}

// ─── Handler 4: Guardar / Actualizar Lead ──────────────────────────────────

async function handleGuardarActualizarLead(
  input: GuardarActualizarLeadInput
): Promise<GuardarActualizarLeadResult> {
  // TODO: Implementar
  // 1. Validar numero (formato)
  // 2. Buscar lead existente por numero
  // 3. Crear o actualizar en whatsapp_leads
  // 4. Actualizar timestamps

  return {
    exito: false,
    lead_id: "",
    operacion: "creado",
    mensaje: "[STUB] Handler no implementado aún",
    error: "Handler en desarrollo",
  };
}

// ─── Handler 5: Registrar Requerimiento ───────────────────────────────────

async function handleRegistrarRequerimiento(
  input: RegistrarRequerimientoInput
): Promise<RegistrarRequerimientoResult> {
  // TODO: Implementar
  // 1. Validar inputs
  // 2. Crear en whatsapp_requerimientos
  // 3. Opcionalmente enviar email (Resend)
  // 4. Retornar ID del requerimiento creado

  return {
    exito: false,
    requerimiento_id: "",
    mensaje: "[STUB] Handler no implementado aún",
    guardado_en_bd: false,
    error: "Handler en desarrollo",
  };
}

// ─── Handler 6: Notificar Humano ──────────────────────────────────────────

async function handleNotificarHumano(
  input: NotificarHumanoInput
): Promise<NotificarHumanoResult> {
  // TODO: Implementar
  // 1. Validar inputs (no enviar PII innecesaria)
  // 2. Usar Resend API para enviar email
  // 3. Registrar intento en logs
  // 4. Retornar éxito/fallo

  return {
    exito: false,
    mensaje: "[STUB] Handler no implementado aún",
    email_enviado: false,
    motivo_fallo: "Handler en desarrollo",
  };
}

// ─── Dispatcher ────────────────────────────────────────────────────────────

/**
 * Ejecuta el handler apropiado según el nombre de la tool.
 * Valida inputs, ejecuta, captura errores.
 */
export async function executeToolCall(
  toolName: ToolName,
  toolInput: Record<string, unknown>
): Promise<ToolResult> {
  try {
    switch (toolName) {
      case "consultar_contexto_contacto":
        return await handleConsultarContextoContacto(
          toolInput as unknown as ConsultarContextoContactoInput
        );

      case "consultar_servicios":
        return await handleConsultarServicios(
          toolInput as unknown as ConsultarServiciosInput
        );

      case "consultar_portafolio":
        return await handleConsultarPortafolio(
          toolInput as unknown as ConsultarPortafolioInput
        );

      case "guardar_actualizar_lead":
        return await handleGuardarActualizarLead(
          toolInput as unknown as GuardarActualizarLeadInput
        );

      case "registrar_requerimiento":
        return await handleRegistrarRequerimiento(
          toolInput as unknown as RegistrarRequerimientoInput
        );

      case "notificar_humano":
        return await handleNotificarHumano(
          toolInput as unknown as NotificarHumanoInput
        );

      default:
        const never: never = toolName;
        throw new Error(`unknown_tool:${String(never)}`);
    }
  } catch (err) {
    console.error(
      `[agent-handlers] error en ${toolName}:`,
      err instanceof Error ? err.message : String(err)
    );

    // Retornar resultado genérico de error según el tipo de tool
    // Para simplificar, retornar un resultado básico
    const resultado = {
      exito: false,
      mensaje: `Error ejecutando ${toolName}`,
      error:
        err instanceof Error
          ? err.message
          : "Error desconocido",
    };

    return resultado as unknown as ToolResult;
  }
}
