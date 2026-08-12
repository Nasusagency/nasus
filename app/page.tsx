import type { Metadata } from "next";
import Image from "next/image";
import AssistantHint from "./_components/AssistantHint";
import SiteChrome from "./_components/SiteChrome";
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
const EYEBROW = `${GOLD} text-xs font-mono tracking-[0.3em] uppercase mb-6`;
const SECTION =
  "relative chapter-seam py-28 md:py-36 px-6 scroll-mt-16 overflow-hidden";
/* ─────────────────────────────────────────────────────────────────────────
   DOS números de WhatsApp, separados a propósito. No intercambiar.

   HUMANO (+52 33 2914 2391) — WhatsApp Business normal. Atiende una persona.
     Destino de todo CTA comercial: "Hablar con Nasus", "Contactar",
     formulario de contacto, CTAs al final de las demos.

   ASISTENTE (+52 33 2962 1602) — línea conectada a la WhatsApp Cloud API de
     Meta. Aquí NO responde una persona: es el producto Nasus WhatsApp
     Assistant. Único destino: el CTA "Probar asistente".
   ───────────────────────────────────────────────────────────────────────── */
const WHATSAPP_HUMANO = "https://wa.me/523329142391";
const WHATSAPP_ASSISTANT = "https://wa.me/523329621602";

/** Alias del número humano: es el destino por defecto de los CTA. */
const WHATSAPP_URL = WHATSAPP_HUMANO;

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

/** Capacidades resumidas bajo el CTA del hero. */
const CAPABILITIES = [
  "Web",
  "Software",
  "IA",
  "Automatización",
  "Sistemas internos",
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

/** Qué construimos — cuatro categorías amplias, no un catálogo de servicios. */
const buildCategories = [
  {
    n: "01",
    title: "Productos digitales",
    desc: "Webs, aplicaciones y plataformas.",
  },
  {
    n: "02",
    title: "Sistemas empresariales",
    desc: "CRMs, backoffices, sistemas financieros y herramientas internas.",
  },
  {
    n: "03",
    title: "IA y automatización",
    desc: "Asistentes, procesamiento documental, workflows e integraciones.",
  },
  {
    n: "04",
    title: "Infraestructura comercial",
    desc: "E-commerce, captación, analítica y ecosistemas digitales.",
  },
];

const steps = [
  {
    n: "01",
    title: "Diagnóstico",
    desc: "Entendemos el problema real y el contexto técnico.",
  },
  {
    n: "02",
    title: "Propuesta",
    desc: "Definimos qué construiremos, alcance, tiempos y criterios de éxito.",
  },
  {
    n: "03",
    title: "Desarrollo e integración",
    desc: "Construimos directamente sobre tus sistemas e integraciones.",
  },
  {
    n: "04",
    title: "Lanzamiento y seguimiento",
    desc: "Entregamos en producción, medimos resultados y ajustamos cuando sea necesario.",
  },
];

const differentiators = [
  {
    title: "Implementación directa",
    desc: "Construimos dentro de tus sistemas. Sin capas innecesarias entre quien define la solución y quien la desarrolla.",
  },
  {
    title: "Tecnología elegida por el problema",
    desc: "IA cuando aporta valor. Software tradicional cuando es suficiente. Elegimos la herramienta por viabilidad, costo y resultado.",
  },
  {
    title: "Desarrollo flexible",
    desc: "Podemos entrar desde un proyecto puntual hasta acompañar a tu equipo como capacidad técnica adicional.",
  },
];

type Caso = {
  id: string;
  name: string;
  category: string;
  desc: string;
  /** Segunda línea opcional; solo cuando aporta algo real. */
  note?: string;
  /**
   * Stack visible. Vacío a propósito cuando no está documentado en el repo:
   * preferimos no mostrar nada antes que inventar tecnologías.
   */
  stack: string[];
  href: string;
  external: boolean;
  cta: string;
  /** Dominio mostrado en el panel cuando todavía no hay screenshot. */
  domain: string;
  /** Ruta en /public de la captura, cuando exista. */
  image?: string;
};

const cases: Caso[] = [
  {
    id: "ceemi",
    name: "CEEMI",
    category: "Presencia digital / Conversión",
    desc: "Sitio comercial para clínica estética orientado a adquisición y conversión, con catálogo de tratamientos, programas, precios y captación directa vía WhatsApp.",
    stack: [],
    href: "https://www.ceemispa.com/",
    external: true,
    cta: "Ver proyecto ↗",
    domain: "ceemispa.com",
    image: "/casos/ceemi.png",
  },
  {
    id: "theia",
    name: "Theia",
    category: "E-commerce / Operación",
    desc: "E-commerce construido de extremo a extremo con catálogo, pagos, base de datos y fulfillment conectado con proveedor.",
    stack: ["Next.js", "Supabase", "Vercel"],
    href: "https://theia.lat",
    external: true,
    cta: "Ver proyecto ↗",
    domain: "theia.lat",
    image: "/casos/theia.png",
  },
  {
    id: "validador",
    name: "Validador de Documentos",
    category: "IA / Automatización",
    desc: "Sistema para extracción, validación y cruce de información documental mediante IA.",
    note: "Diseñado para reducir horas de revisión manual y estandarizar procesos documentales.",
    stack: ["Next.js", "Claude API", "Supabase"],
    href: "#productos",
    external: false,
    cta: "Ver demo ↓",
    domain: "nasus.lat/validador",
    image: "/casos/validador.png",
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
  /** Se conservan completas; en pantalla mostramos las 4 primeras. */
  features: string[];
  /** Sustantivo para el resumen "+ N …" cuando hay más de 4. */
  moreNoun: string;
  ctaText: string;
  /** Destino del CTA. Por defecto el número humano; solo el asistente usa el suyo. */
  ctaHref?: string;
  /** Etiqueta técnica sobre el título (p. ej. "// WHATSAPP CLOUD API"). */
  meta?: string;
  Demo?: typeof DemoIsland;
};

const VISIBLE_FEATURES = 4;

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
    moreNoun: "validaciones más",
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
    moreNoun: "capacidades más",
    ctaText: "Pedir acceso →",
    Demo: FacturasDemo,
  },
  {
    id: "whatsapp-assistant",
    badge: "En producción",
    badgeClass: "bg-[#00f2ff] text-[#050508]",
    cardClass: "border-[#00f2ff]/40 bg-[#00f2ff]/[0.03]",
    meta: "// WHATSAPP CLOUD API",
    title: "Nasus WhatsApp Assistant",
    tagline: "Tu cliente escribe. El sistema entiende. Tu equipo recibe contexto.",
    desc: "Asistente conectado a WhatsApp que distingue prospectos de clientes, usa el contexto específico de cada negocio y convierte solicitudes reales en trabajo estructurado.",
    features: [
      "Distingue prospecto de cliente registrado en cada mensaje",
      "Carga el contexto del negocio del cliente antes de responder",
      "Detecta cuándo un mensaje es una solicitud concreta y cuándo no",
      "Formaliza la solicitud y la envía por correo con resumen y urgencia",
      "Acusa recibo dentro de la misma conversación, sin cortar el tono",
      "Conversaciones persistidas con acceso restringido por RLS",
    ],
    moreNoun: "capacidades más",
    ctaText: "Probar asistente →",
    // Único CTA de la landing que apunta a la línea de la Cloud API.
    ctaHref: WHATSAPP_ASSISTANT,
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
    moreNoun: "validaciones más",
    ctaText: "Pedir acceso →",
    Demo: FotosDemo,
  },
];

const SCHEMA_ORG = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "Nasus Agency",
  url: "https://nasus.lat",
  email: "nasusagency@gmail.com",
  description:
    "Diseñamos, construimos e integramos software, IA y automatización en los sistemas de nuestros clientes.",
};

export default function LandingPage() {
  return (
    <div className="bg-[#050508] text-white min-h-screen relative">
      <SiteChrome />

      {/* ── Navbar dinámica ────────────────────────────────────────── */}
      {/* Se renderiza en el servidor; SiteChrome solo alterna data-scrolled. */}
      <nav
        id="site-nav"
        data-scrolled="false"
        className="group sticky top-0 z-50 transition-[background-color,backdrop-filter,border-color] duration-500 border-b border-transparent data-[scrolled=true]:bg-[#050508]/80 data-[scrolled=true]:backdrop-blur-xl data-[scrolled=true]:border-[#c4a882]/15"
      >
        <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between gap-4">
          <span className="font-mono text-[13px] tracking-[0.25em] text-white">
            NASUS AGENCY
          </span>
          <span
            id="nav-chapter"
            aria-hidden="true"
            className="hidden lg:block font-mono text-[11px] tracking-[0.2em] text-white/30"
          />
          <div className="hidden md:flex items-center gap-7 font-mono text-xs text-zinc-500">
            <a href="#productos" className="hover:text-[#c4a882] transition-colors">
              Productos
            </a>
            <a href="#casos" className="hover:text-[#c4a882] transition-colors">
              Casos
            </a>
            <a href="#contacto" className="hover:text-[#c4a882] transition-colors">
              Contacto
            </a>
          </div>
          <a
            href={WHATSAPP_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm border border-[#c4a882] text-[#c4a882] px-4 py-2 rounded-lg hover:bg-[#c4a882] hover:text-[#050508] transition-colors whitespace-nowrap"
          >
            Hablar con Nasus
          </a>
        </div>
      </nav>

      {/* ── 1. HERO editorial ──────────────────────────────────────── */}
      <section className="relative min-h-[92svh] flex flex-col justify-center px-6 md:px-[5vw] py-24 overflow-hidden">
        {/* Glow cian sutil. Estático: sigue al scroll natural, sin listener. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-36 -right-24 w-[520px] h-[520px] rounded-full blur-[50px]"
          style={{
            background:
              "radial-gradient(circle, rgba(0,242,255,.14), transparent 70%)",
          }}
        />
        {/* Retícula que se desvanece hacia abajo — continuidad con el capítulo 01. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 opacity-50"
          style={{
            backgroundImage:
              "linear-gradient(rgba(196,168,130,.05) 1px, transparent 1px),linear-gradient(90deg, rgba(196,168,130,.05) 1px, transparent 1px)",
            backgroundSize: "64px 64px",
            maskImage: "linear-gradient(to bottom, black, transparent 65%)",
            WebkitMaskImage: "linear-gradient(to bottom, black, transparent 65%)",
          }}
        />

        <div className="relative max-w-[1150px]">
          <p
            data-reveal
            className={`${GOLD} text-xs font-mono tracking-[0.3em] uppercase mb-7`}
          >
            N° 00 — Agencia de tecnología artesanal
          </p>

          <h1
            data-reveal
            style={{ ["--reveal-delay" as string]: "0.08s" }}
            className="font-display font-extrabold text-white leading-[1.08] text-[clamp(44px,8.5vw,100px)] max-w-[1150px]"
          >
            Construimos <span className={GOLD}>tecnología</span> que mueve
            empresas.
          </h1>

          <p
            data-reveal
            style={{ ["--reveal-delay" as string]: "0.22s" }}
            className="max-w-[540px] mt-9 font-mono text-[15px] leading-[1.9] text-white/65"
          >
            IA, software y automatización conectados directamente a tus sistemas.
          </p>

          <div
            data-reveal
            style={{ ["--reveal-delay" as string]: "0.3s" }}
            className="mt-12 flex flex-wrap items-center gap-4"
          >
            <a
              href="#contacto"
              className="inline-flex items-center gap-3 px-8 py-4 border border-[#c4a882] text-white font-mono text-[13px] tracking-[0.15em] transition-colors hover:bg-[#c4a882] hover:text-[#050508]"
            >
              CUÉNTANOS QUÉ NECESITAS <span aria-hidden="true">→</span>
            </a>
          </div>

          <div
            data-reveal
            style={{ ["--reveal-delay" as string]: "0.38s" }}
            className="mt-14 flex flex-wrap items-center gap-x-3 gap-y-2 font-mono text-[10px] sm:text-xs text-zinc-600 uppercase tracking-[0.2em]"
          >
            {CAPABILITIES.map((c, i) => (
              <span key={c} className="flex items-center gap-3">
                {i > 0 && (
                  <span className="text-zinc-800" aria-hidden="true">
                    ·
                  </span>
                )}
                {c}
              </span>
            ))}
          </div>

          <div data-reveal style={{ ["--reveal-delay" as string]: "0.46s" }} className="mt-8">
            <AssistantHint />
          </div>
        </div>
      </section>

      {/* ── 2. PRODUCTOS EN PRODUCCIÓN ─────────────────────────────── */}
      <section id="productos" className={SECTION}>
        <div className="max-w-5xl mx-auto">
          <span aria-hidden="true" className="chapter-numeral">01</span>
          <p data-reveal className={EYEBROW}>N° 01 — Productos en producción</p>
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4 max-w-2xl text-balance">
            Ya construimos soluciones que puedes usar hoy.
          </h2>
          <p className="text-zinc-500 mb-16 max-w-xl">
            Productos funcionales listos para integrarse a operaciones reales.
          </p>

          <div className="flex flex-col gap-8">
            {TOOLS.map(({ id, badge, badgeClass, cardClass, title, tagline, desc, features, moreNoun, ctaText, ctaHref, meta, Demo }) => (
              <div key={id} className={`border rounded-2xl p-6 sm:p-8 md:p-10 ${cardClass}`}>
                <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
                  <div>
                    {meta && (
                      <p className="font-mono text-[10px] tracking-[0.3em] text-[#00f2ff]/70 mb-2">
                        {meta}
                      </p>
                    )}
                    <h3 className="text-white font-bold text-xl sm:text-2xl">{title}</h3>
                  </div>
                  <span className={`text-xs font-bold px-3 py-1 rounded-full font-mono tracking-wide flex-shrink-0 ${badgeClass}`}>
                    {badge}
                  </span>
                </div>

                <div className={Demo ? "grid md:grid-cols-2 gap-8" : ""}>
                  <div>
                    <p className={`${CYAN} text-sm font-mono mb-3`}>{tagline}</p>
                    <p className="text-zinc-300 leading-relaxed mb-5">{desc}</p>
                    <div className="flex flex-col gap-2 mb-6">
                      {features.slice(0, VISIBLE_FEATURES).map((f) => (
                        <div key={f} className="flex items-start gap-2 text-sm text-zinc-400">
                          <span className={`${GOLD} text-xs font-mono flex-shrink-0 pt-1`}>✓</span>
                          {f}
                        </div>
                      ))}
                      {features.length > VISIBLE_FEATURES && (
                        <p className="text-sm font-mono text-zinc-600 pl-5">
                          + {features.length - VISIBLE_FEATURES} {moreNoun}
                        </p>
                      )}
                    </div>
                    <a
                      href={ctaHref ?? WHATSAPP_URL}
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

      {/* ── 3. EL PROBLEMA ─────────────────────────────────────────── */}
      <section id="problema" className={SECTION}>
        <div className="max-w-5xl mx-auto">
          <span aria-hidden="true" className="chapter-numeral">02</span>
          <p data-reveal className={EYEBROW}>N° 02 — El problema</p>
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-16 max-w-xl text-balance">
            Tu equipo técnico está saturado. Los proyectos se acumulan.
          </h2>
          <div data-reveal-group className="grid md:grid-cols-3 gap-6">
            {painPoints.map((p) => (
              <div data-reveal key={p.n} className={`${BORDER} p-8 rounded-xl`}>
                <div className={`${GOLD} text-3xl font-bold font-mono mb-5`}>{p.n}</div>
                <h3 className="text-white font-semibold text-lg mb-3">{p.title}</h3>
                <p className="text-zinc-400 leading-relaxed">{p.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── 4. QUÉ CONSTRUIMOS ─────────────────────────────────────── */}
      <section id="construimos" className={SECTION}>
        <div className="max-w-5xl mx-auto">
          <span aria-hidden="true" className="chapter-numeral">03</span>
          <p data-reveal className={EYEBROW}>N° 03 — Qué construimos</p>
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-16 max-w-xl text-balance">
            Lo que podemos construir contigo.
          </h2>
          <div data-reveal-group className="border-t border-zinc-900">
            {buildCategories.map(({ n, title, desc }) => (
              <div
                data-reveal
                key={n}
                className="grid md:grid-cols-[1.1fr_1fr] gap-x-12 gap-y-3 py-10 border-b border-zinc-900 transition-[padding-left,border-color] duration-500 hover:pl-4 hover:border-[#00f2ff]/40"
              >
                <div className="flex items-baseline gap-5">
                  <span className={`${GOLD} font-mono text-sm flex-shrink-0`}>{n}</span>
                  <h3 className="text-white text-2xl md:text-3xl font-bold leading-tight">
                    {title}
                  </h3>
                </div>
                <p className="text-zinc-400 leading-relaxed md:pt-2 pl-10 md:pl-0">
                  {desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── 5. CASOS REALES ────────────────────────────────────────── */}
      <section id="casos" className={SECTION}>
        <div className="max-w-5xl mx-auto">
          <span aria-hidden="true" className="chapter-numeral">04</span>
          <p data-reveal className={EYEBROW}>N° 04 — Casos reales</p>
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4 max-w-xl text-balance">
            Proyectos en producción.
          </h2>
          <p className="text-zinc-500 mb-16 max-w-xl">
            Sistemas que diseñamos, construimos y lanzamos.
          </p>

          <div className="flex flex-col gap-16 md:gap-20">
            {cases.map((c, i) => (
              <article
                key={c.id}
                className="grid md:grid-cols-2 gap-8 md:gap-12 items-center"
              >
                {/* Visual */}
                <div
                  data-cursor-view
                  className={`case-reveal ${i % 2 === 1 ? "md:order-2" : ""}`}
                  style={{ ["--reveal-delay" as string]: `${i * 0.08}s` }}
                >
                  <div
                    className={`${BORDER} rounded-2xl overflow-hidden bg-[#c4a882]/[0.03] aspect-[16/10] relative transition-[transform,border-color,box-shadow] duration-700 hover:-translate-y-2 hover:border-[#00f2ff]/60`}
                  >
                    {c.image ? (
                      <Image
                        src={c.image}
                        alt={`Captura del proyecto ${c.name}`}
                        fill
                        sizes="(min-width: 768px) 50vw, 100vw"
                        // Las capturas no comparten proporción (1.23–2.04) y el
                        // panel es 16/10: anclamos arriba para que el recorte se
                        // coma el pie de página y no el encabezado del sitio.
                        className="object-cover object-top"
                      />
                    ) : (
                      <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-6 text-center">
                        <span className="font-mono text-sm sm:text-base text-zinc-400 break-all">
                          {c.domain}
                        </span>
                        <span className="font-mono text-[10px] uppercase tracking-[0.25em] text-zinc-700">
                          En producción
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Contenido */}
                <div
                  data-reveal
                  style={{ ["--reveal-delay" as string]: `${0.12 + i * 0.08}s` }}
                  className={i % 2 === 1 ? "md:order-1" : ""}
                >
                  <p className={`${CYAN} text-[11px] font-mono tracking-[0.25em] uppercase mb-4`}>
                    {c.category}
                  </p>
                  <h3 className="text-white font-bold text-2xl md:text-3xl mb-4">
                    {c.name}
                  </h3>
                  <p className="text-zinc-300 leading-relaxed mb-3">{c.desc}</p>
                  {c.note && (
                    <p className="text-zinc-500 text-sm leading-relaxed mb-3">{c.note}</p>
                  )}
                  {c.stack.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-5 mb-6">
                      {c.stack.map((s) => (
                        <span
                          key={s}
                          className="text-[10px] font-mono text-zinc-500 border border-zinc-800 px-2 py-0.5 rounded"
                        >
                          {s}
                        </span>
                      ))}
                    </div>
                  )}
                  <a
                    href={c.href}
                    {...(c.external
                      ? { target: "_blank", rel: "noopener noreferrer" }
                      : {})}
                    className={`${GOLD} inline-flex items-center gap-2 text-sm font-mono border-b border-transparent hover:border-[#c4a882] transition-colors mt-2`}
                  >
                    {c.cta}
                  </a>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ── 6. CÓMO TRABAJAMOS ─────────────────────────────────────── */}
      <section className={SECTION}>
        <div className="max-w-5xl mx-auto">
          <span aria-hidden="true" className="chapter-numeral">05</span>
          <p data-reveal className={EYEBROW}>N° 05 — Cómo trabajamos</p>
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-16 text-balance">
            Proceso directo. Sin fricción.
          </h2>
          <div>
            {steps.map((s) => (
              <div
                key={s.n}
                className="flex gap-6 sm:gap-8 py-8 border-b border-zinc-900 items-start"
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

      {/* ── 7. POR QUÉ NASUS ───────────────────────────────────────── */}
      <section className={SECTION}>
        <div className="max-w-5xl mx-auto">
          <span aria-hidden="true" className="chapter-numeral">06</span>
          <p data-reveal className={EYEBROW}>N° 06 — Por qué Nasus</p>
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-16 text-balance">
            Diseñamos. Construimos. Integramos.
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

      {/* ── 8. CTA / CONTACTO ──────────────────────────────────────── */}
      <section id="contacto" className={SECTION}>
        <div className="max-w-2xl mx-auto">
          <span aria-hidden="true" className="chapter-numeral">07</span>
          <p
            data-reveal
            className="font-mono text-[11px] tracking-[0.3em] text-white/35 mb-4"
          >
            {"// READY WHEN YOU ARE"}
          </p>
          <p data-reveal className={EYEBROW}>N° 07 — Contacto</p>
          <h2
            data-reveal
            style={{ ["--reveal-delay" as string]: "0.1s" }}
            className="font-display font-bold text-white leading-[1.15] text-[clamp(38px,6.5vw,76px)] mb-6"
          >
            <span className="block">Tu problema.</span>
            <span className={`block ${CYAN}`}>Nuestro código.</span>
          </h2>
          <p
            data-reveal
            style={{ ["--reveal-delay" as string]: "0.2s" }}
            className="font-mono text-[15px] text-white/60 mb-12"
          >
            Cuéntanos el problema. Nosotros vemos la parte técnica.
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
      {/* pb extra en móvil para que el asistente flotante no tape el contenido. */}
      <footer className="py-10 pb-28 md:pb-10 px-6 border-t border-zinc-900">
        <div className="max-w-5xl mx-auto flex flex-col md:flex-row justify-between items-center gap-6">
          <span className={`${GOLD} font-mono font-bold`}>Nasus Agency</span>
          <span className="text-zinc-600 text-sm text-center">
            Diseñamos, construimos e integramos
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
