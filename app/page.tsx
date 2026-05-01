import type { Metadata } from "next";
import ContactForm from "./_components/ContactForm";
import DemoIsland from "./_components/DemoIsland";

export const metadata: Metadata = {
  title: "Nasus Agency — Soluciones tecnológicas artesanales",
  description:
    "Implementamos IA directamente en tus sistemas. Validador de documentos oficiales mexicanos, automatización de procesos y desarrollo a medida para startups en escala.",
  openGraph: {
    title: "Nasus Agency — Soluciones tecnológicas artesanales",
    description:
      "Implementamos IA directamente en tus sistemas. Validador de documentos oficiales mexicanos, automatización de procesos y desarrollo a medida para startups en escala.",
    type: "website",
    siteName: "Nasus Agency",
    url: "https://nasus.lat",
  },
};

const GOLD = "text-[#c4a882]";
const CYAN = "text-[#00f2ff]";
const BORDER = "border border-zinc-800";

const painPoints = [
  {
    n: "01",
    title: "Contratar tarda meses",
    desc: "Publicar vacante, entrevistas, onboarding: tres meses mínimo antes de que alguien produzca. Tu competencia ya lanzó.",
  },
  {
    n: "02",
    title: "Tu equipo interno no da abasto",
    desc: "Mantienen lo que ya existe. Los proyectos nuevos se acumulan en el backlog indefinidamente.",
  },
  {
    n: "03",
    title: "Las agencias entregan PDFs, no soluciones",
    desc: "Pagas consultorías extensas y recibes recomendaciones. La implementación sigue siendo tu problema.",
  },
];

const steps = [
  {
    n: "01",
    title: "Diagnóstico",
    desc: "Entendemos tu problema real en una sola sesión. Sin formularios extensos ni descubrimientos de semanas.",
  },
  {
    n: "02",
    title: "Propuesta",
    desc: "Una propuesta técnica clara: qué construimos, cuánto tarda, qué ROI esperar. Sin ambigüedad.",
  },
  {
    n: "03",
    title: "Implementación directa",
    desc: "Nos conectamos a tus sistemas y construimos. No subcontratamos ni tercerizamos el trabajo.",
  },
  {
    n: "04",
    title: "Entrega funcional",
    desc: "Entregamos en producción, no prototipos. Lo que construimos funciona desde el primer día.",
  },
  {
    n: "05",
    title: "ROI medible",
    desc: "Definimos métricas de éxito antes de empezar y las revisamos juntos al terminar.",
  },
];

const differentiators = [
  {
    title: "Implementación directa en tus sistemas",
    desc: "No entregamos PDFs ni presentaciones. Nos sentamos con tu equipo y construimos dentro de tus repositorios.",
  },
  {
    title: "IA como motor, juicio humano como filtro",
    desc: "Usamos los modelos más avanzados disponibles. Cada decisión crítica tiene un humano que la valida.",
  },
  {
    title: "Cobro basado en ROI",
    desc: "Definimos el valor que vamos a generar antes de firmar. Si no podemos medirlo, no cobramos por ello.",
  },
];

const portfolio = [
  {
    title: "CV AI Analyzer",
    desc: "Analizador de CVs con IA para reclutadores. Procesa hasta 10 PDFs simultáneos, genera resumen y puntaje por perfil. Incluye modo para candidatos con recomendaciones de mejora.",
    stack: ["Python", "Streamlit"],
    href: "https://recruitai.gumroad.com/l/analyzer",
  },
  {
    title: "Soccer Sticker App",
    desc: "Web app para el Mundial — registra tu álbum, gestiona duplicados, intercambia cartas con otros coleccionistas por ubicación con chat integrado.",
    stack: ["Next.js", "Supabase", "Vercel"],
    href: "https://soccersticker.app",
  },
  {
    title: "Theia.lat",
    desc: "Tienda de moda femenina con dropshipping integrado. Logística y envío gestionados por el proveedor, catálogo actualizado automáticamente.",
    stack: ["Next.js", "Supabase", "Vercel"],
    href: "https://theia.lat",
  },
];

export default function LandingPage() {
  return (
    <div className="bg-[#050508] text-white min-h-screen">
      {/* ── Sticky nav ─────────────────────────────────────────────── */}
      <nav className="sticky top-0 z-50 bg-[#050508]/90 backdrop-blur border-b border-zinc-900">
        <div className="max-w-5xl mx-auto px-6 h-14 flex items-center justify-between">
          <span className={`${GOLD} font-mono font-bold tracking-wide`}>
            Nasus Agency
          </span>
          <a
            href="mailto:nasusagency@gmail.com"
            className="text-sm border border-[#c4a882] text-[#c4a882] px-4 py-2 rounded-lg hover:bg-[#c4a882] hover:text-[#050508] transition-colors"
          >
            Hablar con Nasus
          </a>
        </div>
      </nav>

      {/* ── 1. HERO ────────────────────────────────────────────────── */}
      <section className="min-h-[calc(100vh-56px)] flex flex-col items-center justify-center px-6 text-center py-8">
        <div className="max-w-3xl mx-auto">
          <p className={`${CYAN} text-xs font-mono tracking-[0.3em] uppercase mb-5`}>
            Nasus Agency
          </p>
          <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold text-white mb-5 leading-[1.1]">
            Soluciones tecnológicas{" "}
            <span className={GOLD}>artesanales</span>
            <br className="hidden md:block" /> para empresas en escala
          </h1>
          <p className="text-zinc-400 text-xl mb-8 max-w-xl mx-auto leading-relaxed">
            Implementamos IA directamente en tus sistemas. Sin intermediarios,
            sin reuniones innecesarias.
          </p>
          <a
            href="mailto:nasusagency@gmail.com"
            className="inline-block bg-[#c4a882] text-[#050508] font-bold px-8 py-4 rounded-lg text-lg hover:bg-[#d4b892] transition-colors"
          >
            Hablar con Nasus
          </a>
        </div>
      </section>

      {/* ── 2. PROBLEMA ────────────────────────────────────────────── */}
      <section className="py-24 px-6 border-t border-zinc-900">
        <div className="max-w-5xl mx-auto">
          <p className={`${CYAN} text-xs font-mono tracking-[0.3em] uppercase mb-4`}>
            El problema
          </p>
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-16 max-w-xl">
            Tu equipo técnico está saturado. Los proyectos se acumulan.
          </h2>
          <div className="grid md:grid-cols-3 gap-6">
            {painPoints.map((p) => (
              <div key={p.n} className={`${BORDER} p-8 rounded-xl`}>
                <div className={`${GOLD} text-3xl font-bold font-mono mb-5`}>{p.n}</div>
                <h3 className="text-white font-semibold text-lg mb-3">{p.title}</h3>
                <p className="text-zinc-400 leading-relaxed">{p.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── 3. CÓMO TRABAJAMOS ─────────────────────────────────────── */}
      <section className="py-24 px-6 border-t border-zinc-900">
        <div className="max-w-5xl mx-auto">
          <p className={`${CYAN} text-xs font-mono tracking-[0.3em] uppercase mb-4`}>
            Cómo trabajamos
          </p>
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
            Proceso directo. Sin fricción.
          </h2>
          <p className="text-zinc-500 mb-16">Sin reuniones innecesarias.</p>
          <div>
            {steps.map((s) => (
              <div
                key={s.n}
                className="flex gap-8 py-8 border-b border-zinc-900 items-start"
              >
                <span className={`${GOLD} font-mono text-xl font-bold flex-shrink-0 w-10 pt-0.5`}>
                  {s.n}
                </span>
                <div>
                  <h3 className="text-white font-semibold text-lg mb-2">{s.title}</h3>
                  <p className="text-zinc-400 leading-relaxed">{s.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── 4. PRODUCTO ESTRELLA ───────────────────────────────────── */}
      <section className="py-24 px-6 border-t border-zinc-900">
        <div className="max-w-5xl mx-auto">
          <p className={`${CYAN} text-xs font-mono tracking-[0.3em] uppercase mb-4`}>
            Producto activo
          </p>
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-16">
            Solución lista para producción
          </h2>

          {/* Validador — card protagonista */}
          <div className="border border-[#c4a882] rounded-2xl p-8 md:p-10 relative bg-[#c4a882]/[0.03]">
            <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 border-2 border-[#c4a882] rounded-lg flex items-center justify-center flex-shrink-0">
                  <div className="w-4 h-4 bg-[#c4a882] rounded-sm" />
                </div>
                <h3 className="text-white font-bold text-2xl">
                  Validador de Documentos Oficiales
                </h3>
              </div>
              <span className="bg-[#c4a882] text-[#050508] text-xs font-bold px-3 py-1 rounded-full font-mono tracking-wide flex-shrink-0">
                MVP activo
              </span>
            </div>

            <div className="grid md:grid-cols-2 gap-8">
              <div>
                <p className="text-zinc-300 leading-relaxed mb-4">
                  Valida INE, CURP, RFC, Pasaporte y Acta de Nacimiento
                  automáticamente con IA. Extrae todos los campos, cruza datos
                  contra bases de datos oficiales y genera un reporte de
                  integridad en segundos. Sin intervención humana.
                </p>
                <p className={`${CYAN} text-sm font-mono mb-6`}>
                  Elimina 25+ horas semanales de revisión manual
                </p>
                <DemoIsland />
              </div>
              <div className="flex flex-col gap-3">
                {[
                  "INE / IFE — Credencial para Votar",
                  "CURP — Registro de Población",
                  "RFC — Servicio de Administración Tributaria",
                  "Pasaporte mexicano (SRE)",
                  "Acta de Nacimiento oficial",
                  "DNI / Cédula extranjera",
                ].map((doc) => (
                  <div key={doc} className="flex items-center gap-2.5 text-sm text-zinc-400">
                    <span className={`${GOLD} text-xs font-mono`}>✓</span>
                    {doc}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── 4b. NASUS FACTURAS ─────────────────────────────────────── */}
      <section className="pb-24 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="border border-zinc-800 hover:border-zinc-700 rounded-2xl p-8 md:p-10 relative transition-colors bg-zinc-900/20">
            <div className="flex flex-wrap items-start justify-between gap-4 mb-5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 border border-zinc-700 rounded-lg flex items-center justify-center flex-shrink-0">
                  <svg className="w-5 h-5 text-zinc-400" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                  </svg>
                </div>
                <h3 className="text-white font-bold text-xl">Nasus Facturas</h3>
              </div>
              <span className="bg-emerald-500 text-[#050508] text-xs font-bold px-3 py-1 rounded-full font-mono tracking-wide flex-shrink-0">
                Nuevo
              </span>
            </div>
            <p className="text-zinc-400 leading-relaxed mb-2">
              Convierte facturas de Google Ads y Meta Ads a Excel automáticamente.
              Desglose por campaña, cuenta y período listo para contabilidad.
            </p>
            <p className={`${CYAN} text-sm font-mono mb-6`}>
              Tu factura de Google o Meta en Excel en segundos
            </p>
            <a
              href="/facturas"
              className="inline-flex items-center gap-2 text-sm font-mono font-bold text-[#050508] bg-[#c4a882] hover:bg-[#d4b892] px-5 py-2.5 rounded-lg transition-colors"
            >
              Probar gratis →
            </a>
          </div>
        </div>
      </section>

      {/* ── 5. PORTAFOLIO ──────────────────────────────────────────── */}
      <section className="py-24 px-6 border-t border-zinc-900">
        <div className="max-w-5xl mx-auto">
          <p className={`${CYAN} text-xs font-mono tracking-[0.3em] uppercase mb-4`}>
            Proyectos anteriores
          </p>
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
            Experiencia previa
          </h2>
          <p className="text-zinc-500 mb-16">
            Productos que construimos y lanzamos. Muestra del rango de lo que hacemos.
          </p>
          <div className="grid md:grid-cols-3 gap-5">
            {portfolio.map((p) => (
              <a
                key={p.title}
                href={p.href}
                target="_blank"
                rel="noopener noreferrer"
                className="group border border-zinc-800 hover:border-zinc-700 rounded-xl p-6 flex flex-col gap-3 transition-colors"
              >
                <div className="flex items-start justify-between gap-2">
                  <h3 className="text-zinc-200 font-semibold group-hover:text-white transition-colors">
                    {p.title}
                  </h3>
                  <span className="text-[10px] font-mono bg-zinc-800 text-zinc-500 px-2 py-0.5 rounded-full flex-shrink-0">
                    Portafolio
                  </span>
                </div>
                <p className="text-zinc-500 text-sm leading-relaxed">{p.desc}</p>
                <div className="flex flex-wrap gap-1.5 mt-auto pt-1">
                  {p.stack.map((s) => (
                    <span
                      key={s}
                      className="text-[10px] font-mono text-zinc-600 border border-zinc-800 px-2 py-0.5 rounded"
                    >
                      {s}
                    </span>
                  ))}
                </div>
              </a>
            ))}
          </div>
        </div>
      </section>

      {/* ── 6. POR QUÉ NASUS ───────────────────────────────────────── */}
      <section className="py-24 px-6 border-t border-zinc-900">
        <div className="max-w-5xl mx-auto">
          <p className={`${CYAN} text-xs font-mono tracking-[0.3em] uppercase mb-4`}>
            Por qué Nasus
          </p>
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-16">
            No somos una agencia típica.
          </h2>
          <div className="grid md:grid-cols-3 gap-10">
            {differentiators.map((d) => (
              <div key={d.title}>
                <div className={`${GOLD} text-2xl font-bold mb-5`}>→</div>
                <h3 className="text-white font-semibold text-lg mb-3">{d.title}</h3>
                <p className="text-zinc-400 leading-relaxed">{d.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── 7. CONTACTO ────────────────────────────────────────────── */}
      <section className="py-24 px-6 border-t border-zinc-900">
        <div className="max-w-2xl mx-auto">
          <p className={`${CYAN} text-xs font-mono tracking-[0.3em] uppercase mb-4`}>
            Contacto
          </p>
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
            ¿Tienes un problema técnico real?
          </h2>
          <p className="text-zinc-400 mb-12">
            Cuéntanos. Sin compromiso, sin pitch de venta.
          </p>
          <ContactForm />
        </div>
      </section>

      {/* ── Footer ─────────────────────────────────────────────────── */}
      <footer className="py-10 px-6 border-t border-zinc-900">
        <div className="max-w-5xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
          <span className={`${GOLD} font-mono font-bold`}>Nasus Agency</span>
          <span className="text-zinc-600 text-sm">
            Soluciones tecnológicas artesanales
          </span>
          <a
            href="mailto:nasusagency@gmail.com"
            className="text-zinc-500 text-sm hover:text-[#c4a882] transition-colors"
          >
            nasusagency@gmail.com
          </a>
        </div>
      </footer>
    </div>
  );
}
