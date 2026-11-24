import "server-only";
import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";

/**
 * Artículos de /articulos: archivos .md en content/articulos/ con frontmatter.
 *
 * Se lee del disco al construir (las páginas son estáticas). Un artículo sale
 * en el sitio, el sitemap y el índice solo si `estado: publicado`. El flujo
 * normal es: el script scripts/generar-articulo.ts abre un pull request con el
 * archivo; al aprobarlo (merge) Vercel lo publica.
 *
 * Ojo: NO usar /blog. Esa ruta es un sensor del Laberinto de Agentes y debe
 * seguir devolviendo 404 (ver RUTAS_SENSOR en lib/guia/routes.ts).
 */
export const ARTICULOS_DIR = path.join(process.cwd(), "content", "articulos");

export type Articulo = {
  slug: string;
  titulo: string;
  descripcion: string;
  /** ISO yyyy-mm-dd */
  fecha: string;
  palabraClave: string;
  /** Quién lo redactó (claude | muse | ...). Vacío si el archivo no lo indica. */
  modelo: string;
  cuerpo: string;
};

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function parse(file: string): Articulo | null {
  const slug = file.replace(/\.md$/, "");
  if (!SLUG_RE.test(slug)) return null;
  const raw = fs.readFileSync(path.join(ARTICULOS_DIR, file), "utf8");
  const { data, content } = matter(raw);
  if (data.estado !== "publicado") return null;
  const titulo = typeof data.titulo === "string" ? data.titulo.trim() : "";
  const descripcion = typeof data.descripcion === "string" ? data.descripcion.trim() : "";
  const fecha = data.fecha instanceof Date ? data.fecha.toISOString().slice(0, 10) : String(data.fecha ?? "");
  if (!titulo || !descripcion || !/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return null;
  return {
    slug,
    titulo,
    descripcion,
    fecha,
    palabraClave: typeof data.palabra_clave === "string" ? data.palabra_clave : "",
    modelo: typeof data.modelo === "string" ? data.modelo : "",
    cuerpo: content.trim(),
  };
}

/** Artículos publicados, del más reciente al más antiguo. */
export function listarArticulos(): Articulo[] {
  if (!fs.existsSync(ARTICULOS_DIR)) return [];
  return fs
    .readdirSync(ARTICULOS_DIR)
    .filter((f) => f.endsWith(".md"))
    .map(parse)
    .filter((a): a is Articulo => a !== null)
    .sort((a, b) => b.fecha.localeCompare(a.fecha));
}

export function obtenerArticulo(slug: string): Articulo | undefined {
  return listarArticulos().find((a) => a.slug === slug);
}

export type ColaEntrada = { palabraClave: string; hecho: boolean };

/** Cola de palabras clave (content/articulos/cola.json), en el orden en que se escribirán. */
export function leerCola(): ColaEntrada[] {
  try {
    const raw = JSON.parse(fs.readFileSync(path.join(ARTICULOS_DIR, "cola.json"), "utf8")) as unknown;
    if (!Array.isArray(raw)) return [];
    return raw.flatMap((e) => (e && typeof e.palabra_clave === "string" ? [{ palabraClave: e.palabra_clave, hecho: e.hecho === true }] : []));
  } catch {
    return [];
  }
}
