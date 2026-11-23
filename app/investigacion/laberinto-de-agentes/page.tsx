/* eslint-disable @next/next/no-html-link-for-pages -- ver app/guia/GuiaFrame.tsx */
import type { Metadata } from "next";
import GuiaFrame from "@/app/guia/GuiaFrame";
import { AUTORES_PERSONAS, INVESTIGACION, URL_ESTUDIO } from "@/lib/guia/investigacion";

export const metadata: Metadata = {
  title: "Laberinto de Agentes: cómo navegan los agentes de IA un sitio web",
  description: INVESTIGACION.definicion,
  alternates: { canonical: "/investigacion/laberinto-de-agentes" },
  openGraph: { title: "Laberinto de Agentes", description: INVESTIGACION.definicion, url: URL_ESTUDIO, type: "article" },
};

const H2 = "mt-12 border-t border-zinc-900 pt-8 font-display text-xl font-semibold text-zinc-100 sm:text-2xl";
const P = "mt-4 text-[15px] leading-7 text-zinc-300";
const UL = "mt-4 list-disc space-y-2 pl-5 text-[15px] leading-7 text-zinc-300 marker:text-[#c4a882]";

const ld = {
  "@context": "https://schema.org",
  "@type": "Article",
  headline: "Laberinto de Agentes",
  description: INVESTIGACION.definicion,
  inLanguage: "es-MX",
  datePublished: INVESTIGACION.inicio,
  dateModified: INVESTIGACION.inicio,
  url: URL_ESTUDIO,
  mainEntityOfPage: URL_ESTUDIO,
  license: INVESTIGACION.licencia.url,
  author: [
    { "@type": "Organization", name: "Nasus Agency", url: "https://nasus.mx" },
    ...AUTORES_PERSONAS.map((a) => ({ "@type": "Person", name: a.nombre, ...(a.url ? { url: a.url } : {}) })),
  ],
  publisher: { "@type": "Organization", name: "Nasus Agency", url: "https://nasus.mx" },
};

export default function LaberintoPage() {
  const autores = ["Nasus Agency", ...AUTORES_PERSONAS.map((a) => a.nombre)].join(" · ");
  return <GuiaFrame>
    <p className="font-mono text-[11px] tracking-[.2em] text-[#c4a882] uppercase">Investigación · Estudio en curso</p>
    <h1 className="mt-3 font-display text-3xl font-bold leading-tight sm:text-4xl">Laberinto de Agentes</h1>
    <p className="mt-4 text-base leading-7 text-zinc-300">{INVESTIGACION.definicion}</p>
    <p className="mt-4 font-mono text-xs text-zinc-500">Por {autores} · Inicio: <time dateTime={INVESTIGACION.inicio}>23 de noviembre de 2026</time> · Versión {INVESTIGACION.version}</p>
    <p className="mt-6 rounded-lg border border-zinc-800 bg-zinc-950/60 p-4 text-sm leading-6 text-zinc-400"><strong className="text-zinc-200">Estado:</strong> el estudio acaba de empezar. Todavía no hay resultados ni conclusiones; esta página se actualiza conforme hay datos y cada cambio queda fechado en el historial.</p>

    <h2 className={H2}>Pregunta e hipótesis</h2>
    <p className={P}>Cada vez más personas le piden a un asistente de IA que busque un proveedor, compare opciones o resuelva una duda. Ese asistente visita sitios web, pero casi nadie sabe qué hace una vez dentro.</p>
    <p className={P}>Hipótesis: la ruta que elige un agente, y las rutas que pide sin que existan, revelan lo que buscaba, sin necesidad de preguntarle nada.</p>

    <h2 className={H2}>Qué se montó</h2>
    <ul className={UL}>
      <li>Una <a className="text-[#c4a882] underline-offset-4 hover:underline" href="/guia">guía de 46 páginas</a> en nasus.mx, escritas a mano, con la información pública de Nasus. Es el mismo contenido para personas y agentes.</li>
      <li>El archivo <a className="text-[#c4a882] underline-offset-4 hover:underline" href="/llms.txt">llms.txt</a>, el <a className="text-[#c4a882] underline-offset-4 hover:underline" href="/robots.txt">robots.txt</a> y el <a className="text-[#c4a882] underline-offset-4 hover:underline" href="/sitemap.xml">sitemap</a>, que los agentes suelen leer primero.</li>
      <li>Un registro de cada petición a la guía y a esos archivos, y de las rutas inexistentes (404) de todo el sitio.</li>
    </ul>

    <h2 className={H2}>Qué se registra y qué no</h2>
    <ul className={UL}>
      <li>Se registra: fecha y hora, ruta pedida, código de respuesta, tipo de visitante y nombre del agente según el user agent que declara, página de origen dentro de la guía y dominio de procedencia.</li>
      <li>No se guarda la dirección IP: solo un código derivado de IP y día que cambia cada día y permite contar visitantes distintos, no seguirlos.</li>
      <li>No hay formularios ni búsqueda libre en esta fase, y nada de lo que un agente envíe se muestra a otros.</li>
    </ul>

    <h2 className={H2}>Qué se analiza</h2>
    <ul className={UL}>
      <li>Ramas de la guía más visitadas.</li>
      <li>Rutas que piden y no existen (por ejemplo una página de precios): la señal más reveladora.</li>
      <li>Qué agentes entran y si siguen la estructura de la guía.</li>
      <li>Caminos de una página a otra y en qué punto dejan de pedir páginas.</li>
    </ul>

    <h2 className={H2}>Limitaciones conocidas</h2>
    <ul className={UL}>
      <li>El tipo de visitante se deduce del user agent, que cualquiera puede declarar o falsear; es una señal, no una prueba.</li>
      <li>Un agente que deja de pedir páginas no necesariamente &ldquo;se rindió&rdquo;: pudo irse a buscar a otro lado.</li>
      <li>Muchos agentes abren varias páginas casi a la vez, por lo que el camino no siempre es lineal.</li>
      <li>Si el agente no tiene búsqueda web activa, responde de memoria y no deja rastro.</li>
      <li>Al ser un solo sitio, los resultados pueden no generalizar a otros.</li>
    </ul>

    <h2 className={H2}>Cómo replicarlo</h2>
    <p className={P}>El diseño es simple: contenido estático real, enlaces con nombres descriptivos, una salida en cada página y un registro de peticiones que cuente también los 404. No se necesita un servicio especial.</p>

    <h2 className={H2}>Cómo citar y reutilizar</h2>
    <p className={P}>Licencia: <a className="text-[#c4a882] underline-offset-4 hover:underline" href={INVESTIGACION.licencia.url} rel="license">{INVESTIGACION.licencia.nombre}</a>; se puede reutilizar citando la fuente.</p>
    <p className="mt-4 rounded-lg border border-zinc-800 bg-zinc-950/60 p-4 font-mono text-xs leading-6 text-zinc-400">{autores}. «Laberinto de Agentes: cómo navegan los agentes de IA un sitio web» (estudio en curso, versión {INVESTIGACION.version}). 23 de noviembre de 2026. {URL_ESTUDIO}</p>

    <h2 className={H2}>Historial de cambios</h2>
    <ul className={UL}>
      <li><time dateTime="2026-11-23">2026-11-23</time> · Versión 0.1: se publica el planteamiento, la metodología y el registro activo. Sin resultados.</li>
    </ul>

    <h2 className={H2}>Contacto</h2>
    <p className={P}>Para comentarios o colaboración: <a className="text-[#c4a882] underline-offset-4 hover:underline" href="mailto:contacto@nasus.lat">contacto@nasus.lat</a>.</p>
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld) }} />
  </GuiaFrame>;
}
