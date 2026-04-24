import { test, describe } from "node:test";
import assert from "node:assert/strict";

import { normalizeText, normalizeDocNumber, parseDate } from "@/lib/normalizer";
import { validateDni } from "@/lib/validators/dni";
import { validateActa } from "@/lib/validators/acta";
import type { DniFields } from "@/lib/validators/dni";
import type { ActaFields } from "@/lib/validators/acta";

// ---------------------------------------------------------------------------
// Fixtures — simulan lo que Gemini Vision devolvería para cada caso
// ---------------------------------------------------------------------------
const DNI: Record<string, DniFields> = {
  valid: {
    nombres: "Juan Carlos", apellidos: "Perez Lopez",
    numero_documento: "12345678", fecha_nacimiento: "1990-05-12",
    fecha_vencimiento: "2030-05-12", pais: "Peru",
  },
  badDocNumber: {
    nombres: "Pedro", apellidos: "Ramirez", numero_documento: "123",
    fecha_nacimiento: "2000-01-01", fecha_vencimiento: "2028-01-01", pais: "Peru",
  },
  futureBirth: {
    nombres: "Ana", apellidos: "Torres", numero_documento: "99887766",
    fecha_nacimiento: "2099-01-01", fecha_vencimiento: "2110-01-01", pais: "Peru",
  },
  missingFields: {
    nombres: null, apellidos: null, numero_documento: "45678901",
    fecha_nacimiento: null, fecha_vencimiento: null, pais: null,
  },
  ocrNoise: {
    nombres: "  Luís  ", apellidos: "O'Brien-Castro",
    numero_documento: "12 34 56 78", fecha_nacimiento: "1978-11-30",
    fecha_vencimiento: "2026-11-30", pais: "PE",
  },
};

const ACTA: Record<string, ActaFields> = {
  valid: {
    tipo_acta: "nacimiento", numero_acta: "2023-00456",
    fecha_emision: "2023-06-15", entidad_emisora: "Registro Civil de Lima",
    nombres_involucrados: ["Sofia Elena Rios Paredes"],
  },
  unknownType: {
    tipo_acta: "adopcion", numero_acta: "2022-00789",
    fecha_emision: "2022-04-01", entidad_emisora: "Municipalidad",
    nombres_involucrados: ["Carlos Vega"],
  },
  missingNumber: {
    tipo_acta: "matrimonio", numero_acta: null,
    fecha_emision: "2021-09-18", entidad_emisora: "Registro Civil",
    nombres_involucrados: ["Rosa Huanca", "Miguel Quispe"],
  },
  futureEmision: {
    tipo_acta: "defuncion", numero_acta: "2025-00001",
    fecha_emision: "2099-12-31", entidad_emisora: "Registro Civil",
    nombres_involucrados: ["Roberto Salas"],
  },
  noNames: {
    tipo_acta: "nacimiento", numero_acta: "2024-00001",
    fecha_emision: "2024-01-10", entidad_emisora: "Registro Civil",
    nombres_involucrados: [],
  },
};

// ---------------------------------------------------------------------------
// Normalizador
// ---------------------------------------------------------------------------
describe("normalizer", () => {
  test("elimina tildes y pasa a mayúsculas", () => {
    assert.equal(normalizeText("Luís García"), "LUIS GARCIA");
  });

  test("elimina caracteres especiales", () => {
    assert.equal(normalizeText("O'Brien-Castro!"), "OBRIENCASTRO");
  });

  test("normalizeDocNumber elimina espacios y guiones", () => {
    assert.equal(normalizeDocNumber("12 34 56 78"), "12345678");
    assert.equal(normalizeDocNumber("AB-123-CD"), "AB123CD");
  });

  test("parseDate acepta fecha válida", () => {
    const d = parseDate("1990-05-12");
    assert.ok(d instanceof Date);
    assert.equal(d!.getFullYear(), 1990);
  });

  test("parseDate rechaza día inexistente (30 de febrero)", () => {
    assert.equal(parseDate("2023-02-30"), null);
  });

  test("parseDate rechaza formato incorrecto", () => {
    assert.equal(parseDate("12/05/1990"), null);
    assert.equal(parseDate("no-es-fecha"), null);
  });
});

// ---------------------------------------------------------------------------
// validateDni
// ---------------------------------------------------------------------------
describe("validateDni", () => {
  test("DNI peruano válido → valid: true, sin issues", () => {
    const r = validateDni(DNI.valid);
    assert.equal(r.valid, true);
    assert.deepEqual(r.issues, []);
  });

  test("número demasiado corto para PE → issue de formato", () => {
    const r = validateDni(DNI.badDocNumber);
    assert.equal(r.valid, false);
    assert.ok(r.issues.some((i) => i.includes("formato esperado")));
  });

  test("fecha de nacimiento en el futuro → issue", () => {
    const r = validateDni(DNI.futureBirth);
    assert.equal(r.valid, false);
    assert.ok(r.issues.some((i) => i.includes("futuro")));
  });

  test("campos obligatorios nulos → issues de campos faltantes", () => {
    const r = validateDni(DNI.missingFields);
    assert.equal(r.valid, false);
    assert.ok(r.issues.some((i) => i.includes("Nombres")));
    assert.ok(r.issues.some((i) => i.includes("Apellidos")));
  });

  test("ruido OCR en número es normalizado y queda válido", () => {
    const r = validateDni(DNI.ocrNoise);
    assert.equal(r.fields.numero_documento, "12345678");
    assert.equal(r.valid, true);
  });

  test("tildes en nombre son eliminadas", () => {
    const r = validateDni(DNI.ocrNoise);
    assert.equal(r.fields.nombres, "LUIS");
  });
});

// ---------------------------------------------------------------------------
// validateActa
// ---------------------------------------------------------------------------
describe("validateActa", () => {
  test("acta de nacimiento válida → valid: true", () => {
    const r = validateActa(ACTA.valid);
    assert.equal(r.valid, true);
    assert.deepEqual(r.issues, []);
  });

  test("tipo de acta desconocido → issue", () => {
    const r = validateActa(ACTA.unknownType);
    assert.equal(r.valid, false);
    assert.ok(r.issues.some((i) => i.includes("desconocido")));
  });

  test("número de acta nulo → issue", () => {
    const r = validateActa(ACTA.missingNumber);
    assert.equal(r.valid, false);
    assert.ok(r.issues.some((i) => i.includes("Número de acta")));
  });

  test("fecha de emisión en el futuro → issue", () => {
    const r = validateActa(ACTA.futureEmision);
    assert.equal(r.valid, false);
    assert.ok(r.issues.some((i) => i.includes("futuro")));
  });

  test("sin nombres involucrados → issue", () => {
    const r = validateActa(ACTA.noNames);
    assert.equal(r.valid, false);
    assert.ok(r.issues.some((i) => i.includes("nombres")));
  });

  test("nombres involucrados son normalizados (tildes quitadas)", () => {
    const r = validateActa(ACTA.valid);
    assert.equal(r.fields.nombres_involucrados[0], "SOFIA ELENA RIOS PAREDES");
  });
});
