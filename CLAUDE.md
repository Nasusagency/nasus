# Nasus Agency — Sistema Operativo Interno
## Rol: Arquitecto de Infraestructura IA

---

### 1. Descripción del Proyecto

**Nasus Agency** es una agencia mexicana de soluciones tecnológicas artesanales. Este repositorio es el sistema operativo completo de la agencia: productos de IA para clientes B2B + infraestructura administrativa interna.

**Productos activos:**
- **Validador de documentos** — Valida documentos oficiales mexicanos (INE, CURP, RFC, actas, pasaportes, certificados) mediante visión artificial.
- **Extractor de facturas** — Extrae datos estructurados de PDFs de facturas y genera Excel.
- **Validador de fotografías** — Valida fotos para requisitos institucionales (UAG, pasaportes, visas).

**Sistema admin interno (privado):**
- CRM de clientes con fases y seguimiento
- Generador de propuestas con Claude
- Control de cambios por cliente
- Paneles de estado para clientes (`/cliente/[slug]`)
- Páginas de propuesta profesional (`/propuesta/[slug]`)

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
| Frontend | Next.js 14 (App Router) + Tailwind CSS v4 + TypeScript |
| Auth usuarios | Supabase Auth (SSR, cookies) |
| Auth admin | JWT propio con Web Crypto API (httpOnly cookie) |
| Base de datos | Supabase (PostgreSQL) |
| IA | Anthropic Claude (`claude-sonnet-4-6`) — visión + generación |
| Voz | Web Speech API (STT, navegador) + ElevenLabs TTS (voz clonada) |
| Verificación ext. | Didit API (validación CURP en base de datos oficial) |
| Despliegue | Vercel (Edge + Node.js runtime según ruta) |
| Exports | SheetJS (XLSX) |

**Tokens de diseño:**
- Fondo: `#050508`
- Dorado: `#c4a882`
- Cian: `#00f2ff`
- Fuente mono: utilizada en UI admin y datos técnicos

---

### 4. Clientes Activos

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

### 5. Reglas de Desarrollo

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

### 6. Estructura de Módulos Clave

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

### 7. Agentes Disponibles

- **Agente de Seguridad:** `.cloud/agents/security.md` — audita privacidad, OWASP, manejo de PII antes de deploy.
- **Arquitectura extensible:** Para agregar un nuevo tipo de documento, crear `lib/documents/config/[tipo].config.ts` siguiendo el patrón existente. Para nuevo cliente B2B, crear `app/api/[cliente]/validate/route.ts` + `lib/[cliente]/`.

---

### 8. Variables de Entorno Requeridas

```
ANTHROPIC_API_KEY          — Claude API
NEXT_PUBLIC_SUPABASE_URL   — Supabase proyecto
NEXT_PUBLIC_SUPABASE_ANON_KEY
DIDIT_API_KEY              — Verificación CURP externa
UAG_API_KEY                — API key del cliente UAG
ADMIN_EMAIL                — Email de acceso al admin
ADMIN_PASSWORD             — Contraseña del admin
ADMIN_JWT_SECRET           — Secret para firmar tokens JWT del admin
ELEVENLABS_API_KEY         — Text-to-speech del asistente de voz
ELEVENLABS_VOICE_ID        — ID de la voz clonada de Nasus
ELEVENLABS_MODEL_ID        — Opcional (default: eleven_multilingual_v2)
```
