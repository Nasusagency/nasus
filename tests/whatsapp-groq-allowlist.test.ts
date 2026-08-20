/**
 * Tests para la normalización de números telefónicos mexicanos
 * en la allowlist de Groq Agent
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";

import {
  normalizePhoneNumber,
  isNumberInGroqAllowlist,
  selectProvider,
  maskPhoneNumber,
} from "@/lib/whatsapp/groq-allowlist";

describe("normalizePhoneNumber", () => {
  describe("México: normalizar 521 → 52", () => {
    test("normaliza 5213331002790 a 523331002790", () => {
      assert.equal(normalizePhoneNumber("5213331002790"), "523331002790");
    });

    test("mantiene 523331002790 igual", () => {
      assert.equal(normalizePhoneNumber("523331002790"), "523331002790");
    });

    test("normaliza +52 1 333 100 2790 a 523331002790", () => {
      assert.equal(normalizePhoneNumber("+52 1 333 100 2790"), "523331002790");
    });

    test("normaliza +52 1 333-100-2790 a 523331002790", () => {
      assert.equal(normalizePhoneNumber("+52 1 333-100-2790"), "523331002790");
    });

    test("normaliza +5213331002790 a 523331002790", () => {
      assert.equal(normalizePhoneNumber("+5213331002790"), "523331002790");
    });

    test("normaliza +52 (1) 333-100-2790 a 523331002790", () => {
      assert.equal(normalizePhoneNumber("+52 (1) 333-100-2790"), "523331002790");
    });

    test("normaliza 52 1 333 100 2790 a 523331002790", () => {
      assert.equal(normalizePhoneNumber("52 1 333 100 2790"), "523331002790");
    });
  });

  describe("México: 52 sin lada de 1", () => {
    test("mantiene +523331002790 igual", () => {
      assert.equal(normalizePhoneNumber("+523331002790"), "523331002790");
    });

    test("mantiene +52 333 100 2790 igual", () => {
      assert.equal(normalizePhoneNumber("+52 333 100 2790"), "523331002790");
    });

    test("mantiene 523331002790 igual", () => {
      assert.equal(normalizePhoneNumber("523331002790"), "523331002790");
    });
  });

  describe("Edge cases", () => {
    test("devuelve string vacío para entrada vacía", () => {
      assert.equal(normalizePhoneNumber(""), "");
    });

    test("devuelve string vacío para null/undefined", () => {
      assert.equal(normalizePhoneNumber(""), "");
    });

    test("limpia solo caracteres especiales", () => {
      assert.equal(normalizePhoneNumber("52-333-100-2790"), "523331002790");
    });

    test("maneja números cortos sin aplicar regla 521", () => {
      // 12 dígitos no es 13, así que no aplica la regla 521
      assert.equal(normalizePhoneNumber("5213331002790".slice(0, 12)), "521333100279");
    });
  });

  describe("Otros países (no aplica regla mexicana)", () => {
    test("mantiene números de EE.UU. igual", () => {
      // +1 555 123 4567 → 15551234567
      assert.equal(normalizePhoneNumber("+1 555 123 4567"), "15551234567");
    });

    test("mantiene números de España igual", () => {
      // +34 91 123 4567 → 34911234567
      assert.equal(normalizePhoneNumber("+34 91 123 4567"), "34911234567");
    });

    test("mantiene números de Argentina igual", () => {
      // +54 11 1234 5678 → 541112345678
      assert.equal(normalizePhoneNumber("+54 11 1234 5678"), "541112345678");
    });
  });
});

describe("isNumberInGroqAllowlist", () => {
  test("autoriza número en allowlist (sin formato)", () => {
    const allowlist = "523331002790";
    assert.equal(isNumberInGroqAllowlist("523331002790", allowlist), true);
  });

  test("autoriza número que normaliza a allowlist", () => {
    const allowlist = "523331002790";
    assert.equal(isNumberInGroqAllowlist("5213331002790", allowlist), true);
  });

  test("autoriza número con + y espacios", () => {
    const allowlist = "523331002790";
    assert.equal(isNumberInGroqAllowlist("+52 333 100 2790", allowlist), true);
  });

  test("rechaza número fuera de allowlist", () => {
    const allowlist = "523331002790";
    assert.equal(isNumberInGroqAllowlist("523331002791", allowlist), false);
  });

  test("rechaza si allowlist vacía", () => {
    assert.equal(isNumberInGroqAllowlist("523331002790", ""), false);
  });

  test("rechaza si allowlist no definida", () => {
    assert.equal(isNumberInGroqAllowlist("523331002790", undefined), false);
  });

  test("maneja múltiples números en allowlist (CSV)", () => {
    const allowlist = "523331002790,523331002791,523331002792";
    assert.equal(isNumberInGroqAllowlist("5213331002790", allowlist), true);
    assert.equal(isNumberInGroqAllowlist("523331002791", allowlist), true);
    assert.equal(isNumberInGroqAllowlist("523331002793", allowlist), false);
  });

  test("normaliza números en allowlist", () => {
    const allowlist = "5213331002790,+52 333 100 2791"; // Números sin normalizar en la allowlist
    assert.equal(isNumberInGroqAllowlist("523331002790", allowlist), true);
    assert.equal(isNumberInGroqAllowlist("523331002791", allowlist), true);
  });
});

describe("selectProvider", () => {
  test("devuelve claude si provider no es groq", () => {
    assert.equal(selectProvider("523331002790", "claude", "523331002790"), "claude");
  });

  test("devuelve claude si no hay allowlist", () => {
    assert.equal(selectProvider("523331002790", "groq", ""), "claude");
  });

  test("devuelve groq si número está autorizado", () => {
    assert.equal(selectProvider("523331002790", "groq", "523331002790"), "groq");
  });

  test("devuelve groq si número normalizado está autorizado", () => {
    assert.equal(selectProvider("5213331002790", "groq", "523331002790"), "groq");
  });

  test("devuelve claude si número no está autorizado", () => {
    assert.equal(selectProvider("523331002791", "groq", "523331002790"), "claude");
  });

  test("maneja CSV en allowlist", () => {
    const allowlist = "523331002790,523331002791";
    assert.equal(selectProvider("523331002790", "groq", allowlist), "groq");
    assert.equal(selectProvider("5213331002791", "groq", allowlist), "groq");
    assert.equal(selectProvider("523331002792", "groq", allowlist), "claude");
  });

  test("default a claude si provider no especificado", () => {
    assert.equal(selectProvider("523331002790", undefined, "523331002790"), "claude");
  });
});

describe("maskPhoneNumber", () => {
  test("enmascara número normalizado", () => {
    assert.equal(maskPhoneNumber("523331002790"), "523***790");
  });

  test("enmascara número con 521", () => {
    assert.equal(maskPhoneNumber("5213331002790"), "523***790");
  });

  test("enmascara número con formato", () => {
    assert.equal(maskPhoneNumber("+52 333 100 2790"), "523***790");
  });

  test("devuelve *** para números muy cortos", () => {
    assert.equal(maskPhoneNumber("123"), "***");
  });
});
