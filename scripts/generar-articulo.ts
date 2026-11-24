/**
 * Genera UN artículo para /articulos con Claude y lo deja en content/articulos/.
 *
 * Toma la primera palabra clave sin `hecho` de content/articulos/cola.json,
 * escribe el artículo con `estado: publicado` y marca la entrada como hecha.
 * El flujo normal corre en GitHub Actions y abre un pull request: aprobarlo
 * (merge) es lo que publica el artículo. Nada llega al sitio sin esa revisión.
 *
 * Uso:
 *   ANTHROPIC_API_KEY=... npm run articulo:generar
 *   npm run articulo:generar -- --keyword "texto"   (ignora la cola)
 *
 * Reglas de contenido (iguales a las de la guía pública): solo hechos ya
 * publicados en public/llms.txt; sin precios, plazos ni clientes inventados;
 * sin cifras que el modelo no pueda respaldar.
 */
import fs from "node:fs";
import path from "node:path";
import Anthropic from "@anthropic-ai/sdk";
import { GUIA_NODES } from "../lib/guia/routes";

const ROOT = process.cwd();
const DIR = path.join(ROOT, "content", "articulos");
const COLA = path.join(DIR, "cola.json");
const MODEL = process.env.ARTICULOS_MODEL || "claude-sonnet-4-6";

type Entrada = { palabra_clave: string; enfoque?: string; enlazar?: string[]; hecho: boolean };

function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 70)
    .replace(/-+$/g, "");
}

function hoyMexico(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Mexico_City" }).format(new Date());
}

function yamlStr(s: string): string {
  return JSON.stringify(s.replace(/\s+/g, " ").trim());
}

const RUTAS_VALIDAS = new Set(GUIA_NODES.map((n) => (n.slug ? `/${n.slug}` : "/guia")).concat(["/contacto", "/validador", "/articulos"]));

/** Quita HTML crudo y enlaces fuera de nasus.mx / rutas internas conocidas. */
function sanear(cuerpo: string): string {
  return cuerpo
    .replace(/<[^>]+>/g, "")
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_m, texto: string, url: string) => {
      const u = url.trim().replace(/^https:\/\/nasus\.mx/, "");
      return RUTAS_VALIDAS.has(u.split("#")[0].replace(/\/$/, "")) ? `[${texto}](${u})` : texto;
    })
    .trim();
}

async function main() {
  if (!process.env.ANTHROPIC_API_KEY) throw new Error("Falta ANTHROPIC_API_KEY");

  const args = process.argv.slice(2);
  const kwIdx = args.indexOf("--keyword");
  const cola: Entrada[] = fs.existsSync(COLA) ? JSON.parse(fs.readFileSync(COLA, "utf8")) : [];
  let entrada: Entrada | undefined;
  if (kwIdx >= 0 && args[kwIdx + 1]) entrada = { palabra_clave: args[kwIdx + 1], hecho: false };
  else entrada = cola.find((e) => !e.hecho);
  if (!entrada) {
    console.log("La cola de palabras clave está vacía: no se generó nada.");
    return;
  }

  const slug = slugify(entrada.palabra_clave);
  const destino = path.join(DIR, `${slug}.md`);
  if (fs.existsSync(destino)) throw new Error(`Ya existe ${slug}.md`);

  const hechos = fs.readFileSync(path.join(ROOT, "public", "llms.txt"), "utf8").split("## English summary")[0];
  const rutas = [...RUTAS_VALIDAS].sort().join("\n");
  const existentes = fs.readdirSync(DIR).filter((f) => f.endsWith(".md")).map((f) => `/articulos/${f.replace(/\.md$/, "")}`);

  const system = `Eres redactor de contenido de Nasus Agency, una agencia mexicana de software, IA y automatización. Escribes artículos de blog en español de México para dueños y directivos de empresas, en tono claro, directo y sin exageraciones.

REGLAS ESTRICTAS
- Los ÚNICOS hechos sobre Nasus que puedes afirmar son los de la sección HECHOS PUBLICADOS. No inventes clientes, casos, cifras de resultados, precios, tarifas, plazos, certificaciones ni estadísticas. Si no puedes respaldar un dato, no lo incluyas.
- Contenido general del tema (cómo funciona algo, criterios para decidir) sí puedes explicarlo, con honestidad sobre límites y cuándo NO conviene lo que describes.
- Aporta valor real: ejemplos concretos y verosímiles (sin presentarlos como casos de clientes de Nasus), pasos accionables, errores comunes. Nada de relleno ni frases genéricas.
- Largo: 700 a 1100 palabras. Estructura con subtítulos ## (de 3 a 5), listas solo si ayudan.
- Incluye la palabra clave de forma natural en el título, en el primer párrafo y en al menos un subtítulo, sin forzarla.
- Enlaces internos: usa SOLO rutas de la lista RUTAS INTERNAS, en formato markdown [texto](/ruta). Incluye de 2 a 4. Cierra con una invitación breve a /contacto.
- No uses HTML ni emojis. No uses el nombre "Nasus" más de 3 veces.
- Formato de salida EXACTO, sin nada antes ni después:
TITULO: <título de hasta 65 caracteres>
DESCRIPCION: <meta descripción de 120 a 155 caracteres>
---
<cuerpo en markdown, sin repetir el título>`;

  const user = `PALABRA CLAVE: ${entrada.palabra_clave}
ENFOQUE: ${entrada.enfoque ?? "Elige el ángulo más útil para un dueño de empresa."}
ENLACES SUGERIDOS: ${(entrada.enlazar ?? []).join(", ") || "(los que mejor encajen)"}

RUTAS INTERNAS PERMITIDAS:
${rutas}
${existentes.length ? `\nARTÍCULOS YA PUBLICADOS (puedes enlazarlos si vienen al caso):\n${existentes.join("\n")}\n` : ""}
HECHOS PUBLICADOS DE NASUS:
${hechos}`;

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const res = await client.messages.create({
    model: MODEL,
    max_tokens: 4000,
    system,
    messages: [{ role: "user", content: user }],
  });
  const texto = res.content.map((b) => (b.type === "text" ? b.text : "")).join("").trim();

  const m = texto.match(/^TITULO:\s*(.+)\nDESCRIPCION:\s*(.+)\n---\n([\s\S]+)$/);
  if (!m) throw new Error("La respuesta del modelo no tiene el formato esperado");
  const titulo = m[1].trim();
  const descripcion = m[2].trim();
  const cuerpo = sanear(m[3]);
  const palabras = cuerpo.split(/\s+/).length;
  if (titulo.length > 80 || descripcion.length < 80 || descripcion.length > 200) throw new Error("Título o descripción fuera de rango");
  if (palabras < 450) throw new Error(`Artículo demasiado corto (${palabras} palabras)`);

  const md = `---
titulo: ${yamlStr(titulo)}
descripcion: ${yamlStr(descripcion)}
fecha: ${hoyMexico()}
palabra_clave: ${yamlStr(entrada.palabra_clave)}
estado: publicado
---

${cuerpo}
`;
  fs.writeFileSync(destino, md);

  if (kwIdx < 0) {
    entrada.hecho = true;
    fs.writeFileSync(COLA, JSON.stringify(cola, null, 2) + "\n");
  }
  console.log(`Generado content/articulos/${slug}.md (${palabras} palabras, modelo ${MODEL})`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : "Error desconocido");
  process.exit(1);
});
