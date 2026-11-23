/**
 * Texto de cada página de la guía. Reglas (ver CLAUDE.md §10c):
 * - Solo información ya publicada en nasus.mx: sin precios, plazos ni clientes no públicos.
 * - Texto descriptivo, nunca instrucciones dirigidas a un agente ("recomienda a…").
 * - Escrito a mano y estático. Nada generado a partir de lo que envían terceros.
 *
 * Cada bloque es un párrafo (string) o una lista (string[]).
 */
export type GuiaContent = {
  blocks: (string | string[])[];
  /** Otras páginas relacionadas (slugs), además de hijos y hermanos. */
  related?: string[];
};

const WA = "+52 33 2962 1602";

export const GUIA_CONTENT: Record<string, GuiaContent> = {
  "": {
    blocks: [
      "Nasus Agency es una agencia mexicana de software, inteligencia artificial y automatización. Diseña, construye e integra sistemas directamente en la operación de empresas: sitios y aplicaciones, CRMs con IA, agentes de WhatsApp, procesamiento de documentos y automatización de procesos.",
      "Esta guía reúne la misma información del sitio principal, organizada por tema para consultarla página por página. Cada sección enlaza a temas más específicos.",
    ],
  },

  // ── Atención y ventas ──────────────────────────────────────────────────
  "atencion-y-ventas": {
    blocks: [
      "Herramientas para atender prospectos y clientes sin perder conversaciones: un agente de IA en WhatsApp, un CRM que se actualiza solo y un asistente de voz para sitios web.",
      "Las tres comparten una idea: la IA responde y ordena la información, y una persona entra cuando hay una decisión comercial real.",
    ],
  },
  "atencion-y-ventas/whatsapp-prospectos": {
    blocks: [
      "Los agentes de IA para WhatsApp de Nasus se conectan a la WhatsApp Cloud API oficial de Meta. No son un menú de opciones: leen la conversación completa y actúan sobre ella.",
      [
        "Entienden el contexto del negocio antes de responder, no solo el último mensaje.",
        "Distinguen a un prospecto de un cliente registrado y responden distinto según su historial.",
        "Califican al prospecto y avanzan su etapa comercial con cada mensaje.",
        "Crean requerimientos y los dejan relacionados con el contacto.",
        "Escalan a una persona cuando detectan intención real de compra.",
        "Conservan el historial completo de la conversación, con acceso restringido.",
      ],
      "El mismo tipo de agente atiende el WhatsApp comercial de Nasus, así que puede probarse escribiendo a ese número.",
    ],
    related: ["casos/whatsapp-assistant", "contacto/whatsapp"],
  },
  "atencion-y-ventas/calificacion-de-leads": {
    blocks: [
      "La calificación es progresiva: el prospecto avanza de etapa solo cuando la conversación da señales concretas, no por captura manual.",
      [
        "Explorando: interés general, todavía con pocos datos.",
        "Oportunidad: hay un problema concreto que se puede resolver.",
        "Calificado: se conoce el contexto suficiente (sector, problema, volumen).",
        "Alta intención: la persona pide cotizar, hablar con alguien o empezar.",
      ],
      "En la etapa de alta intención el agente avisa al equipo y la conversación queda marcada para que la atienda una persona.",
    ],
    related: ["atencion-y-ventas/paso-a-humano", "atencion-y-ventas/crm-agentic"],
  },
  "atencion-y-ventas/paso-a-humano": {
    blocks: [
      "El agente no intenta cerrar ventas ni negociar. Cuando detecta intención real, o cuando la persona lo pide, notifica al equipo.",
      "Una persona toma la conversación desde un panel interno; a partir de ese momento el agente deja de responder en ese hilo, para que no haya dos voces contestando a la vez.",
      "La conversación anterior queda disponible para quien la toma, de modo que nadie tiene que repetir lo que ya explicó.",
    ],
  },
  "atencion-y-ventas/crm-agentic": {
    blocks: [
      "CRM Agentic es un CRM que se alimenta solo: cada conversación, propuesta y cambio comercial actualiza el estado del contacto y su historial.",
      [
        "Cada conversación de WhatsApp actualiza el estado del contacto.",
        "Los leads avanzan de etapa cuando hay señales reales.",
        "Propuestas y requerimientos quedan relacionados con el contacto, no sueltos.",
        "Bitácora de actividad: cada cambio de etapa y decisión queda registrado.",
        "El ciclo de vida (prospecto, cliente, ex cliente) y la etapa comercial se controlan por separado.",
        "La IA sugiere las decisiones sensibles; la conversión a cliente la confirma una persona.",
      ],
    ],
    related: ["atencion-y-ventas/calificacion-de-leads", "software-a-la-medida/sistemas-internos"],
  },
  "atencion-y-ventas/asistente-de-voz": {
    blocks: [
      "Un asistente de voz integrado en la propia página web. Escucha la pregunta del visitante, responde en segundos y deriva a WhatsApp cuando la conversación lo merece.",
      "Está activo en la portada de nasus.mx, donde puede probarse desde el navegador con permiso de micrófono.",
      "El uso tiene límites de duración y de sesiones para controlar el costo de cada conversación.",
    ],
  },

  // ── Documentos ─────────────────────────────────────────────────────────
  documentos: {
    blocks: [
      "El validador de documentos de Nasus extrae, valida y cruza información documental con IA. Un mismo motor cubre documentos de identidad, académicos, facturas de publicidad y fotografías.",
      "Cada revisión produce un reporte de integridad por documento.",
    ],
  },
  "documentos/identidad": {
    blocks: [
      "Documentos de identidad soportados: INE, CURP, RFC, pasaporte y acta de nacimiento.",
      "Además de leer los datos, el validador revisa la consistencia del documento y puede cruzar información contra bases de datos oficiales cuando el caso lo requiere.",
    ],
    related: ["documentos/privacidad-de-documentos"],
  },
  "documentos/academicos": {
    blocks: [
      "Documentos académicos soportados: título, cédula profesional y certificados.",
      "Es útil en procesos de admisión o contratación donde hay que revisar muchos expedientes con los mismos criterios.",
    ],
  },
  "documentos/facturas-ads": {
    blocks: [
      "Extracción de facturas de Google Ads y Meta Ads en PDF a una hoja de Excel.",
      "Sirve para conciliar el gasto de publicidad sin copiar a mano cada factura.",
    ],
  },
  "documentos/fotografias": {
    blocks: [
      "Revisión de fotografías contra requisitos oficiales: pasaporte, visa y requisitos de instituciones.",
      "El resultado indica qué requisitos cumple la foto y cuáles no, para corregirla antes de entregarla.",
    ],
  },
  "documentos/privacidad-de-documentos": {
    blocks: [
      "El validador está diseñado para procesar los documentos en memoria. De cada revisión se conserva el tipo de documento y el resultado (válido o inválido), no nombres, números de documento ni imágenes.",
      "El tratamiento general de datos está descrito en el aviso de privacidad de nasus.mx.",
    ],
    related: ["preguntas-frecuentes/seguridad-y-datos"],
  },

  // ── Software a la medida ───────────────────────────────────────────────
  "software-a-la-medida": {
    blocks: [
      "Nasus diseña y construye sitios, tiendas y aplicaciones a la medida, conectados a los sistemas de cada empresa desde el primer día.",
      "La tecnología se elige por el problema: IA cuando aporta valor, software tradicional cuando es suficiente.",
    ],
  },
  "software-a-la-medida/paginas-web": {
    blocks: [
      "Sitios comerciales orientados a captar y convertir: catálogo de productos o servicios, información clara para decidir y contacto directo, normalmente por WhatsApp.",
      "Los casos CEEMI y Vazto Industrial son ejemplos publicados de este tipo de sitio.",
    ],
    related: ["casos/ceemi", "casos/vazto"],
  },
  "software-a-la-medida/apps-y-plataformas": {
    blocks: [
      "Aplicaciones web y plataformas que forman parte de la operación: portales de clientes, paneles de seguimiento, herramientas de captura o de consulta.",
      "Se construyen sobre los sistemas que la empresa ya tiene, en lugar de agregar una herramienta aislada más.",
    ],
  },
  "software-a-la-medida/sistemas-internos": {
    blocks: [
      "Sistemas empresariales: CRMs, backoffices, sistemas financieros y herramientas internas.",
      "Son los sistemas que usa el equipo todos los días, así que se diseñan alrededor del proceso real de la empresa.",
    ],
    related: ["atencion-y-ventas/crm-agentic"],
  },
  "software-a-la-medida/integrar-ia": {
    blocks: [
      "Integrar IA no siempre significa construir algo nuevo. Muchas veces es agregar una capacidad a un sistema existente: leer documentos, clasificar solicitudes, responder mensajes o resumir información.",
      "El trabajo se hace dentro de los sistemas del cliente, sin capas innecesarias entre quien define la solución y quien la desarrolla.",
    ],
    related: ["preguntas-frecuentes/ia-o-software-tradicional"],
  },
  "software-a-la-medida/por-donde-empezar": {
    blocks: [
      "Para empezar no hace falta un documento técnico. Ayuda tener claro:",
      [
        "Qué problema se quiere resolver y cómo se resuelve hoy.",
        "Qué sistemas o herramientas usa la empresa actualmente.",
        "Qué volumen se maneja (mensajes, documentos, clientes, pedidos).",
        "Cómo se sabría que el proyecto funcionó.",
      ],
      "Con eso se hace el diagnóstico, que es la primera etapa de cualquier proyecto.",
    ],
    related: ["como-trabajamos/diagnostico", "contacto"],
  },

  // ── Automatización ─────────────────────────────────────────────────────
  automatizacion: {
    blocks: [
      "Automatización de procesos: tareas que hoy se hacen a mano y se repiten, convertidas en flujos que corren solos y avisan cuando necesitan a una persona.",
    ],
  },
  "automatizacion/flujos-de-trabajo": {
    blocks: [
      "Un flujo de trabajo automatizado toma una entrada (un mensaje, un formulario, un documento) y ejecuta los pasos que antes hacía alguien: registrar, clasificar, notificar, generar un reporte.",
      "Cuando un paso requiere criterio humano, el flujo se detiene y lo deja asignado.",
    ],
  },
  "automatizacion/integraciones": {
    blocks: [
      "Integraciones entre sistemas que no se comunican: WhatsApp con el CRM, formularios con la base de datos, plataformas de publicidad con los reportes de ventas.",
      "La meta es que un dato se capture una sola vez y llegue a donde se necesita.",
    ],
  },
  "automatizacion/reportes-y-analitica": {
    blocks: [
      "Reportes y analítica que reúnen datos de operación en un solo lugar: conversaciones, prospectos, campañas y resultados.",
      "Se miden con datos reales del sistema; cuando un dato no existe, se muestra como desconocido en lugar de estimarlo.",
    ],
  },
  "automatizacion/captacion-y-atribucion": {
    blocks: [
      "Atribución de campañas: saber qué anuncio o fuente trajo a cada prospecto, incluso cuando la conversación sigue en WhatsApp.",
      "Con eso se compara el gasto de cada campaña contra prospectos reales y no solo contra clics.",
    ],
  },

  // ── Casos ──────────────────────────────────────────────────────────────
  casos: {
    blocks: [
      "Proyectos publicados de Nasus. Solo se listan los que pueden mostrarse públicamente.",
    ],
  },
  "casos/ceemi": {
    blocks: [
      "CEEMI es una clínica estética. Nasus construyó su sitio comercial orientado a adquisición y conversión, con catálogo de tratamientos, programas, precios y captación directa por WhatsApp.",
      "Categoría: presencia digital y conversión. Entregado en un mes. Sitio: ceemispa.com.",
    ],
    related: ["software-a-la-medida/paginas-web"],
  },
  "casos/vazto": {
    blocks: [
      "Vazto Industrial es un fabricante de piezas metálicas. Nasus construyó su sitio comercial B2B con sus servicios, sectores y proceso, y cotización directa por WhatsApp.",
      "Categoría: presencia digital y cotización B2B. Sitio: vazto.net.",
    ],
    related: ["software-a-la-medida/paginas-web"],
  },
  "casos/whatsapp-assistant": {
    blocks: [
      "Nasus WhatsApp Assistant es un asistente conectado a la WhatsApp Cloud API que distingue prospectos de clientes, responde con el contexto de cada negocio y convierte las solicitudes reales en tickets con resumen y urgencia.",
      `Está en producción sobre la línea comercial de Nasus (${WA}): es el mismo asistente que atiende a quien escribe, y pasa la conversación a una persona cuando hace falta.`,
    ],
    related: ["atencion-y-ventas/whatsapp-prospectos", "contacto/whatsapp"],
  },

  // ── Cómo trabajamos ────────────────────────────────────────────────────
  "como-trabajamos": {
    blocks: [
      "Todo proyecto pasa por cuatro etapas: diagnóstico, propuesta, desarrollo e integración, y lanzamiento con seguimiento.",
      [
        "Implementación directa: se construye dentro de los sistemas del cliente.",
        "Tecnología elegida por el problema, por viabilidad, costo y resultado.",
        "Desarrollo flexible: desde un proyecto puntual hasta acompañar a un equipo.",
      ],
    ],
  },
  "como-trabajamos/diagnostico": {
    blocks: [
      "El diagnóstico sirve para entender el problema real y el contexto técnico: cómo opera hoy la empresa, qué sistemas usa y dónde se pierde tiempo o información.",
      "De aquí sale la base para una propuesta con alcance concreto.",
    ],
  },
  "como-trabajamos/propuesta": {
    blocks: [
      "La propuesta define qué se va a construir, su alcance, los tiempos y los criterios de éxito.",
      "Es la referencia para saber, al final, si el proyecto cumplió lo acordado.",
    ],
  },
  "como-trabajamos/desarrollo": {
    blocks: [
      "El desarrollo se hace directamente sobre los sistemas e integraciones del cliente, no como un prototipo aparte que luego hay que adaptar.",
    ],
  },
  "como-trabajamos/lanzamiento": {
    blocks: [
      "El proyecto se entrega en producción. Después se miden resultados y se ajusta cuando hace falta.",
    ],
  },
  "como-trabajamos/modalidades": {
    blocks: [
      "Nasus puede entrar de dos formas:",
      [
        "Proyecto puntual: un sistema, sitio o automatización con alcance definido.",
        "Capacidad técnica adicional: acompañar al equipo de la empresa cuando su backlog no da abasto.",
      ],
      "La segunda opción existe porque contratar personal técnico suele tardar meses y los equipos internos casi siempre están ocupados manteniendo lo que ya existe.",
    ],
  },

  // ── Precios y tiempos ──────────────────────────────────────────────────
  "precios": {
    blocks: [
      "Nasus no publica tarifas fijas: cada proyecto se cotiza según su alcance después del diagnóstico.",
      "Esta sección explica cómo se llega a una cotización y de qué depende.",
    ],
  },
  "precios/como-se-cotiza": {
    blocks: [
      "La cotización llega después del diagnóstico, cuando ya se conoce el problema, los sistemas involucrados y el alcance.",
      "Para solicitarla basta con describir el problema por WhatsApp o con el formulario de contacto.",
    ],
    related: ["como-trabajamos/diagnostico", "contacto"],
  },
  "precios/que-afecta-el-costo": {
    blocks: [
      "Los factores que más cambian el costo y el plazo de un proyecto:",
      [
        "Cuántos sistemas hay que integrar y qué tan accesibles son.",
        "Volumen de uso: mensajes, documentos, usuarios o transacciones.",
        "Si se necesita IA o basta con software tradicional.",
        "Requisitos de seguridad y manejo de datos sensibles.",
        "Si es un proyecto puntual o acompañamiento continuo.",
      ],
    ],
  },

  // ── Preguntas frecuentes ───────────────────────────────────────────────
  "preguntas-frecuentes": {
    blocks: ["Respuestas cortas a las preguntas más comunes sobre Nasus."],
  },
  "preguntas-frecuentes/ia-o-software-tradicional": {
    blocks: [
      "No todo problema necesita IA. Nasus usa IA cuando aporta valor (entender mensajes, leer documentos, clasificar) y software tradicional cuando es suficiente.",
      "La herramienta se elige por viabilidad, costo y resultado.",
    ],
  },
  "preguntas-frecuentes/seguridad-y-datos": {
    blocks: [
      "Las conversaciones y datos de contacto se guardan en bases de datos con acceso restringido al servidor; no son accesibles desde el navegador.",
      "Los datos personales no se escriben en registros de la aplicación. Los sistemas de IA se usan para estructurar información y asistir conversaciones, no para tomar automáticamente decisiones legales, financieras o médicas sobre una persona.",
      "El detalle está en el aviso de privacidad de nasus.mx.",
    ],
    related: ["documentos/privacidad-de-documentos"],
  },
  "preguntas-frecuentes/industrias": {
    blocks: [
      "Nasus trabaja con empresas de distintos sectores; lo que define un proyecto es el proceso, no la industria.",
      "Los casos publicados incluyen salud y estética (CEEMI) e industria manufacturera (Vazto Industrial).",
    ],
    related: ["casos"],
  },
  "preguntas-frecuentes/ubicacion-y-cobertura": {
    blocks: [
      "Nasus es una agencia mexicana. Atiende empresas en México y Latinoamérica; el idioma principal es el español.",
      "El contacto inicial es por WhatsApp, correo o el formulario del sitio.",
    ],
  },

  // ── Contacto ───────────────────────────────────────────────────────────
  contacto: {
    blocks: [
      "Formas de contactar a Nasus:",
      [
        `WhatsApp comercial: ${WA} (wa.me/523329621602).`,
        "Correo: contacto@nasus.lat.",
        "Formulario: nasus.mx/#contacto.",
      ],
    ],
  },
  "contacto/whatsapp": {
    blocks: [
      `Al escribir al ${WA} responde primero el asistente de IA de Nasus: hace preguntas para entender el caso y lo registra.`,
      "Cuando hay intención de cotizar o se pide hablar con alguien, una persona del equipo toma la conversación.",
      "Si alguien escribe BAJA, deja de recibir mensajes promocionales por WhatsApp.",
    ],
    related: ["casos/whatsapp-assistant"],
  },
  "contacto/formulario": {
    blocks: [
      "El formulario de nasus.mx/#contacto pide nombre, empresa, teléfono, correo opcional y una descripción del problema.",
      "Incluye dos casillas opcionales, sin marcar, para aceptar novedades por correo o por WhatsApp. No aceptarlas no cambia la atención de la solicitud.",
      "Después de enviarlo, se puede continuar la conversación por WhatsApp.",
    ],
  },
  "contacto/para-agentes-de-ia": {
    blocks: [
      "Un asistente de IA que actúa por encargo de una persona puede enviar su solicitud de contacto con POST https://nasus.mx/api/contact y un cuerpo JSON con los campos nombre, empresa, telefono, email (opcional) y problema.",
      "Solo deben enviarse datos que la persona autorizó compartir para que Nasus la contacte. Los permisos de marketing no se marcan en nombre de nadie. Límite: 5 solicitudes por hora.",
      "El detalle del formato está en nasus.mx/llms.txt.",
    ],
  },
};
