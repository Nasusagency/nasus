/**
 * Handlers para las 6 herramientas del Groq Agent.
 *
 * Cada handler es llamado cuando Groq selecciona esa tool.
 * El backend valida y ejecuta; Groq NO tiene acceso directo a BD/email.
 */

import { createServiceClient } from "@/lib/supabase/service";
import type {
  ToolName,
  ConsultarContextoContactoInput,
  ConsultarServiciosInput,
  ConsultarPortafolioInput,
  GuardarActualizarLeadInput,
  RegistrarRequerimientoInput,
  NotificarHumanoInput,
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
  const supabase = createServiceClient();
  if (!supabase) {
    return {
      encontrado: false,
      es_cliente: false,
      es_lead: false,
      razon: "Servicio de base de datos no disponible",
    };
  }

  try {
    const { numero, buscar_lead = true, buscar_cliente = true } = input;

    // Validar número (básico)
    if (!numero || !numero.match(/^\d{10,15}$/)) {
      return {
        encontrado: false,
        es_cliente: false,
        es_lead: false,
        razon: "Número de teléfono inválido",
      };
    }

    const result: ConsultarContextoContactoResult = {
      encontrado: false,
      es_cliente: false,
      es_lead: false,
    };

    // Buscar cliente
    if (buscar_cliente) {
      const { data: cliente } = await supabase
        .from("whatsapp_clientes")
        .select("numero_whatsapp, nombre_negocio, contexto_negocio")
        .eq("numero_whatsapp", numero)
        .eq("activo", true)
        .maybeSingle();

      if (cliente) {
        result.es_cliente = true;
        result.encontrado = true;
        result.cliente = {
          numero: cliente.numero_whatsapp,
          nombre_negocio: cliente.nombre_negocio,
          contexto_negocio: cliente.contexto_negocio,
        };
      }
    }

    // Buscar lead
    if (buscar_lead) {
      const { data: lead } = await supabase
        .from("whatsapp_leads")
        .select(
          "numero, nombre_contacto, nombre_empresa, stage, problema_descrito, servicio_probable, resumen, requiere_humano"
        )
        .eq("numero", numero)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (lead) {
        result.es_lead = true;
        result.encontrado = true;
        result.lead = {
          numero: lead.numero,
          nombre_contacto: lead.nombre_contacto || undefined,
          nombre_empresa: lead.nombre_empresa || undefined,
          stage: lead.stage,
          problema_descrito: lead.problema_descrito || undefined,
          servicio_probable: lead.servicio_probable || undefined,
          resumen: lead.resumen || undefined,
          requiere_humano: lead.requiere_humano,
        };
      }
    }

    // Obtener últimos 3 mensajes
    const { data: mensajes } = await supabase
      .from("whatsapp_mensajes")
      .select("direccion, contenido, created_at")
      .eq("numero", numero)
      .order("created_at", { ascending: false })
      .limit(3);

    if (mensajes && mensajes.length > 0) {
      result.mensajes_recientes = mensajes.reverse().map((m: any) => ({
        direccion: m.direccion,
        contenido: m.contenido,
        created_at: m.created_at,
      }));
    }

    return result;
  } catch (err) {
    console.error("[agent-handlers] error en consultar_contexto_contacto:", err);
    return {
      encontrado: false,
      es_cliente: false,
      es_lead: false,
      razon:
        err instanceof Error ? err.message : "Error al consultar contexto",
      mensaje: "Error interno al consultar información",
    };
  }
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
  const supabase = createServiceClient();
  if (!supabase) {
    return {
      exito: false,
      lead_id: "",
      operacion: "creado",
      mensaje: "Servicio de base de datos no disponible",
      error: "No se pudo acceder a Supabase",
    };
  }

  try {
    const { numero, stage, ...data } = input;

    if (!numero || !numero.match(/^\d{10,15}$/)) {
      return {
        exito: false,
        lead_id: "",
        operacion: "creado",
        mensaje: "Número de teléfono inválido",
        error: "Formato inválido",
      };
    }

    const { data: existing } = await supabase
      .from("whatsapp_leads")
      .select("id")
      .eq("numero", numero)
      .maybeSingle();

    if (existing) {
      const { data: updated, error } = await supabase
        .from("whatsapp_leads")
        .update({
          ...data,
          stage,
          updated_at: new Date().toISOString(),
          ultima_interaccion: new Date().toISOString(),
        })
        .eq("numero", numero)
        .select("id")
        .single();

      if (error) throw error;

      return {
        exito: true,
        lead_id: updated.id,
        operacion: "actualizado",
        mensaje: `Lead ${numero} actualizado exitosamente`,
      };
    } else {
      const { data: created, error } = await supabase
        .from("whatsapp_leads")
        .insert({
          numero,
          stage,
          ...data,
        })
        .select("id")
        .single();

      if (error) throw error;

      return {
        exito: true,
        lead_id: created.id,
        operacion: "creado",
        mensaje: `Lead ${numero} creado exitosamente`,
      };
    }
  } catch (err) {
    console.error("[agent-handlers] error en guardar_actualizar_lead:", err);
    return {
      exito: false,
      lead_id: "",
      operacion: "creado",
      mensaje: "Error al guardar lead",
      error: err instanceof Error ? err.message : "Error desconocido",
    };
  }
}

// ─── Handler 5: Registrar Requerimiento ───────────────────────────────────

async function handleRegistrarRequerimiento(
  input: RegistrarRequerimientoInput
): Promise<RegistrarRequerimientoResult> {
  const supabase = createServiceClient();
  if (!supabase) {
    return {
      exito: false,
      requerimiento_id: "",
      mensaje: "Servicio de base de datos no disponible",
      guardado_en_bd: false,
      error: "No se pudo acceder a Supabase",
    };
  }

  try {
    const {
      numero_contacto,
      tipo,
      descripcion_original,
      resumen,
      prioridad = "media",
      ...data
    } = input;

    if (!numero_contacto || !numero_contacto.match(/^\d{10,15}$/)) {
      return {
        exito: false,
        requerimiento_id: "",
        mensaje: "Número de teléfono inválido",
        guardado_en_bd: false,
        error: "Formato inválido",
      };
    }

    if (!tipo || !descripcion_original) {
      return {
        exito: false,
        requerimiento_id: "",
        mensaje: "Campos requeridos: tipo, descripcion_original",
        guardado_en_bd: false,
        error: "Datos incompletos",
      };
    }

    const { data: created, error } = await supabase
      .from("whatsapp_requerimientos")
      .insert({
        numero_contacto,
        tipo,
        descripcion_original,
        resumen: resumen || descripcion_original.slice(0, 300),
        prioridad,
        estado: "abierto",
        ...data,
      })
      .select("id")
      .single();

    if (error) throw error;

    return {
      exito: true,
      requerimiento_id: created.id,
      mensaje: `Requerimiento registrado exitosamente (${tipo})`,
      guardado_en_bd: true,
    };
  } catch (err) {
    console.error("[agent-handlers] error en registrar_requerimiento:", err);
    return {
      exito: false,
      requerimiento_id: "",
      mensaje: "Error al registrar requerimiento",
      guardado_en_bd: false,
      error: err instanceof Error ? err.message : "Error desconocido",
    };
  }
}

// ─── Handler 6: Notificar Humano ──────────────────────────────────────────

async function handleNotificarHumano(
  input: NotificarHumanoInput
): Promise<NotificarHumanoResult> {
  try {
    const { asunto, cuerpo, numero_contacto, nombre_contacto, tipo = "otro" } = input;

    if (!asunto || !cuerpo) {
      return {
        exito: false,
        mensaje: "Campos requeridos: asunto, cuerpo",
        email_enviado: false,
        motivo_fallo: "Datos incompletos",
      };
    }

    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      console.warn("[agent-handlers] RESEND_API_KEY sin configurar: notificación no enviada");
      return {
        exito: false,
        mensaje: "Servicio de notificación no configurado",
        email_enviado: false,
        motivo_fallo: "RESEND_API_KEY falta",
      };
    }

    const cuerpoConContexto = [
      `[${tipo.toUpperCase()}]`,
      "",
      cuerpo,
      ...(numero_contacto ? [`\nNúmero: +${numero_contacto}`] : []),
      ...(nombre_contacto ? [`Nombre: ${nombre_contacto}`] : []),
      `\nFecha: ${new Date().toISOString()}`,
    ].join("\n");

    const from = process.env.NOTIFY_FROM || "Nasus Agency <onboarding@resend.dev>";
    const to = "nasusagency@gmail.com";

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        authorization: `Bearer ${apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [to],
        subject: asunto,
        text: cuerpoConContexto,
      }),
      signal: AbortSignal.timeout(10_000),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`resend_failed:${res.status}:${errText.slice(0, 100)}`);
    }

    return {
      exito: true,
      mensaje: `Notificación enviada a ${to}`,
      email_enviado: true,
    };
  } catch (err) {
    console.error("[agent-handlers] error en notificar_humano:", err);
    return {
      exito: false,
      mensaje: "Error al enviar notificación",
      email_enviado: false,
      motivo_fallo: err instanceof Error ? err.message : "Error desconocido",
    };
  }
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
