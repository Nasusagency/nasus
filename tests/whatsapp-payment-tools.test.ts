import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, test } from "node:test";
import { ALL_TOOLS } from "../lib/llm/tools";
import { executeToolCall } from "../lib/whatsapp/agent-handlers";

const PAYMENT_TOOLS = ["consultar_estado_pago", "consultar_pagos_pendientes", "recuperar_link_pago_existente"] as const;

describe("Fase 11: tools de Groq con contexto de pagos", () => {
  test("las 3 tools de pago están registradas y visibles para el agente", () => {
    for (const name of PAYMENT_TOOLS) assert.equal(ALL_TOOLS.some(t => t.name === name), true, name);
  });

  test("ninguna tool de pago acepta monto, moneda ni status como parámetro: Groq no puede inventar un cargo", () => {
    const forbidden = ["amount", "monto", "currency", "moneda", "status", "amount_", "price", "precio", "total"];
    for (const name of PAYMENT_TOOLS) {
      const tool = ALL_TOOLS.find(t => t.name === name)!;
      const properties = Object.keys(tool.input_schema.properties);
      for (const key of properties) assert.equal(forbidden.includes(key), false, `${name} expone ${key}`);
    }
  });

  test("las tools de pago solo aceptan payment_id opcional, nada más", () => {
    for (const name of PAYMENT_TOOLS) {
      const tool = ALL_TOOLS.find(t => t.name === name)!;
      const properties = Object.keys(tool.input_schema.properties);
      assert.deepEqual(properties.sort(), name === "consultar_pagos_pendientes" ? [] : ["payment_id"]);
      assert.deepEqual(tool.input_schema.required, []);
    }
  });

  test("los handlers de pago solo leen crm_payments: no hay insert/update/upsert/rpc en su bloque", () => {
    const source = readFileSync("lib/whatsapp/agent-handlers.ts", "utf8");
    const start = source.indexOf("// ─── Tools 7-9: Pagos");
    const end = source.indexOf("// ─── Dispatcher");
    const block = source.slice(start, end);
    assert.notEqual(start, -1);
    assert.doesNotMatch(block, /\.insert\(/);
    assert.doesNotMatch(block, /\.update\(/);
    assert.doesNotMatch(block, /\.upsert\(/);
    assert.doesNotMatch(block, /\.rpc\(/);
  });

  test("consultar_estado_pago rechaza número con formato inválido sin tocar la base", async () => {
    const result = await executeToolCall("consultar_estado_pago", { numero: "no-es-un-numero" });
    assert.deepEqual(result, { encontrado: false, mensaje: "Número de teléfono inválido" });
  });

  test("recuperar_link_pago_existente rechaza número con formato inválido sin tocar la base", async () => {
    const result = await executeToolCall("recuperar_link_pago_existente", { numero: "no-es-un-numero" });
    assert.deepEqual(result, { encontrado: false, mensaje: "Número de teléfono inválido" });
  });

  test("consultar_pagos_pendientes con número inválido devuelve lista vacía, no un error que rompa el turno", async () => {
    const result = await executeToolCall("consultar_pagos_pendientes", { numero: "no-es-un-numero" });
    assert.deepEqual(result, { encontrado: false, pagos: [], total: 0 });
  });
});
