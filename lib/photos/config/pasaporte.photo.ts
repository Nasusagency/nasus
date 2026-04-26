import { buildSystemPromptFromRules, type PhotoConfig } from "../types";

const rules = [
  {
    id: "background",
    label: "Fondo blanco o crema",
    description: "El fondo debe ser blanco o crema claro, liso y uniforme, sin objetos ni sombras visibles",
    required: true,
  },
  {
    id: "face_frontal",
    label: "Cara de frente completa",
    description: "La cara debe estar completamente de frente, sin girar ni inclinar la cabeza",
    required: true,
  },
  {
    id: "face_centered",
    label: "Cara centrada",
    description: "La cara debe estar centrada en la fotografía, visible desde la cima del cabello hasta la barbilla",
    required: true,
  },
  {
    id: "expression_neutral",
    label: "Expresión neutra, boca cerrada",
    description: "Expresión facial neutra con boca cerrada; no se permiten sonrisas, muecas ni gestos",
    required: true,
  },
  {
    id: "eyes_open",
    label: "Ojos abiertos mirando a cámara",
    description: "Los ojos deben estar completamente abiertos y mirando directamente a la cámara",
    required: true,
  },
  {
    id: "no_glasses",
    label: "Sin lentes",
    description: "No se permiten lentes de ningún tipo (excepto por prescripción médica sin reflejo ni tinte)",
    required: true,
  },
  {
    id: "forehead_visible",
    label: "Frente despejada",
    description: "La frente debe ser completamente visible; no se permite cabello sobre la frente",
    required: true,
  },
  {
    id: "no_head_covering",
    label: "Sin gorra ni sombrero",
    description: "No se permiten gorras, sombreros ni cualquier cobertura de cabeza (excepto uso religioso justificado)",
    required: true,
  },
  {
    id: "collar_visible",
    label: "Cuello y hombros visibles",
    description: "El cuello y la parte superior de los hombros deben ser visibles; ropa formal o casual apropiada",
    required: true,
  },
  {
    id: "no_uniform",
    label: "Sin uniforme",
    description: "No se permiten uniformes militares, policiales ni ropa con insignias oficiales",
    required: true,
  },
  {
    id: "lighting_uniform",
    label: "Iluminación uniforme",
    description: "Iluminación uniforme en el rostro y el fondo; sin sombras duras ni reflejos brillantes",
    required: true,
  },
  {
    id: "photo_quality",
    label: "Foto nítida y en color",
    description: "Fotografía en color, nítida, sin borrosidad, sin granos digitales ni manchas",
    required: true,
  },
];

export const PASAPORTE_MX_PHOTO: PhotoConfig = {
  id: "pasaporte-mx",
  name: "Foto Pasaporte Mexicano",
  description: "Requisitos oficiales de la Secretaría de Relaciones Exteriores (SRE) de México",
  institution: "SRE — Secretaría de Relaciones Exteriores",
  tolerance: "strict",
  rules,
  systemPrompt: buildSystemPromptFromRules({
    id: "pasaporte-mx",
    name: "Foto Pasaporte Mexicano",
    description: "SRE",
    institution: "SRE",
    tolerance: "strict",
    rules,
    systemPrompt: "",
  }),
};
