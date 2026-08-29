import { describe, test } from "node:test";
import assert from "node:assert/strict";

import { ensureLeadPersisted } from "@/lib/whatsapp/agent-handlers";
import type { ToolName } from "@/lib/llm/tools";
import type { ToolResult } from "@/lib/llm/tool-results";

const numero = "523331234567";

/**
 * Reproduce el bug real: una conversación de un prospecto nuevo pasa por el
 * flujo "Claude clásico" (número no autorizado para Groq, el default para
 * casi todo el tráfico), que responde normalmente pero nunca invocaba
 * guardar_actualizar_lead. ensureLeadPersisted es la red de seguridad
 * determinista agregada en `app/api/whatsapp/webhook/route.ts` para que esto
 * ya no dependa de que un LLM decida llamar la tool.
 */
describe("ensureLeadPersisted — red de seguridad determinista", () => {
  test("crea el lead automáticamente para un prospecto nuevo, sin que ningún LLM haya invocado la tool", async () => {
    const leads = new Map<string, Record<string, unknown>>();
    let guardarCalls = 0;

    const executeToolCall = async (
      name: ToolName,
      input: Record<string, unknown>
    ): Promise<ToolResult> => {
      if (name === "consultar_contexto_contacto") {
        const lead = leads.get(String(input.numero));
        return { encontrado: Boolean(lead), es_cliente: false, es_lead: Boolean(lead) };
      }
      if (name === "guardar_actualizar_lead") {
        guardarCalls++;
        leads.set(String(input.numero), { ...input });
        return { exito: true, lead_id: "lead-1", operacion: "creado", mensaje: "ok" };
      }
      throw new Error(`tool inesperada: ${name}`);
    };

    await ensureLeadPersisted(
      { numero, nombreContacto: "Usuario externo", problemaDescrito: "Quiero cotizar un sitio", esCliente: false },
      { executeToolCall }
    );

    assert.equal(guardarCalls, 1, "debe crear el lead sin depender de una tool call del modelo");
    assert.ok(leads.has(numero), "el lead debe quedar registrado en whatsapp_leads");
    assert.equal(leads.get(numero)?.stage, "exploring");
  });

  test("no toca un lead que ya existe (no pisa datos curados por una conversación previa)", async () => {
    const leads = new Map<string, Record<string, unknown>>([
      [numero, { stage: "opportunity", problema_descrito: "Contexto ya capturado" }],
    ]);
    let guardarCalls = 0;

    const executeToolCall = async (name: ToolName, input: Record<string, unknown>): Promise<ToolResult> => {
      if (name === "consultar_contexto_contacto") {
        const lead = leads.get(String(input.numero));
        return { encontrado: Boolean(lead), es_cliente: false, es_lead: Boolean(lead) };
      }
      if (name === "guardar_actualizar_lead") {
        guardarCalls++;
        return { exito: true, lead_id: "lead-1", operacion: "actualizado", mensaje: "ok" };
      }
      throw new Error(`tool inesperada: ${name}`);
    };

    await ensureLeadPersisted(
      { numero, problemaDescrito: "Otro mensaje cualquiera", esCliente: false },
      { executeToolCall }
    );

    assert.equal(guardarCalls, 0, "un lead existente no debe reescribirse por la red de seguridad");
    assert.equal(leads.get(numero)?.problema_descrito, "Contexto ya capturado");
  });

  test("nunca crea un lead para un contacto que ya es cliente", async () => {
    let contextoCalls = 0;
    let guardarCalls = 0;

    const executeToolCall = async (name: ToolName): Promise<ToolResult> => {
      if (name === "consultar_contexto_contacto") {
        contextoCalls++;
        return { encontrado: true, es_cliente: true, es_lead: false };
      }
      if (name === "guardar_actualizar_lead") {
        guardarCalls++;
        return { exito: true, lead_id: "x", operacion: "creado", mensaje: "ok" };
      }
      throw new Error(`tool inesperada: ${name}`);
    };

    await ensureLeadPersisted({ numero, esCliente: true }, { executeToolCall });

    assert.equal(contextoCalls, 0, "si ya sabemos que es cliente, ni siquiera consulta el contexto");
    assert.equal(guardarCalls, 0);
  });

  test("un número con formato inválido no dispara ninguna escritura", async () => {
    let calls = 0;
    const executeToolCall = async (): Promise<ToolResult> => {
      calls++;
      return { exito: true, lead_id: "x", operacion: "creado", mensaje: "ok" };
    };

    await ensureLeadPersisted({ numero: "abc", esCliente: false }, { executeToolCall });

    assert.equal(calls, 0);
  });
});
