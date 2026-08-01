import type { Metadata } from "next";
import ContactForm from "./_components/ContactForm";
import DemoIsland from "./_components/DemoIsland";
import FacturasDemo from "./_components/FacturasDemo";
import FotosDemo from "./_components/FotosDemo";

export const metadata: Metadata = {
  title: "Nasus Agency — Desarrollo web, apps y soluciones tecnológicas a medida",
  description:
    "Páginas web, aplicaciones, CRMs y automatización para empresas en crecimiento. Implementación directa, sin intermediarios.",
  alternates: { canonical: "https://nasus.lat" },
  openGraph: {
    title: "Nasus Agency — Desarrollo web, apps y soluciones tecnológicas a medida",
    description:
      "Páginas web, aplicaciones, CRMs y automatización para empresas en crecimiento. Implementación directa, sin intermediarios.",
    type: "website",
    siteName: "Nasus Agency",
    url: "https://nasus.lat",
  },
  twitter: {
    card: "summary_large_image",
    title: "Nasus Agency — Desarrollo web, apps y soluciones tecnológicas a medida",
    description:
      "Páginas web, aplicaciones, CRMs y automatización para empresas en crecimiento. Implementación directa, sin intermediarios.",
  },
};

const GOLD = "text-[#c4a882]";
const CYAN = "text-[#00f2ff]";
const BORDER = "border border-zinc-800";
const WHATSAPP_URL = "https://wa.me/523329621602";

const SOCIAL_LINKS = [
  {
    name: "X",
    href: "https://twitter.com/NasusAgency",
    icon: (
      <path d="M18.9 2H22l-7.6 8.7L23.3 22h-6.9l-5.4-7-6.2 7H1.4l8.1-9.3L1 2h7l4.9 6.5L18.9 2Zm-1.2 18.1h1.9L6.4 3.8H4.3l13.4 16.3Z" />
    ),
  },
  {
    name: "LinkedIn",
    href: "https://linkedin.com/company/nasus-agency",
    icon: (
      <path d="M4.98 3.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5ZM3 9h4v12H3V9Zm7 0h3.8v1.7h.05c.53-1 1.83-2.05 3.77-2.05 4.03 0 4.78 2.65 4.78 6.1V21h-4v-5.6c0-1.34-.02-3.06-1.87-3.06-1.87 0-2.16 1.46-2.16 2.97V21h-4V9Z" />
    ),
  },
  {
    name: "Instagram",
    href: "https://instagram.com/nasus.agency",
    icon: (
      <path d="M12 2.2c2.7 0 3 0 4.1.06 1.1.05 1.8.22 2.2.37.55.21.94.47 1.36.88.41.42.67.81.88 1.36.15.4.32 1.1.37 2.2.06 1.1.06 1.4.06 4.1s0 3-.06 4.1c-.05 1.1-.22 1.8-.37 2.2-.21.55-.47.94-.88 1.36-.42.41-.81.67-1.36.88-.4.15-1.1.32-2.2.37-1.1.06-1.4.06-4.1.06s-3 0-4.1-.06c-1.1-.05-1.8-.22-2.2-.37a3.7 3.7 0 0 1-1.36-.88 3.7 3.7 0 0 1-.88-1.36c-.15-.4-.32-1.1-.37-2.2-.06-1.1-.06-1.4-.06-4.1s0-3 .06-4.1c.05-1.1.22-1.8.37-2.2.21-.55.47-.94.88-1.36.42-.41.81-.67 1.36-.88.4-.15 1.1-.32 2.2-.37 1.1-.06 1.4-.06 4.1-.06ZM12 0C9.25 0 8.9 0 7.8.06c-1.1.05-1.86.23-2.52.5a5.9 5.9 0 0 0-2.13 1.4A5.9 5.9 0 0 0 1.75 4.1c-.27.66-.45 1.42-.5 2.52C1.2 7.7 1.2 8.05 1.2 10.8v2.4c0 2.75 0 3.1.06 4.2.05 1.1.23 1.86.5 2.52.28.68.65 1.26 1.4 2 .69.7 1.32 1.13 2 1.4.66.27 1.42.45 2.52.5 1.1.06 1.45.06 4.2.06s3.1 0 4.2-.06c1.1-.05 1.86-.23 2.52-.5a5.9 5.9 0 0 0 2-1.4c.7-.69 1.13-1.32 1.4-2 .27-.66.45-1.42.5-2.52.06-1.1.06-1.45.06-4.2s0-3.1-.06-4.2c-.05-1.1-.23-1.86-.5-2.52a5.9 5.9 0 0 0-1.4-2 5.9 5.9 0 0 0-2-1.4c-.66-.27-1.42-.45-2.52-.5C15.1 0 14.75 0 12 0Zm0 5.84A6.16 6.16 0 1 0 12 18.2 6.16 6.16 0 0 0 12 5.84Zm0 10.16a4 4 0 1 1 0-8 4 4 0 0 1 0 8Zm6.4-10.4a1.44 1.44 0 1 1-2.88 0 1.44 1.44 0 0 1 2.88 0Z" />
    ),
  },
  {
    name: "Facebook",
    href: "https://www.facebook.com/share/18fR2Yn33t/",
    icon: (
      <path d="M22 12a10 10 0 1 0-11.56 9.88v-6.99H7.9V12h2.54V9.8c0-2.5 1.49-3.89 3.77-3.89 1.09 0 2.24.2 2.24.2v2.46h-1.26c-1.24 0-1.63.77-1.63 1.56V12h2.78l-.44 2.89h-2.34v6.99A10 10 0 0 0 22 12Z" />
    ),
  },
  {
    name: "TikTok",
    href: "https://tiktok.com/@nasusagency",
    icon: (
      <path d="M16.6 2h-3.2v13.6a3 3 0 1 1-2.1-2.86V9.4a6.2 6.2 0 1 0 5.3 6.14V8.3a7.9 7.9 0 0 0 4.6 1.47V6.6A4.7 4.7 0 0 1 16.6 2Z" />
    ),
  },
];

function SocialIcons({ className = "" }: { className?: string }) {
  return (
    <div className={`flex items-center gap-4 ${className}`}>
      {SOCIAL_LINKS.map(({ name, href, icon }) => (
        <a
          key={name}
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={name}
          className="text-[#c4a882] hover:text-[#00f2ff] transition-colors"
        >
          <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true">
            {icon}
          </svg>
        </a>
      ))}
    </div>
  );
}

const specializations = [
  "Páginas web a medida",
  "Aplicaciones web y móviles",
  "CRMs y sistemas de gestión",
  "Automatización de procesos",
  "Ecosistemas de marketing digital",
];

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
    desc: "Analizador de CVs con IA para reclutadores. Procesa hasta 10 PDFs simultáneos, genera resumen y puntaje por perfil.",
    stack: ["Python", "Streamlit"],
    href: "https://recruitai.gumroad.com/l/analyzer",
  },
  {
    title: "Soccer Sticker App",
    desc: "Web app para el Mundial — registra tu álbum, gestiona duplicados, intercambia cartas con otros coleccionistas por ubicación.",
    stack: ["Next.js", "Supabase", "Vercel"],
    href: "https://soccersticker.app",
  },
  {
    title: "Theia.lat",
    desc: "Tienda de moda femenina con dropshipping integrado. Logística y envío gestionados por el proveedor.",
    stack: ["Next.js", "Supabase", "Vercel"],
    href: "https://theia.lat",
  },
];

type Tool = {
  id: string;
  badge: string;
  badgeClass: string;
  cardClass: string;
  title: string;
  tagline: string;
  desc: string;
  features: string[];
  ctaText: string;
  Demo?: typeof DemoIsland;
};

const TOOLS: Tool[] = [
  {
    id: "validador",
    badge: "MVP activo",
    badgeClass: "bg-[#c4a882] text-[#050508]",
    cardClass: "border-[#c4a882] bg-[#c4a882]/[0.03]",
    title: "Validador de Documentos",
    tagline: "Elimina 25+ horas semanales de revisión manual",
    desc: "Valida INE, CURP, RFC, Pasaporte y Acta de Nacimiento con IA. Extrae todos los campos, cruza datos contra bases de datos oficiales y genera un reporte de integridad en segundos.",
    features: [
      "INE / IFE — Credencial para Votar",
      "CURP — Registro de Población",
      "RFC — SAT",
      "Pasaporte mexicano (SRE)",
      "Acta de Nacimiento oficial",
      "DNI / Cédula extranjera",
      "Título universitario / Cédula profesional",
      "Certificado de Bachillerato",
    ],
    ctaText: "Pedir acceso →",
    Demo: DemoIsland,
  },
  {
    id: "facturas",
    badge: "Nuevo",
    badgeClass: "bg-emerald-500 text-[#050508]",
    cardClass: "border-zinc-800",
    title: "Nasus Facturas",
    tagline: "Tu factura de Google o Meta en Excel en segundos",
    desc: "Extrae facturas de Google Ads y Meta Ads a Excel automáticamente. Desglose por campaña, cuenta y período con tres hojas listas para contabilidad.",
    features: [
      "Google Ads — todas las cuentas y campañas",
      "Meta Ads — ad accounts y conjuntos",
      "Hoja Resumen con RFC emisor y receptor",
      "Hoja Detalle con todas las campañas",
      "Hoja Para Contabilidad lista para entregar",
      "Detecta actividad no válida (importes negativos)",
    ],
    ctaText: "Pedir acceso →",
    Demo: FacturasDemo,
  },
  {
    id: "fotos",
    badge: "Activo",
    badgeClass: "bg-zinc-700 text-zinc-300",
    cardClass: "border-zinc-800",
    title: "Validador de Fotografías",
    tagline: "Foto rechazada cero: valida antes de imprimir",
    desc: "Verifica que las fotografías cumplan los requisitos oficiales para pasaportes, visas y documentos escolares. Configura tus propios criterios institucionales.",
    features: [
      "Pasaporte mexicano — requisitos SRE",
      "Visa USA — estándar USCIS",
      "Foto escolar / infantil",
      "Configuración institucional personalizada",
      "Detecta lentes, accesorios, fondo incorrecto",
      "Presets guardables por institución",
    ],
    ctaText: "Pedir acceso →",
    Demo: FotosDemo,
  },
  {
    id: "webapps",
    badge: "Disponible",
    badgeClass: "bg-[#00f2ff] text-[#050508]",
    cardClass: "border-zinc-800",
    title: "Páginas web a medida",
    tagline: "De la idea a producción en semanas, no meses",
    desc: "Sitios profesionales construidos con Next.js, optimizados para SEO y conversión. Con panel de administración opcional para que tú manejes tu contenido.",
    features: [
      "Construido con Next.js — rápido y SEO-first",
      "Diseño a medida, no templates",
      "Panel de administración opcional",
      "Integración con tus sistemas y formularios",
    ],
    ctaText: "Ver más →",
  },
];

const SCHEMA_ORG = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "Nasus Agency",
  url: "https://nasus.lat",
  email: "nasusagency@gmail.com",
  description: "Agencia de soluciones tecnológicas artesanales. Implementamos IA directamente en los sistemas de nuestros clientes.",
};

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
            href={WHATSAPP_URL}
            target="_blank"
            rel="noopener noreferrer"
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
            href={WHATSAPP_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block bg-[#c4a882] text-[#050508] font-bold px-8 py-4 rounded-lg text-lg hover:bg-[#d4b892] transition-colors"
          >
            Hablar con Nasus
          </a>
        </div>
      </section>

      {/* ── 2. ESPECIALIZACIÓN ─────────────────────────────────────── */}
      <section className="py-24 px-6 border-t border-zinc-900">
        <div className="max-w-5xl mx-auto">
          <p className={`${CYAN} text-xs font-mono tracking-[0.3em] uppercase mb-4`}>
            Especialización
          </p>
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-16 max-w-xl">
            Construimos tu presencia digital completa
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-12">
            {specializations.map((s) => (
              <div
                key={s}
                className={`${BORDER} rounded-xl p-5 flex flex-col gap-3`}
              >
                <span className={`${GOLD} text-lg font-mono`}>→</span>
                <span className="text-zinc-200 text-sm font-medium leading-snug">
                  {s}
                </span>
              </div>
            ))}
          </div>
          <div className={`${BORDER} rounded-xl p-8 bg-[#c4a882]/[0.03]`}>
            <p className="text-zinc-300 leading-relaxed mb-6">
              También trabajamos en software a medida, CRMs, sistemas
              financieros y cualquier solución digital según la viabilidad y
              necesidad de tu negocio. Si tienes un problema específico,
              hablemos.
            </p>
            <a
              href={WHATSAPP_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-sm font-mono font-bold text-[#050508] bg-[#c4a882] hover:bg-[#d4b892] px-5 py-2.5 rounded-lg transition-colors"
            >
              Hablar con Nasus
            </a>
          </div>
        </div>
      </section>

      {/* ── 3. PROBLEMA ────────────────────────────────────────────── */}
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

      {/* ── 4. CÓMO TRABAJAMOS ─────────────────────────────────────── */}
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

      {/* ── 5. HERRAMIENTAS ACTIVAS ────────────────────────────────── */}
      <section className="py-24 px-6 border-t border-zinc-900">
        <div className="max-w-5xl mx-auto">
          <p className={`${CYAN} text-xs font-mono tracking-[0.3em] uppercase mb-4`}>
            Herramientas activas
          </p>
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
            Automatización lista para conectar a tus sistemas
          </h2>
          <p className="text-zinc-500 mb-16">
            Cuatro productos en producción. Pide acceso y los integramos en tu flujo esta semana.
          </p>

          <div className="flex flex-col gap-8">
            {TOOLS.map(({ id, badge, badgeClass, cardClass, title, tagline, desc, features, ctaText, Demo }) => (
              <div key={id} className={`border rounded-2xl p-8 md:p-10 ${cardClass}`}>
                <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
                  <h3 className="text-white font-bold text-2xl">{title}</h3>
                  <span className={`text-xs font-bold px-3 py-1 rounded-full font-mono tracking-wide flex-shrink-0 ${badgeClass}`}>
                    {badge}
                  </span>
                </div>

                <div className={Demo ? "grid md:grid-cols-2 gap-8" : ""}>
                  <div>
                    <p className={`${CYAN} text-sm font-mono mb-3`}>{tagline}</p>
                    <p className="text-zinc-300 leading-relaxed mb-5">{desc}</p>
                    <div className="flex flex-col gap-2 mb-6">
                      {features.map((f) => (
                        <div key={f} className="flex items-center gap-2 text-sm text-zinc-400">
                          <span className={`${GOLD} text-xs font-mono flex-shrink-0`}>✓</span>
                          {f}
                        </div>
                      ))}
                    </div>
                    <a
                      href={WHATSAPP_URL}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 text-sm font-mono font-bold text-[#050508] bg-[#c4a882] hover:bg-[#d4b892] px-5 py-2.5 rounded-lg transition-colors"
                    >
                      {ctaText}
                    </a>
                  </div>
                  {Demo && (
                    <div className="flex flex-col">
                      <p className="text-xs font-mono text-zinc-600 uppercase tracking-widest mb-3">
                        Demo interactivo
                      </p>
                      <Demo />
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── 6. PORTAFOLIO ──────────────────────────────────────────── */}
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

      {/* ── 7. POR QUÉ NASUS ───────────────────────────────────────── */}
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

      {/* ── 8. CONTACTO ────────────────────────────────────────────── */}
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
          <div className="mt-12 pt-8 border-t border-zinc-900">
            <p className="text-zinc-600 text-xs font-mono uppercase tracking-widest mb-4">
              Síguenos
            </p>
            <SocialIcons />
          </div>
        </div>
      </section>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(SCHEMA_ORG) }}
      />

      {/* ── Footer ─────────────────────────────────────────────────── */}
      <footer className="py-10 px-6 border-t border-zinc-900">
        <div className="max-w-5xl mx-auto flex flex-col md:flex-row justify-between items-center gap-6">
          <span className={`${GOLD} font-mono font-bold`}>Nasus Agency</span>
          <span className="text-zinc-600 text-sm">
            Soluciones tecnológicas artesanales
          </span>
          <SocialIcons />
          <a
            href={WHATSAPP_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="text-zinc-500 text-sm hover:text-[#c4a882] transition-colors"
          >
            Hablar con Nasus
          </a>
        </div>
      </footer>
    </div>
  );
}
