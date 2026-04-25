import { test, describe } from "node:test";
import assert from "node:assert/strict";

import { normalizeText, normalizeDocNumber, parseDate } from "@/lib/normalizer";
import { validateDni } from "@/lib/validators/dni";
import { validateActa } from "@/lib/validators/acta";
import { validateCurp } from "@/lib/validators/curp";
import { validateRfc } from "@/lib/validators/rfc";
import { validateIne } from "@/lib/validators/ine";
import { validatePasaporte } from "@/lib/validators/pasaporte";
import type { DniFields } from "@/lib/validators/dni";
import type { ActaFields } from "@/lib/validators/acta";
import type { CurpFields } from "@/lib/validators/curp";
import type { RfcFields } from "@/lib/validators/rfc";
import type { IneFields } from "@/lib/validators/ine";
import type { PasaporteFields } from "@/lib/validators/pasaporte";

// ---------------------------------------------------------------------------
// Fixtures — simulan lo que Claude Vision devolvería para cada caso
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

const CURP_FIXTURES: Record<string, CurpFields> = {
  valid: {
    curp: "HEGG560427MVZRRL04",
    nombres: "Graciela",
    apellido_paterno: "Heras",
    apellido_materno: "Gonzalez",
    fecha_nacimiento: "1956-04-27",
    sexo: "M",
    entidad_nacimiento: "Veracruz",
  },
  wrongLength: {
    curp: "HEGG560427MV",
    nombres: "Juan",
    apellido_paterno: "Hernandez",
    apellido_materno: "Garcia",
    fecha_nacimiento: "1990-01-01",
    sexo: "H",
    entidad_nacimiento: "CDMX",
  },
  badFormat: {
    curp: "1234560427MVZRRL04",
    nombres: "Luis",
    apellido_paterno: "Perez",
    apellido_materno: "Lopez",
    fecha_nacimiento: "1980-05-10",
    sexo: "H",
    entidad_nacimiento: "Jalisco",
  },
  sexMismatch: {
    curp: "HEGG560427MVZRRL04",
    nombres: "Graciela",
    apellido_paterno: "Heras",
    apellido_materno: "Gonzalez",
    fecha_nacimiento: "1956-04-27",
    sexo: "H",
    entidad_nacimiento: "Veracruz",
  },
  nullCurp: {
    curp: null,
    nombres: "Maria",
    apellido_paterno: "Lopez",
    apellido_materno: null,
    fecha_nacimiento: null,
    sexo: null,
    entidad_nacimiento: null,
  },
  ocrNoise: {
    curp: "HEGG 560427-MVZRRL04",
    nombres: "Graciela",
    apellido_paterno: "Heras",
    apellido_materno: "Gonzalez",
    fecha_nacimiento: "1956-04-27",
    sexo: "M",
    entidad_nacimiento: "Veracruz",
  },
};

const RFC_FIXTURES: Record<string, RfcFields> = {
  validFisica: {
    rfc: "HEGG560427MV1",
    nombre: "Graciela Heras Gonzalez",
    tipo_persona: "fisica",
    fecha: "1956-04-27",
  },
  validMoral: {
    rfc: "ACE560427MV1",
    nombre: "Aceros del Centro SA de CV",
    tipo_persona: "moral",
    fecha: "1956-04-27",
  },
  wrongLength: {
    rfc: "HEGG560427M",
    nombre: "Juan",
    tipo_persona: null,
    fecha: null,
  },
  badFormat: {
    rfc: "1234560427MV1",
    nombre: "Test",
    tipo_persona: null,
    fecha: null,
  },
  nullRfc: {
    rfc: null,
    nombre: null,
    tipo_persona: null,
    fecha: null,
  },
  infersTipo: {
    rfc: "HEGG560427MV1",
    nombre: "Test",
    tipo_persona: null,
    fecha: null,
  },
  ocrNoise: {
    rfc: "HEGG-560427-MV1",
    nombre: "Graciela",
    tipo_persona: "fisica",
    fecha: "1956-04-27",
  },
};

const INE_FIXTURES: Record<string, IneFields> = {
  valid: {
    nombres: "JOSE ANTONIO",
    apellido_paterno: "MARTINEZ",
    apellido_materno: "RAMIREZ",
    clave_elector: "MRTNJO800101HDFNRS",
    curp: "HEGG560427MVZRRL04",
    fecha_nacimiento: "1980-01-01",
    fecha_vencimiento: "2030-01-01",
    seccion: "1234",
  },
  missingClave: {
    nombres: "LUCIA",
    apellido_paterno: "SANCHEZ",
    apellido_materno: null,
    clave_elector: null,
    curp: null,
    fecha_nacimiento: "1990-05-15",
    fecha_vencimiento: "2028-05-15",
    seccion: null,
  },
  invalidClave: {
    nombres: "PEDRO",
    apellido_paterno: "GOMEZ",
    apellido_materno: "LUNA",
    clave_elector: "123456",
    curp: null,
    fecha_nacimiento: "1975-03-20",
    fecha_vencimiento: "2027-03-20",
    seccion: "5678",
  },
  expired: {
    nombres: "ANA",
    apellido_paterno: "TORRES",
    apellido_materno: "VEGA",
    clave_elector: "MRTNJO800101HDFNRS08",
    curp: null,
    fecha_nacimiento: "1980-01-01",
    fecha_vencimiento: "2020-01-01",
    seccion: "9012",
  },
};

const PASAPORTE_FIXTURES: Record<string, PasaporteFields> = {
  validOld: {
    nombres: "CARLOS",
    apellidos: "MENDEZ RUIZ",
    numero_pasaporte: "G12345678",
    fecha_nacimiento: "1985-07-22",
    fecha_vencimiento: "2030-07-22",
    nacionalidad: "MEXICANA",
  },
  validModern: {
    nombres: "MARIA ELENA",
    apellidos: "CRUZ SANTOS",
    numero_pasaporte: "AB1234567",
    fecha_nacimiento: "1990-03-10",
    fecha_vencimiento: "2032-03-10",
    nacionalidad: "MEXICANA",
  },
  expired: {
    nombres: "LUIS",
    apellidos: "PEREZ",
    numero_pasaporte: "G98765432",
    fecha_nacimiento: "1970-01-01",
    fecha_vencimiento: "2010-01-01",
    nacionalidad: "MEXICANA",
  },
  badFormat: {
    nombres: "ROSA",
    apellidos: "GARCIA",
    numero_pasaporte: "123456789",
    fecha_nacimiento: "1995-08-14",
    fecha_vencimiento: "2029-08-14",
    nacionalidad: "MEXICANA",
  },
  missingFields: {
    nombres: null,
    apellidos: null,
    numero_pasaporte: null,
    fecha_nacimiento: null,
    fecha_vencimiento: null,
    nacionalidad: null,
  },
  ocrNoise: {
    nombres: "CARLOS",
    apellidos: "MENDEZ RUIZ",
    numero_pasaporte: "G 123-45678",
    fecha_nacimiento: "1985-07-22",
    fecha_vencimiento: "2030-07-22",
    nacionalidad: "MEXICANA",
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

// ---------------------------------------------------------------------------
// validateCurp
// ---------------------------------------------------------------------------
describe("validateCurp", () => {
  test("CURP válida → valid: true, sin issues", () => {
    const r = validateCurp(CURP_FIXTURES.valid);
    assert.equal(r.valid, true);
    assert.deepEqual(r.issues, []);
  });

  test("CURP con longitud incorrecta → issue de longitud", () => {
    const r = validateCurp(CURP_FIXTURES.wrongLength);
    assert.equal(r.valid, false);
    assert.ok(r.issues.some((i) => i.includes("18 caracteres")));
  });

  test("CURP con formato incorrecto (empieza con dígitos) → issue", () => {
    const r = validateCurp(CURP_FIXTURES.badFormat);
    assert.equal(r.valid, false);
    assert.ok(r.issues.some((i) => i.includes("formato oficial")));
  });

  test("CURP null → issue de CURP ausente", () => {
    const r = validateCurp(CURP_FIXTURES.nullCurp);
    assert.equal(r.valid, false);
    assert.ok(r.issues.some((i) => i.includes("CURP no detectada")));
  });

  test("sexo en CURP difiere del campo sexo → issue de incoherencia", () => {
    const r = validateCurp(CURP_FIXTURES.sexMismatch);
    assert.equal(r.valid, false);
    assert.ok(r.issues.some((i) => i.includes("difiere")));
  });

  test("ruido OCR en CURP (espacios y guiones) es normalizado", () => {
    const r = validateCurp(CURP_FIXTURES.ocrNoise);
    assert.equal(r.fields.curp, "HEGG560427MVZRRL04");
    assert.equal(r.valid, true);
  });
});

// ---------------------------------------------------------------------------
// validateRfc
// ---------------------------------------------------------------------------
describe("validateRfc", () => {
  test("RFC persona física válido (13 chars) → valid: true", () => {
    const r = validateRfc(RFC_FIXTURES.validFisica);
    assert.equal(r.valid, true);
    assert.deepEqual(r.issues, []);
  });

  test("RFC persona moral válido (12 chars) → valid: true", () => {
    const r = validateRfc(RFC_FIXTURES.validMoral);
    assert.equal(r.valid, true);
    assert.deepEqual(r.issues, []);
  });

  test("RFC con longitud incorrecta → issue", () => {
    const r = validateRfc(RFC_FIXTURES.wrongLength);
    assert.equal(r.valid, false);
    assert.ok(r.issues.some((i) => i.includes("12 o 13 caracteres")));
  });

  test("RFC con formato inválido (empieza con dígito) → issue", () => {
    const r = validateRfc(RFC_FIXTURES.badFormat);
    assert.equal(r.valid, false);
    assert.ok(r.issues.some((i) => i.includes("formato oficial")));
  });

  test("RFC null → issue de RFC ausente", () => {
    const r = validateRfc(RFC_FIXTURES.nullRfc);
    assert.equal(r.valid, false);
    assert.ok(r.issues.some((i) => i.includes("RFC no detectado")));
  });

  test("tipo_persona se infiere desde la longitud cuando es null", () => {
    const r = validateRfc(RFC_FIXTURES.infersTipo);
    assert.equal(r.fields.tipo_persona, "fisica");
  });

  test("ruido OCR en RFC (guiones) es normalizado", () => {
    const r = validateRfc(RFC_FIXTURES.ocrNoise);
    assert.equal(r.fields.rfc, "HEGG560427MV1");
    assert.equal(r.valid, true);
  });
});

// ---------------------------------------------------------------------------
// validateIne
// ---------------------------------------------------------------------------
describe("validateIne", () => {
  test("INE válida con clave de 18 chars → valid: true", () => {
    const r = validateIne(INE_FIXTURES.valid);
    assert.equal(r.valid, true);
    assert.deepEqual(r.issues, []);
  });

  test("clave de elector ausente → issue", () => {
    const r = validateIne(INE_FIXTURES.missingClave);
    assert.equal(r.valid, false);
    assert.ok(r.issues.some((i) => i.includes("Clave de elector ausente")));
  });

  test("clave de elector con formato inválido → issue", () => {
    const r = validateIne(INE_FIXTURES.invalidClave);
    assert.equal(r.valid, false);
    assert.ok(r.issues.some((i) => i.includes("no cumple el formato")));
  });

  test("credencial vencida → issue", () => {
    const r = validateIne(INE_FIXTURES.expired);
    assert.equal(r.valid, false);
    assert.ok(r.issues.some((i) => i.includes("vencida")));
  });

  test("nombres son normalizados (tildes quitadas)", () => {
    const r = validateIne(INE_FIXTURES.valid);
    assert.equal(r.fields.nombres, "JOSE ANTONIO");
  });
});

// ---------------------------------------------------------------------------
// validatePasaporte
// ---------------------------------------------------------------------------
describe("validatePasaporte", () => {
  test("pasaporte formato antiguo G+8 dígitos → valid: true", () => {
    const r = validatePasaporte(PASAPORTE_FIXTURES.validOld);
    assert.equal(r.valid, true);
    assert.deepEqual(r.issues, []);
  });

  test("pasaporte formato moderno 2 letras+7 dígitos → valid: true", () => {
    const r = validatePasaporte(PASAPORTE_FIXTURES.validModern);
    assert.equal(r.valid, true);
    assert.deepEqual(r.issues, []);
  });

  test("pasaporte vencido → issue", () => {
    const r = validatePasaporte(PASAPORTE_FIXTURES.expired);
    assert.equal(r.valid, false);
    assert.ok(r.issues.some((i) => i.includes("vencido")));
  });

  test("número con solo dígitos (sin letra inicial) → issue de formato", () => {
    const r = validatePasaporte(PASAPORTE_FIXTURES.badFormat);
    assert.equal(r.valid, false);
    assert.ok(r.issues.some((i) => i.includes("formato mexicano")));
  });

  test("campos obligatorios null → múltiples issues", () => {
    const r = validatePasaporte(PASAPORTE_FIXTURES.missingFields);
    assert.equal(r.valid, false);
    assert.ok(r.issues.some((i) => i.includes("Nombres")));
    assert.ok(r.issues.some((i) => i.includes("Apellidos")));
    assert.ok(r.issues.some((i) => i.includes("Número de pasaporte")));
  });

  test("ruido OCR en número de pasaporte (espacios y guiones) es normalizado", () => {
    const r = validatePasaporte(PASAPORTE_FIXTURES.ocrNoise);
    assert.equal(r.fields.numero_pasaporte, "G12345678");
    assert.equal(r.valid, true);
  });
});
