import { buildSystemPromptFromRules, type PhotoConfig } from "../types";

const rules = [
  {
    id: "background",
    label: "Fondo blanco o crema claro",
    description: "Fondo completamente blanco o crema muy claro, uniforme, sin patrones ni objetos",
    required: true,
  },
  {
    id: "color_photo",
    label: "Fotografía en color",
    description: "La fotografía debe ser en color (no blanco y negro ni filtros)",
    required: true,
  },
  {
    id: "face_proportion",
    label: "Cara ocupa 50–69% del encuadre",
    description: "La cabeza, desde la parte superior del cráneo hasta la barbilla, debe ocupar entre 50% y 69% de la altura total de la foto",
    required: true,
  },
  {
    id: "face_frontal",
    label: "Cara completamente de frente",
    description: "La cara debe estar completamente de frente; sin inclinación lateral ni frontal",
    required: true,
  },
  {
    id: "expression_neutral",
    label: "Expresión neutra",
    description: "Expresión neutral; boca cerrada; no se permiten sonrisas amplias ni gestos",
    required: true,
  },
  {
    id: "eyes_open",
    label: "Ojos abiertos, visibles y sin lentes",
    description: "Los ojos deben estar abiertos, visibles y mirando a la cámara. No se permiten lentes desde noviembre de 2016",
    required: true,
  },
  {
    id: "no_head_covering",
    label: "Sin cobertura de cabeza",
    description: "No se permiten gorras, sombreros ni coberturas de cabeza (excepto uso religioso documentado)",
    required: true,
  },
  {
    id: "forehead_visible",
    label: "Frente y órbitas oculares visibles",
    description: "La frente debe ser completamente visible; el cabello no debe cubrir los ojos ni la frente",
    required: true,
  },
  {
    id: "lighting_no_shadows",
    label: "Sin sombras en cara ni fondo",
    description: "Iluminación uniforme; sin sombras sobre el rostro, sin sombras detrás de la cabeza en el fondo",
    required: true,
  },
  {
    id: "photo_quality",
    label: "Foto nítida, reciente y en buenas condiciones",
    description: "Foto en color, de alta resolución, sin borrosidad, tomada dentro de los últimos 6 meses",
    required: true,
  },
];

export const VISA_USA_PHOTO: PhotoConfig = {
  id: "visa-usa",
  name: "Foto Visa Americana",
  description: "Requisitos USCIS/Departamento de Estado para solicitud de visa",
  institution: "U.S. Department of State / USCIS",
  tolerance: "strict",
  rules,
  systemPrompt: buildSystemPromptFromRules({
    id: "visa-usa",
    name: "Foto Visa Americana",
    description: "USCIS",
    institution: "USCIS",
    tolerance: "strict",
    rules,
    systemPrompt: "",
  }),
};
