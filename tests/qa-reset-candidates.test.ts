import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  buildLookupCandidates,
  resolveContactNumero,
  type ContactPreview,
} from "@/lib/whatsapp/qa-reset-candidates";

function preview(overrides: Partial<ContactPreview> = {}): ContactPreview {
  return {
    numero_masked: "**",
    lead_found: false,
    whatsapp_leads: 0,
    crm_suggestions: 0,
    crm_proposals: 0,
    crm_activities: 0,
    whatsapp_requerimientos: 0,
    whatsapp_mensajes: 0,
    whatsapp_conversations: 0,
    whatsapp_clientes: 0,
    acquisition_events_linked: 0,
    ...overrides,
  };
}

const HISTORICO = "5213331002790"; // 521 + 10 dígitos
const CANONICO = "523331002790"; // 52 + 10 dígitos
const LOCAL_10 = "3331002790";

describe("buildLookupCandidates", () => {
  test("input histórico 521... incluye el propio valor y la variante canónica 52...", () => {
    const candidates = buildLookupCandidates(HISTORICO);
    assert.deepEqual(new Set(candidates), new Set([HISTORICO, CANONICO]));
  });

  test("input canónico 52... incluye el propio valor y la variante histórica 521...", () => {
    const candidates = buildLookupCandidates(CANONICO);
    assert.deepEqual(new Set(candidates), new Set([CANONICO, HISTORICO]));
  });

  test("input local de 10 dígitos incluye las tres variantes posibles", () => {
    const candidates = buildLookupCandidates(LOCAL_10);
    assert.deepEqual(new Set(candidates), new Set([LOCAL_10, CANONICO, HISTORICO]));
  });

  test("no genera candidatos para basura sin dígitos suficientes", () => {
    assert.deepEqual(buildLookupCandidates("abc"), []);
    assert.deepEqual(buildLookupCandidates("123"), []);
  });

  test("acepta + inicial y separadores comunes", () => {
    const candidates = buildLookupCandidates("+52 333-100-2790");
    assert.ok(candidates.includes(CANONICO));
  });
});

describe("resolveContactNumero", () => {
  test("input 521... encuentra el registro histórico 521... almacenado", async () => {
    const calls: string[] = [];
    const fetchPreview = async (numero: string) => {
      calls.push(numero);
      return numero === HISTORICO ? preview({ lead_found: true, whatsapp_leads: 1 }) : preview();
    };

    const result = await resolveContactNumero(HISTORICO, fetchPreview);

    assert.equal(result.status, "resolved");
    if (result.status === "resolved") {
      assert.equal(result.numero, HISTORICO);
    }
    assert.deepEqual(new Set(calls), new Set([HISTORICO, CANONICO]));
  });

  test("input 52... encuentra el registro en formato nuevo", async () => {
    const fetchPreview = async (numero: string) =>
      numero === CANONICO ? preview({ lead_found: true, whatsapp_mensajes: 3 }) : preview();

    const result = await resolveContactNumero(CANONICO, fetchPreview);

    assert.equal(result.status, "resolved");
    if (result.status === "resolved") {
      assert.equal(result.numero, CANONICO);
    }
  });

  test("input de 10 dígitos MX resuelve si existe una única variante con datos", async () => {
    const fetchPreview = async (numero: string) =>
      numero === HISTORICO ? preview({ lead_found: true, whatsapp_leads: 1 }) : preview();

    const result = await resolveContactNumero(LOCAL_10, fetchPreview);

    assert.equal(result.status, "resolved");
    if (result.status === "resolved") {
      assert.equal(result.numero, HISTORICO);
    }
  });

  test("ambigüedad entre dos variantes con datos aborta sin resolver", async () => {
    const fetchPreview = async (numero: string) =>
      numero === HISTORICO || numero === CANONICO
        ? preview({ lead_found: true, whatsapp_leads: 1 })
        : preview();

    const result = await resolveContactNumero(LOCAL_10, fetchPreview);

    assert.equal(result.status, "ambiguous");
    if (result.status === "ambiguous") {
      assert.deepEqual(new Set(result.candidates), new Set([HISTORICO, CANONICO]));
    }
  });

  test("preview en cero para todas las variantes no resuelve ningún número a borrar", async () => {
    const fetchPreview = async () => preview();

    const result = await resolveContactNumero(CANONICO, fetchPreview);

    assert.equal(result.status, "empty");
    // El tipo discriminado no expone `numero` fuera de "resolved": no hay
    // forma de que el caller invoque el borrado sin un número resuelto.
    assert.equal("numero" in result, false);
  });

  test("input inválido no genera candidatos ni llama fetchPreview", async () => {
    let calls = 0;
    const fetchPreview = async () => {
      calls++;
      return preview();
    };

    const result = await resolveContactNumero("no-es-un-numero", fetchPreview);

    assert.equal(result.status, "invalid");
    assert.equal(calls, 0);
  });
});
