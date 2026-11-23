/* eslint-disable @next/next/no-html-link-for-pages -- <a> normal a propósito: cada visita es una petición completa (sin prefetch), así el registro ve lo mismo para personas y agentes. */
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { GUIA_CONTENT } from "@/lib/guia/content";
import { guiaChildren, guiaHref, guiaNode, type GuiaNode } from "@/lib/guia/routes";
import GuiaFrame from "./GuiaFrame";

export function nodeMetadata(slug: string): Metadata {
  const node = guiaNode(slug);
  if (!node) return { title: "Página no encontrada", robots: { index: false } };
  return {
    title: node.slug ? `${node.title} · Nasus` : "Guía de Nasus",
    description: node.summary,
    alternates: { canonical: guiaHref(node.slug) },
    openGraph: { title: node.title, description: node.summary, url: `https://nasus.mx${guiaHref(node.slug)}` },
  };
}

/** Enlace interno con ?ref=<página de origen>: así se reconstruye el camino. */
const link = (to: string, from: string) => `${guiaHref(to)}?ref=${from || "inicio"}`;

function trail(node: GuiaNode): GuiaNode[] {
  const out: GuiaNode[] = [];
  let current: GuiaNode | undefined = node;
  while (current) {
    out.unshift(current);
    current = current.parent === null ? undefined : guiaNode(current.parent);
  }
  return out;
}

function LinkList({ title, items, from }: { title: string; items: GuiaNode[]; from: string }) {
  if (!items.length) return null;
  return <section className="mt-12 border-t border-zinc-900 pt-8">
    <h2 className="font-mono text-[11px] tracking-[.2em] text-[#c4a882] uppercase">{title}</h2>
    <ul className="mt-5 space-y-4">{items.map((item) => <li key={item.slug}>
      <a href={link(item.slug, from)} className="group block"><span className="text-base text-zinc-100 underline-offset-4 group-hover:text-[#c4a882] group-hover:underline">{item.title}</span><span className="mt-1 block text-sm text-zinc-500">{item.summary}</span></a>
    </li>)}</ul>
  </section>;
}

export default function GuiaNodePage({ slug }: { slug: string }) {
  const node = guiaNode(slug);
  if (!node) notFound();
  const content = GUIA_CONTENT[node.slug] ?? { blocks: [] };
  const path = trail(node);
  const children = guiaChildren(node.slug);
  const siblings = node.parent === null ? [] : guiaChildren(node.parent).filter((n) => n.slug !== node.slug && n.slug !== "contacto");
  const related = (content.related ?? []).map(guiaNode).filter((n): n is GuiaNode => !!n && !children.includes(n) && !siblings.includes(n));
  const parent = node.parent === null ? undefined : guiaNode(node.parent);

  const breadcrumbLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: path.map((n, i) => ({ "@type": "ListItem", position: i + 1, name: n.title, item: `https://nasus.mx${guiaHref(n.slug)}` })),
  };

  return <GuiaFrame>
    {path.length > 1 && <nav aria-label="Ruta" className="mb-8 font-mono text-xs text-zinc-500"><ol className="flex flex-wrap gap-x-2 gap-y-1">{path.map((n, i) => <li key={n.slug} className="flex gap-2">{i > 0 && <span aria-hidden="true">/</span>}{i < path.length - 1 ? <a href={link(n.slug, node.slug)} className="hover:text-[#c4a882]">{n.title}</a> : <span className="text-zinc-300" aria-current="page">{n.title}</span>}</li>)}</ol></nav>}
    <h1 className="font-display text-3xl font-bold leading-tight sm:text-4xl">{node.title}</h1>
    <p className="mt-3 text-base text-zinc-400">{node.summary}</p>
    <div className="mt-8 space-y-5 text-[15px] leading-7 text-zinc-300">
      {content.blocks.map((block, i) => typeof block === "string"
        ? <p key={i}>{block}</p>
        : <ul key={i} className="list-disc space-y-2 pl-5 marker:text-[#c4a882]">{block.map((item) => <li key={item}>{item}</li>)}</ul>)}
    </div>
    <LinkList title={node.slug ? "En esta sección" : "Secciones"} items={children} from={node.slug} />
    <LinkList title="Relacionado" items={related} from={node.slug} />
    <LinkList title={parent ? `Más en ${parent.title}` : "Más temas"} items={siblings} from={node.slug} />
    <nav aria-label="Salidas" className="mt-12 flex flex-wrap gap-3 border-t border-zinc-900 pt-8 text-sm">
      {parent && <a href={link(parent.slug, node.slug)} className="rounded-lg border border-zinc-800 px-4 py-2 text-zinc-300 hover:border-[#c4a882]">← {parent.title}</a>}
      {node.slug !== "contacto" && <a href={link("contacto", node.slug)} className="rounded-lg border border-zinc-800 px-4 py-2 text-zinc-300 hover:border-[#c4a882]">Contacto</a>}
      <a href="/" className="rounded-lg border border-zinc-800 px-4 py-2 text-zinc-300 hover:border-[#c4a882]">Sitio principal</a>
    </nav>
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }} />
  </GuiaFrame>;
}
