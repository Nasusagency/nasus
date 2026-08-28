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
import { isHighIntentRequest, resolveGroqStage } from "@/lib/crm/domain";
import { recordCrmActivity, suggestClientConversion } from "@/lib/crm/service";

// ─── Idempotencia Persistente (Supabase) ────────────────────────────────────

function hashContent(content: string): string {
  let hash = 0;
  for (let i = 0; i < content.length; i++) {
    const char = content.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(36);
}

async function checkIdempotencyKey(
  toolName: string,
  key: string
): Promise<{ isDuplicate: boolean; result?: unknown }> {
  const supabase = createServiceClient();
  if (!supabase) return { isDuplicate: false };

  try {
    const { data, error } = await supabase
      .from("idempotency_keys")
      .select("result")
      .eq("key", key)
      .eq("tool_name", toolName)
      .maybeSingle();

    // Si tabla no existe (error PGRST116), permitir
    if (error && (error.code === "PGRST116" || error.message?.includes("does not exist"))) {
      console.warn("[idempotency] tabla idempotency_keys no existe, permitiendo operación");
      return { isDuplicate: false };
    }

    if (error) {
      console.warn("[idempotency] error al verificar key:", error);
      return { isDuplicate: false }; // Error = permitir (fail open)
    }

    if (data) {
      return { isDuplicate: true, result: data.result };
    }

    return { isDuplicate: false };
  } catch (err) {
    console.warn("[idempotency] excepción al verificar key:", err);
    return { isDuplicate: false }; // Error = permitir (fail open)
  }
}

async function storeIdempotencyResult(
  toolName: string,
  key: string,
  result: unknown
): Promise<void> {
  const supabase = createServiceClient();
  if (!supabase) return;

  try {
    const { error } = await supabase.from("idempotency_keys").insert({
      key,
      tool_name: toolName,
      result,
    });

    // Ignorar si tabla no existe o unique constraint
    if (error && !(error.code === "PGRST116" || error.code === "23505")) {
      console.warn("[idempotency] error al guardar result:", error);
    }
  } catch (err) {
    console.warn("[idempotency] excepción al guardar result:", err);
  }
}

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

    // El lifecycle CRM es la fuente principal; la tabla histórica queda como fallback.
    if (buscar_cliente) {
      const { data: crmClient } = await supabase.from("whatsapp_leads")
        .select("numero,nombre_empresa,resumen").eq("numero", numero)
        .eq("lifecycle", "client").maybeSingle();
      const { data: legacyClient } = crmClient ? { data: null } : await supabase
        .from("whatsapp_clientes").select("numero_whatsapp,nombre_negocio,contexto_negocio")
        .eq("numero_whatsapp", numero).eq("activo", true).maybeSingle();
      const cliente = crmClient ? {
        numero_whatsapp: crmClient.numero,
        nombre_negocio: crmClient.nombre_empresa || "Cliente Nasus",
        contexto_negocio: crmClient.resumen || "Cliente activo de Nasus",
      } : legacyClient;

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

    let contactId: string | null = null;
    if (buscar_lead) {
      const { data: lead } = await supabase
        .from("whatsapp_leads")
        .select(
          "id, numero, nombre_contacto, nombre_empresa, lifecycle, stage, high_intent_detected_at, problema_descrito, servicio_probable, resumen, requiere_humano"
        )
        .eq("numero", numero)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (lead) {
        contactId = lead.id;
        result.es_lead = true;
        result.encontrado = true;
        result.lead = {
          numero: lead.numero,
          nombre_contacto: lead.nombre_contacto || undefined,
          nombre_empresa: lead.nombre_empresa || undefined,
          stage: lead.stage,
          lifecycle: lead.lifecycle,
          high_intent: Boolean(lead.high_intent_detected_at),
          problema_descrito: lead.problema_descrito || undefined,
          servicio_probable: lead.servicio_probable || undefined,
          resumen: lead.resumen || undefined,
          requiere_humano: lead.requiere_humano,
        };
      }
    }

    if (contactId) {
      const [proposals, requirements, conversation] = await Promise.all([
        supabase.from("crm_proposals").select("id,status,title").eq("contact_id", contactId).in("status", ["draft", "sent"]).order("updated_at", { ascending: false }).limit(5),
        supabase.from("whatsapp_requerimientos").select("id,tipo,estado").eq("contact_id", contactId).in("estado", ["abierto", "en_revision", "asignado"]).order("updated_at", { ascending: false }).limit(10),
        supabase.from("whatsapp_conversations").select("mode").eq("numero", numero).order("updated_at", { ascending: false }).limit(1).maybeSingle(),
      ]);
      result.propuestas_activas = proposals.data ?? [];
      result.requerimientos_abiertos = requirements.data ?? [];
      result.conversation_mode = conversation.data?.mode;
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
  // Servicios aprobados de Nasus Agency (sin precios ni inventos)
  const servicios = [
    {
      nombre: "Páginas Web",
      descripcion: "Diseño y desarrollo de sitios web profesionales",
      categoria: "desarrollo",
    },
    {
      nombre: "Apps Web y Móviles",
      descripcion: "Aplicaciones escalables con tecnologías modernas",
      categoria: "desarrollo",
    },
    {
      nombre: "IA Aplicada a Procesos",
      descripcion: "Integración de inteligencia artificial en workflows existentes",
      categoria: "automatizacion",
    },
    {
      nombre: "Automatización de Procesos",
      descripcion: "Reducción de tareas manuales mediante software",
      categoria: "automatizacion",
    },
    {
      nombre: "CRM y Gestión",
      descripcion: "Sistemas de gestión de relaciones y datos de clientes",
      categoria: "gestion",
    },
    {
      nombre: "Ecosistemas de Marketing Digital",
      descripcion: "Integración de herramientas y estrategias de marketing",
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
  // Portafolio v1: Únicamente proyectos confirmados y en producción/avanzado
  const proyectos = [
    {
      nombre: "Sistema de Validación de Documentos (Universidad Autónoma de Guadalajara)",
      descripcion:
        "Plataforma de validación de documentos oficiales para procesos de admisión",
      cliente: "UAG",
      resultado:
        "API v1.0 en fase de integración. Validación de certificados, actas, fotografías.",
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
  const numeroMasked = input.numero ? input.numero.slice(0, 2) + "***" + input.numero.slice(-3) : "????";
  console.log(`[GROQ_TOOL] guardar_actualizar_lead requested | numero=${numeroMasked} stage=${input.stage}`);

  const supabase = createServiceClient();
  if (!supabase) {
    console.error(`[GROQ_TOOL] guardar_actualizar_lead error=no_supabase_client`);
    return {
      exito: false,
      lead_id: "",
      operacion: "creado",
      mensaje: "Servicio de base de datos no disponible",
      error: "No se pudo acceder a Supabase",
    };
  }

  try {
    const { numero, stage: requestedStage, sugerir_conversion, razon_sugerencia, ...data } = input;

    if (!numero || !numero.match(/^\d{10,15}$/)) {
      console.error(`[GROQ_TOOL] guardar_actualizar_lead error=invalid_number | numero=${numeroMasked}`);
      return {
        exito: false,
        lead_id: "",
        operacion: "creado",
        mensaje: "Número de teléfono inválido",
        error: "Formato inválido",
      };
    }

    console.log(`[GROQ_TOOL] guardar_actualizar_lead checking existing | payload_keys=${Object.keys({ ...data, stage: requestedStage }).join(',')}`);

    const { data: existing, error: checkError } = await supabase
      .from("whatsapp_leads")
      .select("id,stage,lifecycle,high_intent_detected_at")
      .eq("numero", numero)
      .maybeSingle();

    if (checkError) {
      console.error(`[GROQ_TOOL] guardar_actualizar_lead error=select_failed | code=${checkError.code} message=${checkError.message?.slice(0, 100)}`);
      throw checkError;
    }

    const operacion = existing ? "actualizado" : "creado";
    const now = new Date().toISOString();
    const highIntent = isHighIntentRequest(requestedStage, data.requiere_humano);
    const stage = resolveGroqStage(existing?.stage, requestedStage, existing?.lifecycle ?? "lead");
    console.log(
      `[GROQ_TOOL] guardar_actualizar_lead ${existing ? `updating existing lead | id=${existing.id}` : "creating new lead"}`,
    );

    // El índice único por numero hace atómica la decisión insert/update.
    // Sin esto, dos invocaciones concurrentes podían crear leads duplicados.
    const { data: persisted, error } = await supabase
      .from("whatsapp_leads")
      .upsert(
        {
          numero,
          stage,
          ...data,
          lifecycle: existing?.lifecycle ?? "lead",
          ...(highIntent ? { high_intent_detected_at: existing?.high_intent_detected_at ?? now, requiere_humano: true } : {}),
          updated_at: now,
          ultima_interaccion: now,
        },
        { onConflict: "numero" },
      )
      .select("id,stage,lifecycle,high_intent_detected_at")
      .single();

    if (error) {
      console.error(`[GROQ_TOOL] guardar_actualizar_lead error=upsert_failed | code=${error.code} message=${error.message?.slice(0, 100)}`);
      throw error;
    }

    console.log(`[GROQ_TOOL] guardar_actualizar_lead success=${operacion} | id=${persisted.id}`);
    if (!existing) {
      await recordCrmActivity({ contactId: persisted.id, eventType: "lead_created", actor: "groq", newValue: { lifecycle: "lead", stage }, idempotencyKey: `lead-created:${persisted.id}` }, supabase);
    } else if (existing.stage !== stage) {
      await recordCrmActivity({ contactId: persisted.id, eventType: "stage_changed", actor: "groq", oldValue: { stage: existing.stage }, newValue: { stage }, idempotencyKey: `stage:${persisted.id}:${existing.stage}:${stage}` }, supabase);
    }
    if (highIntent && !existing?.high_intent_detected_at) {
      await recordCrmActivity({ contactId: persisted.id, eventType: "high_intent_detected", actor: "groq", newValue: { high_intent: true }, idempotencyKey: `high-intent:${persisted.id}` }, supabase);
    }
    await recordCrmActivity({ contactId: persisted.id, eventType: "groq_action", actor: "groq", metadata: { action: "contact_upsert", operation: operacion }, idempotencyKey: `groq-upsert:${persisted.id}:${now}` }, supabase);
    if (sugerir_conversion && razon_sugerencia) {
      await suggestClientConversion({ contactId: persisted.id, reason: razon_sugerencia }, supabase);
    }
    return {
      exito: true,
      lead_id: persisted.id,
      operacion,
      mensaje: `Lead ${operacion} exitosamente`,
    };
  } catch (err) {
    console.error(`[GROQ_TOOL] guardar_actualizar_lead exception | error=${err instanceof Error ? err.message : String(err)}`);
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

    // Idempotencia: usar hash del contenido como clave (FAIL CLOSED)
    const contentHash = hashContent(
      `${numero_contacto}:${tipo}:${descripcion_original}`
    );
    const idempotencyKey = `req_${contentHash}`;

    // Verificar si ya fue procesado
    const { isDuplicate } = await checkIdempotencyKey(
      "registrar_requerimiento",
      idempotencyKey
    );

    if (isDuplicate) {
      return {
        exito: false,
        requerimiento_id: "",
        mensaje: "Requerimiento duplicado detectado (ya procesado)",
        guardado_en_bd: false,
        error: "Idempotencia: request duplicado",
      };
    }

    const { data: contact } = await supabase.from("whatsapp_leads")
      .select("id").eq("numero", numero_contacto).maybeSingle();
    const { data: created, error } = await supabase
      .from("whatsapp_requerimientos")
      .insert({
        numero_contacto,
        tipo,
        descripcion_original,
        resumen: resumen || descripcion_original.slice(0, 300),
        prioridad,
        estado: "abierto",
        contact_id: contact?.id ?? null,
        ...data,
      })
      .select("id,stage,lifecycle,high_intent_detected_at")
      .single();

    if (error) throw error;
    if (contact) await recordCrmActivity({
      contactId: contact.id,
      eventType: "requirement_created",
      actor: "groq",
      metadata: { requirement_id: created.id, type: tipo },
      idempotencyKey: `requirement-created:${created.id}`,
    }, supabase);

    const successResult: RegistrarRequerimientoResult = {
      exito: true,
      requerimiento_id: created.id,
      mensaje: `Requerimiento registrado exitosamente (${tipo})`,
      guardado_en_bd: true,
    };

    // Guardar en idempotency_keys solo si fue exitoso
    await storeIdempotencyResult(
      "registrar_requerimiento",
      idempotencyKey,
      successResult
    );

    return successResult;
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

    // Idempotencia: usar hash del contenido como clave (FAIL CLOSED)
    const contentHash = hashContent(`${asunto}:${cuerpo}:${numero_contacto || ""}`);
    const idempotencyKey = `email_${contentHash}`;

    // Verificar si ya fue procesado
    const { isDuplicate } = await checkIdempotencyKey(
      "notificar_humano",
      idempotencyKey
    );

    if (isDuplicate) {
      console.warn(
        "[agent-handlers] Email duplicado detectado (idempotencia):",
        asunto
      );
      return {
        exito: false,
        mensaje: "Email duplicado detectado (ya enviado)",
        email_enviado: false,
        motivo_fallo: "Idempotencia: request duplicado",
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

    const successResult: NotificarHumanoResult = {
      exito: true,
      mensaje: `Notificación enviada a ${to}`,
      email_enviado: true,
    };

    // Guardar en idempotency_keys solo si fue exitoso
    await storeIdempotencyResult(
      "notificar_humano",
      idempotencyKey,
      successResult
    );

    return successResult;
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
