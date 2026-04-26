import { buildSystemPromptFromRules, type PhotoConfig } from "../types";

const rules = [
  {
    id: "background",
    label: "Fondo liso (blanco, gris o azul claro)",
    description: "Fondo de color uniforme: blanco, gris claro o azul claro, sin patrones ni objetos visibles",
    required: true,
  },
  {
    id: "face_frontal",
    label: "Cara de frente",
    description: "La cara debe estar de frente, sin giro excesivo lateral ni inclinación",
    required: true,
  },
  {
    id: "face_visible",
    label: "Cara completamente visible",
    description: "La cara debe ser completamente visible, sin objetos que la obstruyan (mascarillas, pañuelos, etc.)",
    required: true,
  },
  {
    id: "expression",
    label: "Expresión tranquila o sonrisa leve",
    description: "Expresión natural: neutral o sonrisa leve cerrada; no se permiten muecas o expresiones exageradas",
    required: true,
  },
  {
    id: "eyes_open",
    label: "Ojos abiertos",
    description: "Los ojos deben estar abiertos y visibles",
    required: true,
  },
  {
    id: "forehead_visible",
    label: "Frente visible",
    description: "La frente debe ser visible; el cabello no debe cubrir los ojos ni la frente por completo",
    required: false,
  },
  {
    id: "no_sunglasses",
    label: "Sin lentes oscuros",
    description: "No se permiten gafas de sol ni lentes con tinte oscuro (los lentes graduados son permitidos)",
    required: true,
  },
  {
    id: "appropriate_clothing",
    label: "Vestimenta apropiada",
    description: "Ropa apropiada para el contexto escolar; no se requiere uniforme salvo especificación de la institución",
    required: false,
  },
  {
    id: "photo_quality",
    label: "Foto nítida y bien iluminada",
    description: "Fotografía clara, sin borrosidad, con iluminación uniforme y sin sombras marcadas en el rostro",
    required: true,
  },
];

export const ESCOLAR_PHOTO: PhotoConfig = {
  id: "escolar",
  name: "Foto Escolar / Infantil",
  description: "Requisitos genéricos para fotografía escolar — configurable por institución",
  institution: "Genérico (configurable)",
  tolerance: "flexible",
  rules,
  systemPrompt: buildSystemPromptFromRules({
    id: "escolar",
    name: "Foto Escolar / Infantil",
    description: "Genérico",
    institution: "Institución escolar",
    tolerance: "flexible",
    rules,
    systemPrompt: "",
  }),
};

export function createEscolarPhotoConfig(overrides: {
  name?: string;
  institution?: string;
  requireUniform?: boolean;
  backgroundColors?: string;
  tolerance?: PhotoConfig["tolerance"];
}): PhotoConfig {
  const customRules = rules.map((r) => {
    if (r.id === "appropriate_clothing" && overrides.requireUniform) {
      return { ...r, label: "Uniforme escolar requerido", description: "Se requiere uniforme escolar de la institución", required: true };
    }
    if (r.id === "background" && overrides.backgroundColors) {
      return { ...r, description: `Fondo de color uniforme: ${overrides.backgroundColors}` };
    }
    return r;
  });

  const config: PhotoConfig = {
    id: "escolar",
    name: overrides.name ?? "Foto Escolar",
    description: `Configuración personalizada para ${overrides.institution ?? "institución"}`,
    institution: overrides.institution ?? "Institución escolar",
    tolerance: overrides.tolerance ?? "flexible",
    rules: customRules,
    systemPrompt: "",
  };
  config.systemPrompt = buildSystemPromptFromRules(config);
  return config;
}
