export interface CampanaAds {
  nombre: string;
  cantidad: number | null;
  unidades: string | null;
  importe: number;
}

export interface CuentaAds {
  nombre: string;
  id_cuenta: string | null;
  campanas: CampanaAds[];
  subtotal: number;
  iva: number | null;
  total: number;
}

export interface FacturaExtraccion {
  tipo: "google" | "meta";
  numero_documento: string | null;
  fecha: string | null;
  periodo: string | null;
  rfc_emisor: string | null;
  rfc_receptor: string | null;
  cuentas: CuentaAds[];
  subtotal: number;
  iva: number;
  total: number;
}
