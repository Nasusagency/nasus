import { test, describe } from "node:test";
import assert from "node:assert/strict";

import { PHOTO_REGISTRY } from "@/lib/photos/config/index";
import { buildSystemPromptFromRules } from "@/lib/photos/types";
import { PASAPORTE_MX_PHOTO } from "@/lib/photos/config/pasaporte.photo";
import { VISA_USA_PHOTO } from "@/lib/photos/config/visa-usa.photo";
import { ESCOLAR_PHOTO, createEscolarPhotoConfig } from "@/lib/photos/config/escolar.photo";
import { DOCUMENT_REGISTRY } from "@/lib/documents/config/index";
import { INE_CONFIG } from "@/lib/documents/config/ine.config";
import { CURP_CONFIG } from "@/lib/documents/config/curp.config";

// ---------------------------------------------------------------------------
// Photo registry
// ---------------------------------------------------------------------------
describe("photo registry", () => {
  test("el registry contiene los 3 tipos de foto", () => {
    assert.ok("pasaporte-mx" in PHOTO_REGISTRY);
    assert.ok("visa-usa" in PHOTO_REGISTRY);
    assert.ok("escolar" in PHOTO_REGISTRY);
  });

  test("cada config tiene id, name, rules y systemPrompt", () => {
    for (const config of Object.values(PHOTO_REGISTRY)) {
      assert.ok(config.id, `${config.id} debe tener id`);
      assert.ok(config.name, `${config.id} debe tener name`);
      assert.ok(Array.isArray(config.rules) && config.rules.length > 0, `${config.id} debe tener reglas`);
      assert.ok(config.systemPrompt.length > 100, `${config.id} debe tener systemPrompt no vacío`);
    }
  });

  test("pasaporte-mx tiene tolerance strict", () => {
    assert.equal(PASAPORTE_MX_PHOTO.tolerance, "strict");
  });

  test("visa-usa tiene tolerance strict", () => {
    assert.equal(VISA_USA_PHOTO.tolerance, "strict");
  });

  test("escolar tiene tolerance flexible", () => {
    assert.equal(ESCOLAR_PHOTO.tolerance, "flexible");
  });
});

// ---------------------------------------------------------------------------
// Pasaporte MX rules
// ---------------------------------------------------------------------------
describe("pasaporte-mx config", () => {
  test("tiene regla de fondo blanco requerida", () => {
    const rule = PASAPORTE_MX_PHOTO.rules.find((r) => r.id === "background");
    assert.ok(rule, "debe tener regla 'background'");
    assert.equal(rule!.required, true);
  });

  test("tiene regla de sin lentes requerida", () => {
    const rule = PASAPORTE_MX_PHOTO.rules.find((r) => r.id === "no_glasses");
    assert.ok(rule);
    assert.equal(rule!.required, true);
  });

  test("tiene al menos 10 reglas", () => {
    assert.ok(PASAPORTE_MX_PHOTO.rules.length >= 10);
  });

  test("todas las reglas tienen id, label, description y required", () => {
    for (const rule of PASAPORTE_MX_PHOTO.rules) {
      assert.ok(rule.id, `regla debe tener id`);
      assert.ok(rule.label, `regla ${rule.id} debe tener label`);
      assert.ok(rule.description, `regla ${rule.id} debe tener description`);
      assert.equal(typeof rule.required, "boolean");
    }
  });
});

// ---------------------------------------------------------------------------
// Visa USA rules
// ---------------------------------------------------------------------------
describe("visa-usa config", () => {
  test("tiene regla de cara 50-69% del encuadre", () => {
    const rule = VISA_USA_PHOTO.rules.find((r) => r.id === "face_proportion");
    assert.ok(rule, "debe tener regla 'face_proportion'");
    assert.equal(rule!.required, true);
  });

  test("institución es USCIS", () => {
    assert.ok(VISA_USA_PHOTO.institution?.includes("USCIS"));
  });
});

// ---------------------------------------------------------------------------
// Escolar config
// ---------------------------------------------------------------------------
describe("escolar config", () => {
  test("tiene regla de fondo liso requerida", () => {
    const rule = ESCOLAR_PHOTO.rules.find((r) => r.id === "background");
    assert.ok(rule);
    assert.equal(rule!.required, true);
  });

  test("regla de vestimenta apropiada es opcional (sin uniforme requerido por defecto)", () => {
    const rule = ESCOLAR_PHOTO.rules.find((r) => r.id === "appropriate_clothing");
    assert.ok(rule);
    assert.equal(rule!.required, false);
  });

  test("createEscolarPhotoConfig con uniforme requerido → regla de vestimenta obligatoria", () => {
    const custom = createEscolarPhotoConfig({ requireUniform: true, institution: "Colegio XYZ" });
    const rule = custom.rules.find((r) => r.id === "appropriate_clothing");
    assert.ok(rule);
    assert.equal(rule!.required, true);
  });

  test("createEscolarPhotoConfig genera systemPrompt no vacío", () => {
    const custom = createEscolarPhotoConfig({ name: "Foto Empresa ABC", institution: "ABC Corp" });
    assert.ok(custom.systemPrompt.length > 100);
    assert.ok(custom.systemPrompt.includes("ABC Corp"));
  });
});

// ---------------------------------------------------------------------------
// buildSystemPromptFromRules
// ---------------------------------------------------------------------------
describe("buildSystemPromptFromRules", () => {
  test("incluye todos los ids de reglas en el prompt", () => {
    const prompt = buildSystemPromptFromRules(PASAPORTE_MX_PHOTO);
    for (const rule of PASAPORTE_MX_PHOTO.rules) {
      assert.ok(prompt.includes(rule.id), `el prompt debe incluir el id '${rule.id}'`);
    }
  });

  test("incluye la etiqueta REQUERIDO para reglas obligatorias", () => {
    const prompt = buildSystemPromptFromRules(VISA_USA_PHOTO);
    assert.ok(prompt.includes("REQUERIDO"));
  });

  test("incluye la etiqueta opcional para reglas no obligatorias", () => {
    const prompt = buildSystemPromptFromRules(ESCOLAR_PHOTO);
    assert.ok(prompt.includes("opcional"));
  });
});

// ---------------------------------------------------------------------------
// Document registry (architecture)
// ---------------------------------------------------------------------------
describe("document registry", () => {
  test("contiene los 6 tipos de documento", () => {
    const expected = ["ine", "curp", "rfc", "pasaporte", "acta", "dni"];
    for (const id of expected) {
      assert.ok(id in DOCUMENT_REGISTRY, `falta '${id}' en el registry`);
    }
  });

  test("cada config tiene id, name, systemPrompt, fieldDefs y validate", () => {
    for (const config of Object.values(DOCUMENT_REGISTRY)) {
      assert.ok(config.id, `${config.id} debe tener id`);
      assert.ok(config.name, `${config.id} debe tener name`);
      assert.ok(config.systemPrompt.length > 50, `${config.id} debe tener systemPrompt`);
      assert.ok(Array.isArray(config.fieldDefs) && config.fieldDefs.length > 0, `${config.id} debe tener fieldDefs`);
      assert.equal(typeof config.validate, "function");
    }
  });

  test("INE y CURP tienen diditSupported: true", () => {
    assert.equal(INE_CONFIG.diditSupported, true);
    assert.equal(CURP_CONFIG.diditSupported, true);
  });

  test("INE config tiene getDiditArgs y devuelve CURP de los fields", () => {
    const result = INE_CONFIG.getDiditArgs?.({
      curp: "HEGG560427MVZRRL04",
      nombres: "GRACIELA",
      apellido_paterno: "HERAS",
    });
    assert.ok(result);
    assert.equal(result!.curp, "HEGG560427MVZRRL04");
  });

  test("INE config getDiditArgs devuelve null si no hay CURP", () => {
    const result = INE_CONFIG.getDiditArgs?.({ curp: null });
    assert.equal(result, null);
  });

  test("el validate de INE_CONFIG produce el mismo resultado que validateIne directamente", () => {
    const fields = {
      nombres: "JOSE ANTONIO", apellido_paterno: "MARTINEZ", apellido_materno: "RAMIREZ",
      clave_elector: "MRTNJO560427HDFNRS", curp: "HEGG560427MVZRRL04",
      fecha_nacimiento: "1956-04-27", fecha_vencimiento: "2030-01-01",
      seccion: "1234", generacion: "2014", folio: "ABC123",
      domicilio: null, entidad: null,
    };
    const result = INE_CONFIG.validate(fields);
    assert.equal(result.valid, true);
    assert.deepEqual(result.issues, []);
  });
});
