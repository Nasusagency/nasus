export type FaseCliente = "Prospecto" | "Propuesta" | "Activo" | "Pausa" | "Cerrado";
export type EstadoCambio = "Pendiente" | "En revisión" | "Aprobado" | "Rechazado";

export interface ClienteEndpoint {
  ruta: string;
  version: string;
  estado: "listo" | "en desarrollo" | "deprecado";
  fecha: string;
}

export interface Milestone {
  label: string;
  done: boolean;
}

export interface Cliente {
  slug: string;
  nombre: string;
  contacto: string;
  sistema?: string;
  modalidad?: string;
  fase: FaseCliente;
  siguiente_paso?: string;
  documentos?: string[];
  endpoints?: ClienteEndpoint[];
  modelo_cobro?: string;
  notas?: string;
  milestones?: Milestone[];
  createdAt: string;
}

export interface Propuesta {
  slug: string;
  clienteSlug?: string;
  titulo: string;
  contenido: string;
  createdAt: string;
}

export interface CambioRequest {
  id: string;
  clienteSlug: string;
  descripcion: string;
  estado: EstadoCambio;
  solicitadoPor?: string;
  createdAt: string;
  updatedAt: string;
}

// ── Seed ─────────────────────────────────────────────────────────────────────

const UAG: Cliente = {
  slug: "uag",
  nombre: "Universidad Autónoma de Guadalajara",
  contacto: "Gaby Di",
  sistema: "Ping (powered by Valkiria)",
  modalidad: "API (Modalidad B)",
  fase: "Propuesta",
  siguiente_paso:
    "Confirmar si Ping/Valkiria soporta webhooks externos. Conectar con equipo de sistemas UAG.",
  documentos: [
    "certificado_licenciatura",
    "acta_nacimiento",
    "constancia_certificado",
    "fotografia",
    "carta_compromiso",
  ],
  endpoints: [
    { ruta: "/api/uag/validate", version: "1.0", estado: "listo", fecha: "2026-05-02" },
  ],
  modelo_cobro: "Setup + mensual",
  notas:
    "Contacto inicial por Gaby Di. Ella impulsa internamente. Decisor final es área de sistemas/admisiones. Endpoint construido, falta confirmar integración con Ping.",
  milestones: [
    { label: "Análisis de documentos UAG completado", done: true },
    { label: "Endpoint de validación construido y documentado", done: true },
    { label: "Reglas de fotografía UAG configuradas", done: true },
    { label: "Confirmación de integración con Ping/Valkiria", done: false },
    { label: "Ambiente de pruebas", done: false },
    { label: "Integración en producción", done: false },
  ],
  createdAt: "2026-05-02T00:00:00.000Z",
};

// ── In-memory stores ──────────────────────────────────────────────────────────

const clientes = new Map<string, Cliente>([[UAG.slug, UAG]]);
const propuestas = new Map<string, Propuesta>();
const cambios = new Map<string, CambioRequest>();

// ── Clientes ──────────────────────────────────────────────────────────────────

export function getClientes(): Cliente[] {
  return [...clientes.values()].sort((a, b) => a.nombre.localeCompare(b.nombre));
}

export function getCliente(slug: string): Cliente | undefined {
  return clientes.get(slug);
}

export function upsertCliente(
  data: Omit<Cliente, "createdAt"> & { createdAt?: string }
): Cliente {
  const existing = clientes.get(data.slug);
  const c: Cliente = {
    ...data,
    createdAt: data.createdAt ?? existing?.createdAt ?? new Date().toISOString(),
  };
  clientes.set(c.slug, c);
  return c;
}

// ── Propuestas ────────────────────────────────────────────────────────────────

export function getPropuestas(): Propuesta[] {
  return [...propuestas.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function getPropuesta(slug: string): Propuesta | undefined {
  return propuestas.get(slug);
}

export function savePropuesta(
  data: Omit<Propuesta, "createdAt">
): Propuesta {
  const p: Propuesta = { ...data, createdAt: new Date().toISOString() };
  propuestas.set(p.slug, p);
  return p;
}

// ── Cambios ───────────────────────────────────────────────────────────────────

export function getCambios(clienteSlug?: string): CambioRequest[] {
  const all = [...cambios.values()].sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt)
  );
  return clienteSlug ? all.filter((c) => c.clienteSlug === clienteSlug) : all;
}

export function saveCambio(
  data: Omit<CambioRequest, "id" | "createdAt" | "updatedAt">
): CambioRequest {
  const id = `cambio-${Date.now()}`;
  const now = new Date().toISOString();
  const c: CambioRequest = { id, ...data, createdAt: now, updatedAt: now };
  cambios.set(id, c);
  return c;
}

export function updateCambioEstado(
  id: string,
  estado: EstadoCambio
): CambioRequest | undefined {
  const c = cambios.get(id);
  if (!c) return undefined;
  const updated = { ...c, estado, updatedAt: new Date().toISOString() };
  cambios.set(id, updated);
  return updated;
}

export function deleteCambio(id: string): boolean {
  return cambios.delete(id);
}
