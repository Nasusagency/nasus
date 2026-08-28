import { NextRequest, NextResponse } from "next/server";
import { getAnthropic } from "@/lib/anthropic/client";
import { verifyAdminToken, ADMIN_COOKIE } from "@/lib/admin/auth";
import { createServiceClient } from "@/lib/supabase/service";
import { createCrmProposal } from "@/lib/crm/service";

const MODEL = "claude-sonnet-4-6";

const SYSTEM_PROMPT = `Eres el redactor de propuestas de Nasus Agency, una agencia mexicana de automatización con IA.

Escribe propuestas B2B en español: profesionales, concisas y persuasivas.
Usa lenguaje claro — técnico pero accesible para directivos no técnicos.

Estructura siempre la propuesta con estas secciones en markdown:
# [Título de la propuesta]
## Resumen Ejecutivo
## El Problema
## Nuestra Solución
## Alcance Técnico y Entregables
## Modelo de Cobro
## Cronograma Estimado
## Por Qué Nasus Agency
## Próximos Pasos

Sé específico con lo que se entrega. Evita frases genéricas.
Incluye datos técnicos reales cuando los tengas (endpoints, tiempos, documentos).
El tono es de socio estratégico, no de vendedor.`;

export async function POST(req: NextRequest) {
  const token = req.cookies.get(ADMIN_COOKIE)?.value;
  if (!token || !(await verifyAdminToken(token))) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  let contexto: string;
  let contactId: string | undefined;
  try {
    const body = (await req.json()) as { contexto?: string; contactId?: string };
    contexto = body.contexto ?? "";
    contactId = body.contactId;
  } catch {
    return NextResponse.json({ error: "Cuerpo inválido." }, { status: 400 });
  }

  let userMessage = contexto.trim();
  if (contactId) {
    const database = createServiceClient();
    if (!database) return NextResponse.json({ error: "Base de datos no disponible." }, { status: 503 });
    const { data: cliente } = await database.from("whatsapp_leads")
      .select("nombre_contacto,nombre_empresa,sector,problema_descrito,servicio_probable,resumen,datos_estructurados,lifecycle,stage")
      .eq("id", contactId).maybeSingle();
    if (cliente) {
      const meta = [
        `Empresa: ${cliente.nombre_empresa || "Sin empresa"}`,
        `Contacto: ${cliente.nombre_contacto || "Sin nombre"}`,
        cliente.sector ? `Sector: ${cliente.sector}` : "",
        cliente.problema_descrito ? `Problema: ${cliente.problema_descrito}` : "",
        cliente.servicio_probable ? `Servicio probable: ${cliente.servicio_probable}` : "",
        cliente.resumen ? `Resumen CRM: ${cliente.resumen}` : "",
        `Lifecycle: ${cliente.lifecycle}; stage: ${cliente.stage}`,
        contexto ? `\nContexto adicional: ${contexto}` : "",
      ]
        .filter(Boolean)
        .join("\n");
      userMessage = meta;
    }
  }

  if (!userMessage) {
    return NextResponse.json(
      { error: "Proporciona contexto o selecciona un cliente." },
      { status: 400 }
    );
  }

  const stream = await getAnthropic().messages.create({
    model: MODEL,
    max_tokens: 4096,
    system: [{ type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
    messages: [{ role: "user", content: userMessage }],
    stream: true,
  });

  const encoder = new TextEncoder();
  const generatedSlug = contactId ? `proposal-${crypto.randomUUID()}` : "";
  const readable = new ReadableStream({
    async start(controller) {
      let generatedContent = "";
      try {
        for await (const event of stream) {
          if (
            event.type === "content_block_delta" &&
            event.delta.type === "text_delta"
          ) {
            generatedContent += event.delta.text;
            controller.enqueue(encoder.encode(event.delta.text));
          }
        }
      } finally {
        if (contactId && generatedContent.trim()) {
          const firstLine = generatedContent.split("\n").find(line => line.trim())?.replace(/^#+\s*/, "").trim();
          await createCrmProposal({ contactId, slug: generatedSlug, title: firstLine || "Propuesta generada", content: generatedContent, actorUserId: process.env.ADMIN_ACTOR || "admin" });
        }
        controller.close();
      }
    },
    cancel() {
      stream.controller.abort();
    },
  });

  return new NextResponse(readable, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "X-Accel-Buffering": "no",
      "Cache-Control": "no-cache",
      ...(generatedSlug ? { "X-Proposal-Slug": generatedSlug } : {}),
    },
  });
}
