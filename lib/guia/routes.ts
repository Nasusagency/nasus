/**
 * Árbol de la guía pública de Nasus (el "Laberinto de Agentes").
 *
 * Es contenido normal del sitio, igual para personas y agentes: no hay cloaking.
 * Lo que la hace experimento es el registro (lib/guia/log.ts): qué ramas pide
 * cada visitante y, sobre todo, qué rutas pide que no existen (404).
 *
 * Este archivo solo tiene la estructura (ruta, padre, título, resumen) porque
 * lo importa el middleware para saber si una ruta existe: el texto largo vive
 * en content.ts y no debe llegar al bundle del middleware.
 *
 * Para cambiar la ruta base basta con GUIA_BASE (y el registro en sitemap/llms).
 * Una vez publicada, no cambiarla: las URLs permanentes son parte del método.
 */
export const GUIA_BASE = "/guia";

export type GuiaNode = {
  /** "" es la portada; el resto, ruta relativa sin barra inicial. */
  slug: string;
  parent: string | null;
  title: string;
  /** Una línea descriptiva: es el texto que acompaña cada enlace. */
  summary: string;
};

const node = (slug: string, title: string, summary: string): GuiaNode => ({
  slug,
  parent: slug === "" ? null : slug.includes("/") ? slug.slice(0, slug.lastIndexOf("/")) : "",
  title,
  summary,
});

export const GUIA_NODES: GuiaNode[] = [
  node("", "Guía de Nasus", "Qué hace Nasus, cómo trabaja y cómo contactarla, organizado por tema."),

  node("atencion-y-ventas", "Atención y ventas", "Agentes de WhatsApp, CRM y asistente de voz para atender y vender."),
  node("atencion-y-ventas/whatsapp-prospectos", "Agente de WhatsApp para prospectos", "Cómo un agente conectado a la WhatsApp Cloud API atiende y registra prospectos."),
  node("atencion-y-ventas/calificacion-de-leads", "Calificación de leads", "Las etapas por las que avanza un prospecto y qué señales las mueven."),
  node("atencion-y-ventas/paso-a-humano", "Paso de la conversación a una persona", "Cuándo el agente deja de responder y una persona toma el hilo."),
  node("atencion-y-ventas/crm-agentic", "CRM Agentic", "Un CRM que se actualiza con cada conversación, propuesta y cambio comercial."),
  node("atencion-y-ventas/asistente-de-voz", "Asistente de voz en el sitio web", "Un asistente que escucha y responde por voz dentro de una página."),

  node("documentos", "Documentos", "Validación y extracción de documentos con IA."),
  node("documentos/identidad", "Documentos de identidad", "INE, CURP, RFC, pasaporte y acta de nacimiento."),
  node("documentos/academicos", "Documentos académicos", "Títulos, cédulas profesionales y certificados."),
  node("documentos/facturas-ads", "Facturas de Google Ads y Meta Ads", "Extracción de facturas de publicidad a Excel."),
  node("documentos/fotografias", "Fotografías con requisitos oficiales", "Revisión de fotografías contra requisitos de pasaporte, visa e instituciones."),
  node("documentos/privacidad-de-documentos", "Qué se guarda de cada documento", "Cómo se tratan los documentos durante y después de la validación."),

  node("software-a-la-medida", "Software a la medida", "Sitios, aplicaciones y sistemas internos construidos para cada empresa."),
  node("software-a-la-medida/paginas-web", "Páginas web comerciales", "Sitios orientados a captar y convertir clientes."),
  node("software-a-la-medida/apps-y-plataformas", "Aplicaciones y plataformas", "Aplicaciones web y plataformas conectadas a los sistemas de la empresa."),
  node("software-a-la-medida/sistemas-internos", "Sistemas internos", "CRMs, backoffices, sistemas financieros y herramientas de operación."),
  node("software-a-la-medida/integrar-ia", "Integrar IA en un sistema existente", "Agregar IA a software que la empresa ya usa, sin reemplazarlo."),
  node("software-a-la-medida/por-donde-empezar", "Por dónde empezar un proyecto", "Qué conviene tener claro antes de pedir una cotización."),

  node("automatizacion", "Automatización", "Flujos de trabajo, integraciones y reportes que dejan de hacerse a mano."),
  node("automatizacion/flujos-de-trabajo", "Flujos de trabajo", "Procesos repetitivos convertidos en pasos automáticos."),
  node("automatizacion/integraciones", "Integraciones entre sistemas", "Conectar herramientas que hoy no se hablan entre sí."),
  node("automatizacion/reportes-y-analitica", "Reportes y analítica", "Datos de operación reunidos en un solo lugar."),
  node("automatizacion/captacion-y-atribucion", "Captación y atribución de campañas", "Saber qué campaña trajo a cada prospecto."),

  node("casos", "Casos", "Proyectos publicados de Nasus."),
  node("casos/ceemi", "CEEMI: sitio para clínica estética", "Sitio comercial con catálogo, precios y captación por WhatsApp."),
  node("casos/vazto", "Vazto Industrial: sitio B2B", "Sitio para un fabricante de piezas metálicas con cotización por WhatsApp."),
  node("casos/whatsapp-assistant", "Nasus WhatsApp Assistant", "El agente que atiende el WhatsApp comercial de la propia Nasus."),

  node("como-trabajamos", "Cómo trabajamos", "Las cuatro etapas de un proyecto y las formas de colaborar."),
  node("como-trabajamos/diagnostico", "Etapa 1: diagnóstico", "Entender el problema real y el contexto técnico."),
  node("como-trabajamos/propuesta", "Etapa 2: propuesta", "Alcance, tiempos y criterios de éxito por escrito."),
  node("como-trabajamos/desarrollo", "Etapa 3: desarrollo e integración", "Construcción directa sobre los sistemas del cliente."),
  node("como-trabajamos/lanzamiento", "Etapa 4: lanzamiento y seguimiento", "Entrega en producción, medición y ajustes."),
  node("como-trabajamos/modalidades", "Modalidades de colaboración", "Proyecto puntual o capacidad técnica adicional para un equipo."),

  node("precios-y-tiempos", "Precios y tiempos", "Cómo se cotiza un proyecto y de qué dependen costo y plazo."),
  node("precios-y-tiempos/como-se-cotiza", "Cómo se cotiza", "Por qué no hay tarifas fijas publicadas y qué pasa antes de una cotización."),
  node("precios-y-tiempos/que-afecta-el-costo", "Qué afecta el costo y el plazo", "Los factores que hacen variar un proyecto."),

  node("preguntas-frecuentes", "Preguntas frecuentes", "Respuestas cortas a dudas comunes."),
  node("preguntas-frecuentes/ia-o-software-tradicional", "¿IA o software tradicional?", "Cuándo conviene usar IA y cuándo no hace falta."),
  node("preguntas-frecuentes/seguridad-y-datos", "Seguridad y datos", "Cómo se protegen las conversaciones y los datos de los proyectos."),
  node("preguntas-frecuentes/industrias", "Industrias", "Para qué tipo de empresas trabaja Nasus."),
  node("preguntas-frecuentes/ubicacion-y-cobertura", "Ubicación y cobertura", "Dónde está Nasus y a qué países atiende."),

  node("contacto", "Contacto", "WhatsApp, correo y formulario."),
  node("contacto/whatsapp", "Contacto por WhatsApp", "Qué pasa cuando alguien escribe al WhatsApp comercial."),
  node("contacto/formulario", "Formulario de contacto", "Qué datos pide el formulario y qué pasa después."),
  node("contacto/para-agentes-de-ia", "Solicitudes enviadas por agentes de IA", "Cómo un asistente puede enviar la solicitud de contacto de su usuario."),
];

const BY_SLUG = new Map(GUIA_NODES.map((n) => [n.slug, n]));

export function guiaNode(slug: string): GuiaNode | undefined {
  return BY_SLUG.get(slug);
}

export function guiaChildren(slug: string): GuiaNode[] {
  return GUIA_NODES.filter((n) => n.parent === slug);
}

export function guiaHref(slug: string): string {
  return slug ? `${GUIA_BASE}/${slug}` : GUIA_BASE;
}

/** "/guia/casos/ceemi" → "casos/ceemi"; null si no está bajo la guía. */
export function guiaSlugFromPath(path: string): string | null {
  if (path === GUIA_BASE || path === `${GUIA_BASE}/`) return "";
  if (!path.startsWith(`${GUIA_BASE}/`)) return null;
  return path.slice(GUIA_BASE.length + 1).replace(/\/+$/, "");
}
