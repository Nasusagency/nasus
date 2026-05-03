import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPropuesta } from "@/lib/admin/data";

export const metadata: Metadata = {
  robots: "noindex, nofollow",
};

// Minimal markdown-to-HTML renderer (headings, bold, lists, code, paragraphs)
function renderMarkdown(md: string): string {
  return md
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .split(/\n\n+/)
    .map((block) => {
      const trimmed = block.trim();
      // H1
      if (/^# /.test(trimmed)) {
        return `<h1>${trimmed.replace(/^# /, "")}</h1>`;
      }
      // H2
      if (/^## /.test(trimmed)) {
        return `<h2>${trimmed.replace(/^## /, "")}</h2>`;
      }
      // H3
      if (/^### /.test(trimmed)) {
        return `<h3>${trimmed.replace(/^### /, "")}</h3>`;
      }
      // Unordered list
      if (/^[•\-\*] /m.test(trimmed)) {
        const items = trimmed
          .split("\n")
          .filter((l) => /^[•\-\*] /.test(l.trim()))
          .map((l) => `<li>${inlineFormat(l.replace(/^[•\-\*] /, ""))}</li>`)
          .join("");
        return `<ul>${items}</ul>`;
      }
      // Ordered list
      if (/^\d+\. /m.test(trimmed)) {
        const items = trimmed
          .split("\n")
          .filter((l) => /^\d+\. /.test(l.trim()))
          .map((l) => `<li>${inlineFormat(l.replace(/^\d+\. /, ""))}</li>`)
          .join("");
        return `<ol>${items}</ol>`;
      }
      // Horizontal rule
      if (/^---+$/.test(trimmed)) return "<hr />";
      // Paragraph
      return `<p>${inlineFormat(trimmed)}</p>`;
    })
    .join("\n");
}

function inlineFormat(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/`(.+?)`/g, "<code>$1</code>");
}

export default async function PropuestaPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const propuesta = getPropuesta(slug);
  if (!propuesta) notFound();

  const html = renderMarkdown(propuesta.contenido);
  const date = new Date(propuesta.createdAt).toLocaleDateString("es-MX", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900">
      {/* Header bar */}
      <header className="bg-white border-b border-zinc-200 px-6 py-4">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <span className="text-[#c4a882] font-mono font-bold text-sm tracking-widest">
            NASUS
          </span>
          <span className="text-xs text-zinc-400">Propuesta confidencial · {date}</span>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-12">
        {propuesta.clienteSlug && (
          <p className="text-xs text-zinc-400 font-mono uppercase tracking-widest mb-2">
            Preparada para {propuesta.clienteSlug.toUpperCase()}
          </p>
        )}

        <article
          className="prose prose-zinc prose-sm sm:prose-base max-w-none
            [&_h1]:text-2xl [&_h1]:font-bold [&_h1]:text-zinc-900 [&_h1]:mb-6 [&_h1]:mt-0
            [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:text-zinc-800 [&_h2]:mt-10 [&_h2]:mb-3
            [&_h3]:text-base [&_h3]:font-semibold [&_h3]:text-zinc-700 [&_h3]:mt-6 [&_h3]:mb-2
            [&_p]:text-zinc-600 [&_p]:leading-relaxed [&_p]:mb-4
            [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:mb-4 [&_ul_li]:text-zinc-600 [&_ul_li]:mb-1
            [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:mb-4 [&_ol_li]:text-zinc-600 [&_ol_li]:mb-1
            [&_strong]:text-zinc-800 [&_strong]:font-semibold
            [&_code]:bg-zinc-100 [&_code]:text-zinc-700 [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-[0.85em]
            [&_hr]:border-zinc-200 [&_hr]:my-8"
          dangerouslySetInnerHTML={{ __html: html }}
        />

        {/* CTA */}
        <div className="mt-16 pt-8 border-t border-zinc-200">
          <p className="text-sm text-zinc-500 mb-4">
            ¿Listo para avanzar? Contacta a Nasus Agency para dar el siguiente paso.
          </p>
          <a
            href="mailto:nasusagency@gmail.com"
            className="inline-block bg-[#050508] text-[#c4a882] font-mono text-sm px-6 py-3 rounded-xl hover:bg-zinc-800 transition-colors"
          >
            Contactar → nasusagency@gmail.com
          </a>
        </div>
      </main>

      <footer className="border-t border-zinc-200 px-6 py-6 mt-12">
        <div className="max-w-3xl mx-auto">
          <p className="text-xs text-zinc-400">
            © Nasus Agency · nasusagency@gmail.com · nasus.lat · Documento confidencial
          </p>
        </div>
      </footer>
    </div>
  );
}
