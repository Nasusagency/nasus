import { PASAPORTE_MX_PHOTO } from "./pasaporte.photo";
import { VISA_USA_PHOTO } from "./visa-usa.photo";
import { ESCOLAR_PHOTO } from "./escolar.photo";
import type { PhotoConfig, PhotoType } from "../types";

export const PHOTO_REGISTRY: Record<PhotoType, PhotoConfig> = {
  "pasaporte-mx": PASAPORTE_MX_PHOTO,
  "visa-usa": VISA_USA_PHOTO,
  escolar: ESCOLAR_PHOTO,
};

export function getPhotoConfig(id: PhotoType): PhotoConfig {
  return PHOTO_REGISTRY[id];
}

export type { PhotoType, PhotoConfig };
