import { buildSystemPromptFromRules, type PhotoConfig, type PhotoRule, type PhotoTolerance } from "../types";

export interface PhotoPanelOptions {
  background: "white" | "gray" | "free";
  grayscale: boolean;
  faceFrontal: boolean;
  foreheadVisible: boolean;
  noGlasses: boolean;
  noHeadAccessories: boolean;
  expression: "neutral" | "free";
  clothing: "no_uniform" | "no_collar" | "free";
  dimensions: string;
  tolerance: PhotoTolerance;
}

export const EDUCATIONAL_DEFAULT: PhotoPanelOptions = {
  background: "white",
  grayscale: true,
  faceFrontal: true,
  foreheadVisible: true,
  noGlasses: true,
  noHeadAccessories: false,
  expression: "neutral",
  clothing: "free",
  dimensions: "",
  tolerance: "medium",
};

export function buildCustomPhotoConfig(
  opts: PhotoPanelOptions,
  name = "Configuración institucional",
  institution = "Institución"
): PhotoConfig {
  const rules: PhotoRule[] = [];

  const bgLabel = opts.background === "white" ? "Fondo blanco" : opts.background === "gray" ? "Fondo gris" : "Fondo liso";
  const bgDesc = opts.background === "white"
    ? "El fondo debe ser completamente blanco, liso y uniforme, sin sombras ni objetos"
    : opts.background === "gray"
    ? "El fondo debe ser gris liso y uniforme, sin patrones"
    : "El fondo debe ser de color liso y uniforme, sin patrones ni objetos visibles";
  rules.push({ id: "background", label: bgLabel, description: bgDesc, required: true });

  if (opts.grayscale) {
    rules.push({ id: "grayscale", label: "Escala de grises", description: "La fotografía debe estar en blanco y negro (escala de grises), sin colores", required: true });
  }

  rules.push({ id: "face_frontal", label: "Rostro de frente", description: "El rostro debe estar completamente de frente, sin inclinaciones ni giros laterales", required: opts.faceFrontal });

  rules.push({ id: "forehead_visible", label: "Frente descubierta", description: "La frente debe estar completamente visible, sin cabello ni accesorios cubriéndola", required: opts.foreheadVisible });

  rules.push({ id: "eyes_open", label: "Ojos abiertos", description: "Los ojos deben estar abiertos y claramente visibles", required: true });

  if (opts.noGlasses) {
    rules.push({ id: "no_glasses", label: "Sin lentes", description: "No se permiten lentes de ningún tipo (graduados, sol, etc.)", required: true });
  }

  if (opts.noHeadAccessories) {
    rules.push({ id: "no_head_accessories", label: "Sin accesorios en cabeza", description: "No se permiten gorros, sombreros, diademas, aretes grandes ni accesorios en la cabeza", required: true });
  }

  rules.push({
    id: "expression",
    label: opts.expression === "neutral" ? "Expresión neutral" : "Expresión natural",
    description: opts.expression === "neutral"
      ? "Expresión neutral con boca cerrada, sin sonrisa ni gestos"
      : "Se acepta cualquier expresión natural y tranquila",
    required: opts.expression === "neutral",
  });

  if (opts.clothing === "no_uniform") {
    rules.push({ id: "clothing", label: "Sin uniforme", description: "No se debe usar uniforme ni ropa con logos institucionales visibles", required: true });
  } else if (opts.clothing === "no_collar") {
    rules.push({ id: "clothing", label: "Sin cuello visible", description: "La foto debe ser encuadre del rostro sin que se aprecie ropa ni cuello", required: true });
  }

  rules.push({ id: "photo_quality", label: "Foto nítida y bien iluminada", description: "Fotografía clara, sin borrosidad, con iluminación uniforme y sin sombras marcadas en el rostro", required: true });

  if (opts.dimensions.trim()) {
    rules.push({ id: "dimensions", label: `Dimensiones: ${opts.dimensions}`, description: `Dimensiones requeridas: ${opts.dimensions}. Nota: esta medida no puede verificarse visualmente desde la imagen.`, required: false });
  }

  const config: PhotoConfig = {
    id: "escolar",
    name,
    description: `Configuración personalizada — ${institution}`,
    institution,
    tolerance: opts.tolerance,
    rules,
    systemPrompt: "",
  };
  config.systemPrompt = buildSystemPromptFromRules(config);
  return config;
}
