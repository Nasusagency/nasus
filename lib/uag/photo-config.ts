import { buildSystemPromptFromRules, type PhotoConfig } from "@/lib/photos/types";

const rules = [
  {
    id: "color_photo",
    label: "Fotografía a color",
    description: "La fotografía debe ser a color. No se aceptan fotos en blanco y negro ni tonos sepia",
    required: true,
  },
  {
    id: "background",
    label: "Fondo blanco o neutro",
    description: "Fondo liso de color blanco o gris muy claro, sin patrones, objetos, ni degradados visibles",
    required: true,
  },
  {
    id: "no_filters",
    label: "Sin edición ni filtros",
    description: "La fotografía no debe tener filtros, efectos de belleza, retoques de piel, ni edición digital visible",
    required: true,
  },
  {
    id: "no_glasses",
    label: "Sin lentes",
    description: "No se permiten lentes de ningún tipo: graduados, de sol ni de contacto con color visible",
    required: true,
  },
  {
    id: "ears_visible",
    label: "Orejas visibles",
    description: "Ambas orejas deben ser visibles. El cabello no debe cubrirlas",
    required: true,
  },
  {
    id: "uncovered_face",
    label: "Rostro descubierto",
    description: "Sin gorras, sombreros, velos, paliacates ni cualquier prenda que cubra la cabeza o parte del rostro",
    required: true,
  },
  {
    id: "posture",
    label: "Postura recta, mirada a cámara",
    description: "El sujeto debe mirar directamente a la cámara con postura erguida. Sin inclinaciones excesivas ni mirada hacia otro lado",
    required: true,
  },
  {
    id: "not_document_selfie",
    label: "No es selfie ni foto de documento",
    description: "No se aceptan fotos tomadas frente a un espejo (selfie), fotos de fotos, ni fotos de documentos de identidad",
    required: true,
  },
  {
    id: "appropriate_clothing_women",
    label: "Vestimenta apropiada (mujeres)",
    description: "Las mujeres deben vestir sin escote pronunciado ni tirantes. Se recomienda playera o blusa de manga",
    required: false,
  },
  {
    id: "appropriate_clothing_men",
    label: "Vestimenta apropiada (hombres)",
    description: "Los hombres deben vestir ropa casual visible (playera, camisa). No se aceptan fotos sin camisa",
    required: false,
  },
  {
    id: "photo_quality",
    label: "Foto nítida y bien iluminada",
    description: "Fotografía clara, sin borrosidad, con iluminación uniforme y sin sombras marcadas en el rostro",
    required: true,
  },
];

const baseConfig: PhotoConfig = {
  id: "escolar",
  name: "Fotografía Oficial UAG",
  description: "Requisitos de fotografía para admisión y expediente UAG",
  institution: "Universidad Autónoma de Guadalajara",
  tolerance: "medium",
  rules,
  systemPrompt: "",
};

baseConfig.systemPrompt = buildSystemPromptFromRules(baseConfig);

export const UAG_FOTO_CONFIG: PhotoConfig = baseConfig;
