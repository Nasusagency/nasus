import type { Metadata } from "next";
import ContactForm from "./_components/ContactForm";

export const metadata: Metadata = {
  title: "Nasus Agency — Soluciones tecnológicas artesanales para empresas en escala",
  description:
    "Implementamos IA directamente en tus sistemas. Sin intermediarios, sin reuniones innecesarias. ROI medible desde el primer proyecto.",
  openGraph: {
    title: "Nasus Agency — Soluciones tecnológicas artesanales",
    description:
      "Implementamos IA directamente en tus sistemas. Sin intermediarios, sin reuniones innecesarias.",
    type: "website",
    siteName: "Nasus Agency",
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

export default function LandingPage() {
  return (
    <div className="bg-[#050508] text-white min-h-screen">
      {/* ── Sticky nav ───────────────────────────────────────────── */}
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

      {/* ── 1. HERO ──────────────────────────────────────────────── */}
      <section className="min-h-[calc(100vh-56px)] flex flex-col items-center justify-center px-6 text-center py-20">
        <div className="max-w-3xl mx-auto">
          <p
            className={`${CYAN} text-xs font-mono tracking-[0.3em] uppercase mb-8`}
          >
            Nasus Agency
          </p>
          <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold text-white mb-6 leading-[1.1]">
            Soluciones tecnológicas{" "}
            <span className={GOLD}>artesanales</span>
            <br className="hidden md:block" /> para empresas en escala
          </h1>
          <p className="text-zinc-400 text-xl mb-12 max-w-xl mx-auto leading-relaxed">
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

      {/* ── 2. PROBLEMA ──────────────────────────────────────────── */}
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
                <div className={`${GOLD} text-3xl font-bold font-mono mb-5`}>
                  {p.n}
                </div>
                <h3 className="text-white font-semibold text-lg mb-3">
                  {p.title}
                </h3>
                <p className="text-zinc-400 leading-relaxed">{p.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── 3. CÓMO TRABAJAMOS ───────────────────────────────────── */}
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
                <span
                  className={`${GOLD} font-mono text-xl font-bold flex-shrink-0 w-10 pt-0.5`}
                >
                  {s.n}
                </span>
                <div>
                  <h3 className="text-white font-semibold text-lg mb-2">
                    {s.title}
                  </h3>
                  <p className="text-zinc-400 leading-relaxed">{s.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── 4. PRODUCTOS ─────────────────────────────────────────── */}
      <section className="py-24 px-6 border-t border-zinc-900">
        <div className="max-w-5xl mx-auto">
          <p className={`${CYAN} text-xs font-mono tracking-[0.3em] uppercase mb-4`}>
            Productos
          </p>
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-16">
            Soluciones listas para producción
          </h2>
          <div className="grid md:grid-cols-3 gap-6">
            {/* Card activo */}
            <div className="border border-[#c4a882] p-8 rounded-xl relative flex flex-col">
              <span className="absolute top-4 right-4 bg-[#c4a882] text-[#050508] text-xs font-bold px-3 py-1 rounded-full">
                Disponible ahora
              </span>
              <div className="w-10 h-10 border-2 border-[#c4a882] rounded-lg mb-6 flex items-center justify-center">
                <div className="w-4 h-4 bg-[#c4a882] rounded-sm" />
              </div>
              <h3 className="text-white font-bold text-xl mb-3">
                Validador de Documentos Oficiales
              </h3>
              <p className="text-zinc-400 mb-4 leading-relaxed flex-1">
                Valida INE, CURP, RFC, Pasaporte y Acta de Nacimiento
                automáticamente con IA. Sin intervención humana.
              </p>
              <p className={`${CYAN} text-sm font-mono mb-6`}>
                Elimina 25+ horas semanales de revisión manual
              </p>
              <a
                href="/"
                className="inline-block border border-[#c4a882] text-[#c4a882] px-4 py-2 rounded-lg text-sm text-center hover:bg-[#c4a882] hover:text-[#050508] transition-colors"
              >
                Ver demo →
              </a>
            </div>

            {/* Cards próximamente */}
            {[2, 3].map((n) => (
              <div
                key={n}
                className={`${BORDER} p-8 rounded-xl relative flex flex-col opacity-50`}
              >
                <span className="absolute top-4 right-4 bg-zinc-800 text-zinc-500 text-xs font-bold px-3 py-1 rounded-full">
                  Próximamente
                </span>
                <div className="w-10 h-10 border-2 border-zinc-700 rounded-lg mb-6" />
                <h3 className="text-zinc-500 font-bold text-xl mb-3">
                  En desarrollo
                </h3>
                <p className="text-zinc-600 leading-relaxed flex-1">
                  Próximo producto de Nasus Agency. Contáctanos para saber más.
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── 5. POR QUÉ NASUS ─────────────────────────────────────── */}
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
                <h3 className="text-white font-semibold text-lg mb-3">
                  {d.title}
                </h3>
                <p className="text-zinc-400 leading-relaxed">{d.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── 6. CONTACTO ──────────────────────────────────────────── */}
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

      {/* ── Footer ───────────────────────────────────────────────── */}
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
