import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { anthropic } from "@/lib/anthropic/client";
import { verifyAdminToken, ADMIN_COOKIE } from "@/lib/admin/auth";
import { getCliente } from "@/lib/admin/data";

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
  let clienteSlug: string | undefined;
  try {
    const body = (await req.json()) as { contexto?: string; clienteSlug?: string };
    contexto = body.contexto ?? "";
    clienteSlug = body.clienteSlug;
  } catch {
    return NextResponse.json({ error: "Cuerpo inválido." }, { status: 400 });
  }

  let userMessage = contexto.trim();
  if (clienteSlug) {
    const cliente = getCliente(clienteSlug);
    if (cliente) {
      const meta = [
        `Cliente: ${cliente.nombre}`,
        `Contacto: ${cliente.contacto}`,
        cliente.sistema ? `Sistema: ${cliente.sistema}` : "",
        cliente.modalidad ? `Modalidad: ${cliente.modalidad}` : "",
        cliente.modelo_cobro ? `Modelo de cobro: ${cliente.modelo_cobro}` : "",
        cliente.documentos?.length
          ? `Documentos a validar: ${cliente.documentos.join(", ")}`
          : "",
        cliente.endpoints?.length
          ? `Endpoints disponibles: ${cliente.endpoints.map((e) => `${e.ruta} v${e.version} (${e.estado})`).join(", ")}`
          : "",
        cliente.notas ? `Notas internas: ${cliente.notas}` : "",
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

  const stream = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 4096,
    system: [{ type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
    messages: [{ role: "user", content: userMessage }],
    stream: true,
  });

  const encoder = new TextEncoder();
  const readable = new ReadableStream({
    async start(controller) {
      try {
        for await (const event of stream) {
          if (
            event.type === "content_block_delta" &&
            event.delta.type === "text_delta"
          ) {
            controller.enqueue(encoder.encode(event.delta.text));
          }
        }
      } finally {
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
    },
  });
}
