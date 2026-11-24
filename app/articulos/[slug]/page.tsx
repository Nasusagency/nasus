/* eslint-disable @next/next/no-html-link-for-pages -- enlaces <a> normales, igual que el resto de las páginas públicas de contenido (ver GuiaFrame). */
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import ReactMarkdown from "react-markdown";
import GuiaFrame from "@/app/guia/GuiaFrame";
import { listarArticulos, obtenerArticulo } from "@/lib/articulos/store";

type Params = { slug: string };

export const dynamicParams = false;

export function generateStaticParams(): Params[] {
  return listarArticulos().map((a) => ({ slug: a.slug }));
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { slug } = await params;
  const a = obtenerArticulo(slug);
  if (!a) return { title: "Artículo no encontrado", robots: { index: false } };
  return {
    title: a.titulo,
    description: a.descripcion,
    alternates: { canonical: `/articulos/${a.slug}` },
    openGraph: { title: a.titulo, description: a.descripcion, type: "article", publishedTime: a.fecha, url: `/articulos/${a.slug}` },
  };
}

export default async function ArticuloPage({ params }: { params: Promise<Params> }) {
  const { slug } = await params;
  const a = obtenerArticulo(slug);
  if (!a) notFound();

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: a.titulo,
    description: a.descripcion,
    datePublished: a.fecha,
    inLanguage: "es-MX",
    mainEntityOfPage: `https://nasus.mx/articulos/${a.slug}`,
    author: { "@type": "Organization", name: "Nasus Agency", url: "https://nasus.mx" },
    publisher: { "@type": "Organization", name: "Nasus Agency", url: "https://nasus.mx" },
  };

  return <GuiaFrame>
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
    <p className="font-mono text-[11px] tracking-[.2em] text-[#c4a882] uppercase"><a href="/articulos" className="hover:underline">Artículos</a></p>
    <h1 className="mt-3 font-display text-3xl font-bold leading-tight sm:text-4xl">{a.titulo}</h1>
    <time dateTime={a.fecha} className="mt-3 block font-mono text-xs text-zinc-600">{a.fecha}</time>
    <article className="mt-8 space-y-4 text-base leading-7 text-zinc-300 [&_a]:text-[#c4a882] [&_a]:underline-offset-4 [&_a:hover]:underline [&_h2]:mt-10 [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:text-zinc-100 [&_h3]:mt-6 [&_h3]:font-semibold [&_h3]:text-zinc-100 [&_li]:pl-1 [&_ol]:list-decimal [&_ol]:space-y-1 [&_ol]:pl-5 [&_strong]:text-zinc-100 [&_ul]:list-disc [&_ul]:space-y-1 [&_ul]:pl-5">
      <ReactMarkdown>{a.cuerpo}</ReactMarkdown>
    </article>
    <aside className="mt-14 border-t border-zinc-900 pt-6 text-sm text-zinc-400">
      ¿Quieres aplicar esto en tu empresa? <a href="/contacto" className="text-[#c4a882] underline-offset-4 hover:underline">Cuéntanos tu caso</a>.
    </aside>
  </GuiaFrame>;
}
