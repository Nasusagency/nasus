# Nasus Agency — Sistema Operativo Interno
## Rol: Arquitecto de Infraestructura IA

---

### 1. Descripción del Proyecto

**Nasus Agency** es una agencia mexicana de soluciones tecnológicas artesanales. Este repositorio es el sistema operativo completo de la agencia: sitio principal, productos de IA para clientes B2B + infraestructura administrativa interna.

**Sitio principal:**
- `https://nasus.lat` — Landing comercial con portafolio de casos (CEEMI, Theia, WhatsApp Assistant) y servicios.
- Mensaje: _"Soluciones tecnológicas artesanales para empresas en escala. Implementamos IA directamente en tus sistemas."_
- Asistente de voz integrado (ElevenLabs TTS, Web Speech API).

**Productos activos (destacados en nasus.lat):**
- **Nasus WhatsApp Assistant** — Sistema conectado a WhatsApp Cloud API que distingue prospectos de clientes, responde con contexto de negocio, detecta solicitudes formales y genera tickets. Dos números separados:
  - Demo/Prospecto (`+52 33 2962 1602`) — Connectado a Groq Agent + Claude (fallback).
  - Humano (`+52 33 2914 2391`) — Línea de atención directa, no es automatizada.
- **Validador de documentos** — Unifica validación de documentos de identidad (INE, CURP, RFC, actas, pasaportes), académicos (títulos, cédulas) y facturas de Google/Meta Ads → Excel.
- **Asistente de voz** — Interfaz de voz clonada en el sitio principal, contacto vía WhatsApp.

**Sistema admin interno (privado):**
- Panel de leads con calificación progresiva (exploring → opportunity → qualified → high_intent).
- Control de requerimientos/tickets de clientes.
- En construcción: Dashboard unificado (ver Roadmap).

**URL de producción:** `https://nasus.lat`
**Repo:** `github.com/Nasusagency/nasus`

---

### 2. Arquitectura de Rutas

#### Públicas (indexadas)
| Ruta | Descripción |
|------|-------------|
| `/` | Landing con demos de los productos |
| `/validador` | Validador de documentos (requiere auth Supabase) |
| `/facturas` | Extractor de facturas (requiere auth Supabase) |
| `/fotos` | Validador de fotografías (requiere auth Supabase) |

#### Públicas (noindex — compartidas con clientes)
| Ruta | Descripción |
|------|-------------|
| `/cliente/[slug]` | Panel de estado del proyecto para el cliente |
| `/propuesta/[slug]` | Página de propuesta comercial profesional |

#### Admin privadas (JWT httpOnly cookie `nasus_admin`)
| Ruta | Descripción |
|------|-------------|
| `/admin/login` | Acceso con ADMIN_EMAIL + ADMIN_PASSWORD |
| `/admin` | Dashboard: stats, clientes recientes, cambios |
| `/admin/clientes` | CRM — lista de clientes con fases |
| `/admin/clientes/[slug]` | Detalle: milestones, endpoints, notas, cambios |
| `/admin/propuestas/nueva` | Generador de propuestas con Claude (streaming) |
| `/admin/cambios` | Control de cambios — CRUD con estados |

#### API Endpoints
| Ruta | Descripción |
|------|-------------|
| `POST /api/assistant` | Asistente de voz — Claude + ElevenLabs TTS (público, 5/IP/hora) |
| `POST /api/validate` | Validación de documentos generales |
| `POST /api/validate-photo` | Validación de fotografías |
| `POST /api/facturas/extract` | Extracción de facturas PDF → JSON/Excel |
| `POST /api/uag/validate` | Validación de documentos UAG (B2B, API key) |
| `POST /api/admin/login` | Autenticación admin |
| `POST /api/admin/logout` | Cierre de sesión admin |
| `POST /api/admin/propuestas/generar` | Generación de propuesta con Claude streaming |
| `GET/POST /api/admin/cambios` | CRUD de cambios |
| `PATCH/DELETE /api/admin/cambios/[id]` | Actualizar/eliminar cambio |
| `GET/POST /api/admin/propuestas` | Guardar/listar propuestas |

---

### 3. Stack Tecnológico

| Capa | Tecnología |
|------|-----------|
| Frontend | Next.js 16.2.4 (App Router) + Tailwind CSS v4 + TypeScript |
| Auth usuarios | Supabase Auth (SSR, cookies) |
| Auth admin | JWT propio con Web Crypto API (httpOnly cookie) |
| Base de datos | Supabase (PostgreSQL) |
| IA — LLM principal | Claude Haiku 4.5 (`claude-haiku-4-5-20251001`) — visión, generación, WhatsApp |
| IA — Agent (Groq) | Groq Agent (modelo `openai/gpt-oss-120b`) — calificación leads, tool use, fallback a Claude |
| Voz | Web Speech API (STT, navegador) + ElevenLabs TTS (voz clonada) |
| WhatsApp | Meta Cloud API (webhook, mensajes) |
| Verificación ext. | Didit API (validación CURP en base de datos oficial) |
| Eventos/Ticketing | Zoho Backstage (OAuth, crear órdenes con UTM tracking) — experimento rápido |
| Despliegue | Vercel (Edge + Node.js runtime según ruta) |
| Exports | SheetJS (XLSX) |

**Tokens de diseño:**
- Fondo: `#050508`
- Dorado: `#c4a882`
- Cian: `#00f2ff`
- Fuente mono: utilizada en UI admin y datos técnicos

---

### 4. Nasus WhatsApp Assistant — Arquitectura Groq Agent v1

**Propósito:** Calificar prospectos automáticamente, preservar contexto, detectar oportunidades reales y escalar a humano cuando sea necesario.

**Flujo general:**
```
Meta WhatsApp webhook
  ↓ (número entra)
  → preflight: consultar contexto (¿cliente?, ¿lead existente?)
  → selectProvider: ¿Groq (allowlist) o Claude?
  → [Groq Agent] o [Claude clásico]
  → detectarSolicitud / guardar_actualizar_lead
  → responder en WhatsApp
  → escalación a humano si high_intent
```

**Modelo + Provider:**
- **Principal:** Groq Agent, modelo `openai/gpt-oss-120b` (números autorizados solo, vía `WHATSAPP_GROQ_TEST_NUMBERS`)
- **Fallback:** Claude Haiku 4.5 (`claude-haiku-4-5-20251001`) — para toda la población por defecto

**Stages del Lead (calificación progresiva):**

| Stage | Descripción | Acción del Agente |
|---|---|---|
| `exploring` | Interés general, pocos datos | Preguntar sector, negocio |
| `opportunity` | Problema concreto, Nasus puede ayudar | Preguntar contexto: volumen, proceso actual |
| `qualified` | Contexto suficiente (sector, problema, volumen) | Estar listo para handoff |
| `high_intent` | Señal explícita ("quiero cotizar", "asesor", "empezar") | Marcar `requiere_humano=true`, notificar equipo, responder brevemente |

**6 Tools disponibles (Groq Agent):**

1. **`consultar_contexto_contacto`** — Obtener cliente/lead existente, historial, notas
2. **`consultar_servicios`** — Servicios que Nasus ofrece
3. **`consultar_portafolio`** — Casos públicos (CEEMI, Theia, WhatsApp Assistant)
4. **`guardar_actualizar_lead`** — Crear/actualizar lead con nueva info, cambiar stage (MANDATORIO en cada mensaje)
5. **`registrar_requerimiento`** — Formalizar solicitud/ticket de cliente
6. **`notificar_humano`** — Enviar correo a equipo cuando `high_intent`

**Tablas de Supabase (privadas, RLS activo, solo service role):**

- `whatsapp_clientes` — Clientes registrados, contexto de negocio
- `whatsapp_leads` — Prospectos en pipeline: stage, problema_descrito, nombre_empresa, resumen
- `whatsapp_mensajes` — Conversaciones persistidas (numero, contenido, direction, mediaId)
- `whatsapp_requerimientos` — Tickets formales (tipo, descripción, prioridad, estado)
- `idempotency_keys` — Prevenir duplicados en operaciones sensibles (notificar_humano, guardar_lead)

**Rate Limit:**
- Clientes registrados: 100 msg/hora
- Números desconocidos: 10 msg/hora

**Números de WhatsApp (separados intencionalmente):**

| Número | Propósito | Qué es |
|---|---|---|
| `+52 33 2962 1602` | Demo/Prospecto | Groq Agent + Claude, ticket si hay solicitud formal |
| `+52 33 2914 2391` | Atención humana | WhatsApp Business, atiende persona real |

**Prompt caching:**
- Prompts de WhatsApp miden ~160 tokens: **no cachean nada** (están bajo el mínimo de ~4096 tokens en Haiku 4.5)
- Se deja `cache_control: { type: "ephemeral" }` marcado para modo cliente, donde el contexto sí puede rebasar el mínimo

---

### 5. Clientes Activos

#### UAG — Universidad Autónoma de Guadalajara
- **Fase:** Propuesta
- **Contacto:** Gaby Di (impulsa internamente; decisor = sistemas/admisiones)
- **Sistema:** Ping (powered by Valkiria)
- **Modalidad:** API (Modalidad B)
- **Endpoint listo:** `POST /api/uag/validate` v1.0
- **Documentos configurados:** `certificado_licenciatura`, `acta_nacimiento`, `constancia_certificado`, `fotografia`, `carta_compromiso`
- **Pendiente:** Confirmar si Ping/Valkiria soporta webhooks externos
- **Panel cliente:** `/cliente/uag`
- **API key:** `UAG_API_KEY` en variables de entorno

---

### 6. Reglas de Desarrollo

1. **Cambios en producción:** Nunca desplegar cambios que afecten a un cliente sin registrarlos primero en `/admin/cambios` con estado aprobado.

2. **Endpoints por cliente:** Cada cliente B2B tiene su propia ruta aislada `app/api/[cliente]/`. Nunca compartir lógica de validación entre clientes distintos sin abstraer en `lib/`.

3. **Seguridad antes de deploy:** Invocar el **Agente de Seguridad** (`.cloud/agents/security.md`) para auditar cualquier cambio que toque rutas de API, auth, o manejo de imágenes.

4. **Sin PII en logs:** Nunca escribir datos personales en `console.log` / `console.error` — los logs de Vercel no tienen RLS, se retienen fuera de nuestro control y son visibles para cualquiera con acceso al proyecto. Esta parte no tiene excepciones. En los módulos de documentos y fotos tampoco se persiste: se procesan en memoria y solo se guarda tipo de documento y resultado (válido/inválido), nunca nombres, números de documento ni imágenes.

   **Excepción documentada — WhatsApp (`lib/whatsapp/store.ts`):** las conversaciones sí se guardan, incluyendo el número del contacto y el contenido de los mensajes. Es lo que permite armar los tickets de solicitud y darle contexto al hilo. Condiciones que hacen válida la excepción:
   - Solo en Postgres, en `whatsapp_mensajes` y `whatsapp_clientes`. Ambas con **RLS activo y sin políticas**: ni `anon` ni `authenticated` pueden leerlas. El único acceso es `SUPABASE_SERVICE_ROLE_KEY` desde el servidor (`lib/supabase/service.ts`).
   - **Nunca en consola.** El contenido de los mensajes y el número completo no aparecen en ningún `console.*`; los errores del módulo registran solo el mensaje de error.
   - Las imágenes no se copian: se guarda el `media_id` de Meta como referencia, no el archivo.

   Al agregar un módulo nuevo que necesite persistir PII, documentar la excepción aquí con las mismas condiciones.

5. **Variables sensibles:** Solo en `.env.local` (local) y panel de Vercel (producción). Nunca en código ni en Git. `.env.local` está en `.gitignore`.

6. **Runtime por ruta:**
   - Rutas que usan `sharp` o `Buffer` → Node.js runtime (sin `export const runtime = "edge"`)
   - Rutas de API de clientes B2B → `export const maxDuration = 30` para evitar timeout en Vercel

7. **Construcción local primero:** Toda la lógica se desarrolla y prueba localmente antes de hacer push. No subir código sin TypeScript limpio (`npx tsc --noEmit` sin errores).

8. **Prompt caching:** Usar `cache_control: { type: "ephemeral" }` en los system prompts de Claude para reducir costos, **verificando primero que el prompt rebase el mínimo cacheable del modelo**. Por debajo del mínimo la marca no da error: simplemente no cachea nada, en silencio.

   | Modelo | Mínimo cacheable |
   |---|---|
   | Haiku 4.5 (`claude-haiku-4-5-*`) | ~4096 tokens |
   | Sonnet 4.5 / 4.6 | ~1024 tokens |

   Los prompts del webhook de WhatsApp y del asistente de voz miden ~160 tokens: **no cachean nada** y nunca lo hicieron. No asumas ahorro por tener la marca puesta — mídelo con `client.messages.countTokens()` y confírmalo con `usage.cache_read_input_tokens` en la respuesta (si sale 0 de forma consistente, no está cacheando).

   Corolario: no deformes un prompt para que sea idéntico byte a byte a otro "para compartir caché" sin haber comprobado antes que rebasa el mínimo.

---

### 7. Estructura de Módulos Clave

```
lib/
  admin/
    auth.ts          — JWT sign/verify (Web Crypto, sin dependencias externas)
    data.ts          — Store en memoria: clientes, propuestas, cambios (seed: UAG)
  uag/
    engine.ts        — Orquestador de validación UAG
    types.ts         — Tipos e interfaces UAG
    prompts.ts       — Prompts para certificado, constancia, carta
    photo-config.ts  — 11 reglas de fotografía UAG
  documents/
    config/          — Configuración por tipo de documento (INE, CURP, RFC, acta…)
    DocumentEngine.ts
  photos/
    PhotoEngine.ts
    types.ts
  facturas/
    engine.ts
    excel.ts
```

---

### 8. Agentes Disponibles

- **Agente de Seguridad:** `.cloud/agents/security.md` — audita privacidad, OWASP, manejo de PII antes de deploy.
- **Arquitectura extensible:** Para agregar un nuevo tipo de documento, crear `lib/documents/config/[tipo].config.ts` siguiendo el patrón existente. Para nuevo cliente B2B, crear `app/api/[cliente]/validate/route.ts` + `lib/[cliente]/`.

---

### 9. Variables de Entorno Requeridas

#### Core
```
ANTHROPIC_API_KEY          — Claude API
NEXT_PUBLIC_SUPABASE_URL   — Supabase proyecto
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY  — Acceso privilegiado (server-side solo)
```

#### WhatsApp + Groq
```
WHATSAPP_PHONE_ID          — ID del teléfono registrado en Meta
WHATSAPP_BUSINESS_ACCOUNT_ID
WHATSAPP_ACCESS_TOKEN      — Token de acceso a Meta Cloud API
WHATSAPP_APP_SECRET        — Secret para validar firmas de webhook
WHATSAPP_VERIFY_TOKEN      — Token de verificación del webhook
WHATSAPP_AGENT_PROVIDER    — "groq" o "claude" (default: "claude")
WHATSAPP_GROQ_TEST_NUMBERS — CSV de números autorizados para Groq
```

#### Integración externa
```
DIDIT_API_KEY              — Verificación CURP en base oficial
UAG_API_KEY                — API key del cliente UAG
ELEVENLABS_API_KEY         — Text-to-speech del asistente de voz
ELEVENLABS_VOICE_ID        — ID de la voz clonada de Nasus
ELEVENLABS_MODEL_ID        — Opcional (default: eleven_multilingual_v2)
ZOHO_CLIENT_ID             — OAuth Zoho Backstage
ZOHO_CLIENT_SECRET
ZOHO_BACKSTAGE_REFRESH_TOKEN
ZOHO_BACKSTAGE_PORTAL_ID
ZOHO_ACCOUNTS_DOMAIN       — Opcional (default: https://accounts.zoho.com)
ZOHO_API_DOMAIN            — Opcional (default: https://zohoapis.com)
```

#### Admin
```
ADMIN_EMAIL                — Email de acceso al panel admin
ADMIN_PASSWORD             — Contraseña del panel admin
ADMIN_JWT_SECRET           — Secret para firmar tokens JWT httpOnly
```

---

### 10. Nasus Intelligence World

**URL:** `https://mundo.nasus.lat`

**Definición:** Subdominio independiente que funciona como experiencia interactiva / laboratorio digital de Nasus. Demuestra capacidades de IA, automatización, WhatsApp y ecosistemas de datos en una interfaz visual/interactiva única. No es una landing comercial tradicional.

**Repo:** Probablemente separado (no está en este repositorio)

**Integración:** Enlazado desde el footer de nasus.lat como "Nasus Intelligence" → "Entrar al mundo".

---

### 11. Experimento Rápido: Zoho Backstage

**Estado:** Integración rápida para captura de origen de marketing (UTM tracking)

**Propósito:** Capturar utm_source, utm_medium, utm_campaign en registros de eventos/ticketing de Zoho Backstage

**Endpoint:** `POST /api/backstage/register`

**Flujo:**
1. Formulario de registro (landing/evento) captura UTMs
2. Request a `/api/backstage/register` con firstName, lastName, email, eventId, ticketClassId, utm_*
3. Backend autentica con OAuth (refresh token) y crea orden en Zoho Backstage
4. UTMs se mapean a campos personalizados en el ticket

**Observación:** Es un experimento/POC. No es parte de la arquitectura productiva central de Nasus. Ruta separada en `app/api/backstage/`.

---

### 12. Roadmap Inmediato

#### A. Admin Nasus Interno — SIGUIENTE
**Objetivo:** Capa visual privada sobre leads, requerimientos y contexto de prospecto.

**MVP esperado:**
- Autenticación (reutilizar JWT admin existente)
- Dashboard inicial (stats, leads recientes, high_intent)
- Lista de leads filtrable por stage
- Detalle de lead: contexto, problema_descrito, mensajes recientes, requerimientos asociados
- Estados básicos de seguimiento (marcado como contactado, en progreso, etc.)

**No es:** CRM completo todavía. Solo un panel operativo sobre los datos de WhatsApp.

#### B. Revisión del Validador — DESPUÉS DEL ADMIN
**Objetivo:** Auditoría completa del flujo de documentos, facturas y fotografías.

**Alcance esperado:**
- UX/UI actual
- Flujo de usuario
- Arquitectura y modularidad
- Procesamiento de IA
- Capacidades (documentos soportados)
- Estado mobile
- Integración/presentación dentro de nasus.lat

**Entregable:** Documento de recomendaciones o trabajo de mejora (sin comprometer en esta tarea).

---
