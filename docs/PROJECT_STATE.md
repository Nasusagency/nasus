# Estado del proyecto — Nasus Agency

Documento de contexto centralizado, generado a partir del código real del repo (no de memoria ni de suposiciones). Última actualización: 2026-08-29, tras cerrar las 15 fases del plan "CRM Agentic".

Para detalle operativo puntual, ver también: [`CLAUDE.md`](../CLAUDE.md) (reglas de desarrollo, rutas, variables de entorno completas), [`docs/acquisition-ads-sync.md`](acquisition-ads-sync.md) (sync de Google Ads), [`docs/gmail-proposal-delivery.md`](gmail-proposal-delivery.md) (setup OAuth Gmail), [`docs/uag-api.md`](uag-api.md) (API pública para UAG — producto aparte, no forma parte del flujo CRM).

---

## 1. Arquitectura general

### Stack

| Capa | Tecnología |
|---|---|
| Framework | Next.js 16.2.4 (App Router), React 19.2.4, TypeScript |
| Estilos | Tailwind CSS v4 |
| Base de datos | Supabase (Postgres), acceso server-side vía `@supabase/supabase-js` con service role — **todas** las tablas tienen RLS activo sin políticas (`anon`/`authenticated` no pueden leerlas; el único camino es `lib/supabase/service.ts`) |
| LLM principal | Claude (`@anthropic-ai/sdk`) — Haiku 4.5 para WhatsApp/voz por defecto, Sonnet 4.6 para generación estructurada (propuestas, cotizaciones, documentos, voz) |
| LLM secundario | Groq (`openai/gpt-oss-120b`), llamado por HTTP directo en `lib/llm/provider.ts` — no hay SDK de Groq en `package.json` |
| WhatsApp | Meta Cloud API, webhook firmado (`X-Hub-Signature-256`) |
| Pagos | Mercado Pago (Checkout Pro), llamado por HTTP directo — no hay SDK de Mercado Pago |
| Email saliente | Gmail API (OAuth2, propuestas) + Resend (notificaciones de escalación) |
| Voz | Web Speech API (STT, navegador) + Claude (texto) + ElevenLabs (TTS) |
| Deploy | Vercel |

Sin dependencias de IA por SDK propietario salvo Anthropic: Groq, Mercado Pago y ElevenLabs se llaman con `fetch` crudo.

### Estructura de carpetas relevante

```
app/
  admin/(shell)/          — panel admin (JWT httpOnly, ver lib/admin/auth.ts)
    leads/[id]/            — ficha única del contacto (lifecycle, adquisición, cotizaciones, propuestas, pagos, actividad, WhatsApp)
    cotizaciones/, propuestas/, whatsapp/, acquisition/, configuracion/
    cambios/, clientes/     — legacy, redirigen a /admin/leads
  admin/login/, admin/layout.tsx
  internal/voice-test/    — QA del asistente de voz, protegida con el mismo JWT admin, fuera del nav del CRM
  (client)/propuesta/[slug]/, (client)/cliente/[slug]/, (client)/pagar/[token]/, (client)/pagar/gracias/  — páginas públicas noindex compartidas con clientes
  api/whatsapp/webhook/   — pipeline completo de mensajes entrantes (ver §1 flujo)
  api/admin/...           — endpoints del panel (auth JWT)
  api/payments/mercadopago/webhook/ — confirmación de pagos
  _components/            — VoiceAssistant (FAB global), AcquisitionTracker, AssistantHint

lib/
  admin/                  — auth JWT, data de propuestas legacy, acquisition-data (ficha del contacto)
  crm/                    — domain.ts (máquina de estados), quotes.ts, proposals.ts, proposal-delivery.ts, payments.ts, service.ts (recordCrmActivity)
  whatsapp/               — webhook helpers, agent-handlers.ts (tools de Groq), master-agent.ts, tool-context.ts (binding canónico), groq-allowlist.ts, conversation-policy.ts
  llm/                    — provider.ts (callLLM provider-agnóstico), tools.ts, tool-results.ts
  payments/               — provider.ts (interfaz), mercadopago.ts (implementación)
  email/gmail.ts, voz/ (prompt, elevenlabs, sanitize), documents/, photos/, facturas/, uag/

supabase/migrations/      — 0001 a 0018, ver §5
tests/                    — 303 tests, node:test nativo (sin Jest/Vitest)
```

### Flujo end-to-end (WhatsApp → lead → cotización → propuesta → Gmail → pago → confirmación)

1. **Entrada**: Meta manda un webhook a `POST /api/whatsapp/webhook`. Se verifica la firma (`WHATSAPP_APP_SECRET`), se responde `200` de inmediato y el procesamiento real corre después (`after()`).
2. **Idempotencia + routing**: cada `message_id` se procesa una sola vez. Si el remitente está en `WHATSAPP_MASTER_ADMIN_NUMBERS`, el mensaje se enruta completo al **Master Agent** (`lib/whatsapp/master-agent.ts`) y ahí termina — nunca cae al flujo de ventas (probado explícitamente, ver `tests/whatsapp-master-agent.test.ts`).
3. **Selección de proveedor** (remitente normal): `selectProvider()` — Groq solo si `WHATSAPP_AGENT_PROVIDER=groq` **y** el número está en `WHATSAPP_GROQ_TEST_NUMBERS`; cualquier otro caso (incluida mala configuración) cae a Claude por default. Groq corre un loop agentic (máx. 3 rondas) con tools; si falla, hace fallback a Claude en el mismo request.
4. **Persistencia del lead**: `guardar_actualizar_lead` (Groq) escribe/actualiza `whatsapp_leads`, con `resolveGroqStage()` — Groq solo puede mover `exploring → opportunity → qualified`, nunca `proposal`/`won`/`lost`.
5. **Cotización**: un admin humano crea un draft en `/admin/cotizaciones/nueva` → `crm_quotes` + `crm_quote_items`. Al aprobar (`crm_approve_quote`, RPC transaccional), se congela un snapshot inmutable en `crm_quote_versions`.
6. **Propuesta**: desde la cotización aprobada, `createProposalFromApprovedQuote()` genera `crm_proposals` (copy redactado por Claude vía `writeProposalCopy`, términos legales desde `crm_proposal_templates`). El admin edita, marca "lista para envío" (`ready_for_delivery`).
7. **Envío por Gmail**: `deliverProposal()` reserva una fila en `crm_proposal_deliveries` (idempotente por `proposal_id:version`, con reclamo automático de reservas huérfanas/fallidas), llama a Gmail, y finaliza con la RPC transaccional `crm_finalize_proposal_delivery` — nunca se marca `sent` sin una respuesta real de Gmail con `messageId`/`threadId`.
8. **Pago**: un admin crea un pago desde la ficha del contacto (`POST /api/admin/pagos` → `crm_payments`, RPC `crm_create_payment`) y se genera un checkout de Mercado Pago. El cliente paga en `/pagar/[token]` (marca Nasus, token aleatorio de 32 bytes, no secuencial).
9. **Confirmación**: Mercado Pago llama a `POST /api/payments/mercadopago/webhook`. Se verifica la firma HMAC (`MERCADOPAGO_WEBHOOK_SECRET`) **antes** de confiar en cualquier dato del body; luego se vuelve a consultar el pago real contra la API de Mercado Pago (nunca se confía en el payload del webhook) y se compara monto/moneda contra lo registrado. Solo entonces `crm_confirm_payment` transiciona `pending → paid` (idempotente: un webhook duplicado no reprocesa ni duplica actividad).
10. **Groq con contexto de pagos**: el agente de WhatsApp puede consultar el estado de un pago o reenviar un link ya existente (`consultar_estado_pago`, `consultar_pagos_pendientes`, `recuperar_link_pago_existente`), pero sus schemas no tienen campo de monto/moneda/status — estructuralmente no puede inventar ni alterar un cargo.

---

## 2. Entidades principales y relación

```
whatsapp_leads (contacto canónico)
 ├─ acquisition_events (atribución UTM, first-touch)
 ├─ whatsapp_mensajes / whatsapp_conversations (historial WhatsApp, mode: ai/human/paused)
 ├─ whatsapp_requerimientos (tickets/solicitudes)
 ├─ crm_activities (auditoría append-only, idempotente por key)
 ├─ crm_suggestions (recomendaciones del sistema pendientes de revisión humana)
 └─ crm_quotes (cotizaciones)
     ├─ crm_quote_items (líneas)
     ├─ crm_quote_reviews (revisión técnica de Claude)
     ├─ crm_quote_versions (snapshot inmutable al aprobar)
     └─ crm_proposals (propuestas, versionadas, ligadas a quote_version_id)
         ├─ crm_proposal_deliveries (intentos/recibos de envío por Gmail)
         └─ crm_payments (pagos — puede haber varios por propuesta: anticipo + entrega)
```

Nombres reales de columnas de FK: `crm_quotes.contact_id`, `crm_proposals.contact_id` / `quote_id` / `quote_version_id` / `parent_proposal_id`, `crm_proposal_deliveries.proposal_id`, `crm_payments.contact_id` / `proposal_id` / `quote_id` / `quote_version_id`. Todas cascadean desde `whatsapp_leads` salvo `whatsapp_requerimientos.contact_id` (set null, no cascade).

Tablas de soporte no jerárquicas: `crm_pricing_profiles` + `crm_pricing_rates` (tarifario, un perfil activo a la vez), `crm_proposal_templates` (términos legales, uno activo a la vez), `idempotency_keys` (dedup de tool calls de Groq), `acquisition_campaign_metrics` + `acquisition_ads_sync_status` (gasto de campañas, manual + sync de Google Ads).

**RLS**: las 21 tablas del dominio CRM/WhatsApp/pagos tienen `enable row level security` sin políticas — el único acceso es `SUPABASE_SERVICE_ROLE_KEY` desde servidor. Las escrituras sensibles (aprobar cotización, convertir contacto, confirmar pago, finalizar entrega de propuesta) pasan por funciones Postgres `security definer` revocadas de `public` y otorgadas solo a `service_role` (`crm_approve_quote`, `crm_convert_contact`, `crm_apply_human_decision`, `crm_create_payment`, `crm_confirm_payment`, `crm_finalize_proposal_delivery`, entre otras) — nunca un `UPDATE` suelto desde la app para esos casos.

---

## 3. Estado de las 15 fases del plan CRM Agentic

| Fase | Qué se implementó | Archivos clave | Decisión de arquitectura |
|---|---|---|---|
| 0-5 | Fundación: WhatsApp Cloud API, Groq Agent v1 (6 tools originales), idempotencia, funnel de adquisición, lifecycle/stage CRM | `lib/whatsapp/`, `lib/llm/tools.ts`, `lib/crm/domain.ts`, migraciones 0001-0009 | Groq como agente operativo con Claude de fallback: Groq es más barato/rápido para tool-calling de alto volumen, Claude es la red de seguridad cuando Groq falla o no está autorizado para ese número |
| 6 | Propuesta automática desde cotización aprobada | `lib/crm/proposals.ts`, `app/api/admin/propuestas/from-quote/` | El copy lo redacta Claude pero el total/snapshot vienen del quote aprobado, nunca del LLM (`writeProposalCopy` no expone `total` en su schema) |
| 7 | Envío real por Gmail | `lib/email/gmail.ts`, `lib/crm/proposal-delivery.ts`, migraciones 0015-0016 | OAuth2 con refresh token, nunca contraseñas; **fix de esta ronda**: reservas huérfanas/fallidas se reclaman con `UPDATE...WHERE status=X` (atómico por fila) en vez de `INSERT` duplicado; finalización atómica vía RPC en vez de dos updates sueltos |
| 8 | Modelo de pagos provider-neutral | `supabase/migrations/0017_crm_payments.sql`, `lib/payments/provider.ts` | `crm_payments` con estados `pending/paid/failed/cancelled/refunded`, independiente del proveedor |
| 9 | Primer proveedor: Mercado Pago | `lib/payments/mercadopago.ts` | Elegido sobre Stripe/PayPal por ser el más fuerte en México/LatAm para el perfil de cliente B2B mexicano de Nasus. Verificación de firma HMAC documentada por MP, falla cerrado sin secret |
| 10 | Página de pago con marca Nasus | `app/(client)/pagar/[token]/`, migración 0018 | Token aleatorio de 32 bytes generado en la app (no en Postgres, para no depender de que `pgcrypto` esté habilitado) |
| 11 | Groq con contexto de pagos | `lib/llm/tools.ts`, `lib/whatsapp/agent-handlers.ts` (tools 7-9) | Garantía estructural, no solo de prompt: los schemas de las 3 tools no tienen campo de monto/moneda/status |
| 12 | Captura manual universal | `lib/whatsapp/master-agent.ts` | El Master Agent ya resolvía identidad/ambigüedad/confirmación de fases previas; esta ronda agregó el campo `source` (whatsapp_manual/meeting/call/email/web/admin) para distinguir el canal real del evento reportado del canal por el que llega el mensaje (siempre WhatsApp) |
| 13 | UX admin — ficha única del contacto | `app/admin/(shell)/leads/[id]/page.tsx` | La ficha única ya existía de una fase anterior (lifecycle, adquisición, requerimientos, propuestas, actividad, WhatsApp); esta ronda agregó las secciones de Cotizaciones y Pagos que faltaban, sin crear una página nueva |
| 14 | Seguridad/idempotencia | — (auditoría, sin cambios de código) | Revisión de firma de webhook, RLS, binding canónico, idempotencia de pagos/propuestas, tokens de pago, logs. Sin hallazgos por encima de confianza 7/10 |
| 15 | Tests E2E | `tests/crm-payments.test.ts`, `tests/whatsapp-master-agent.test.ts` | Se auditó cobertura existente antes de escribir (evitando duplicar); se agregaron los escenarios de mayor riesgo que faltaban: webhook duplicado idempotente, redirect sin webhook nunca marca `paid`, scoping de pagos por contacto, admin nunca cae al Sales Agent |

Después de cerrar las 15 fases se hicieron 2 tareas puntuales adicionales (fuera del plan original, pedidas por uso diario del admin):
- El asistente de voz (FAB global `VoiceAssistant`, montado en `app/layout.tsx`) se ocultaba solo en rutas `/admin/*`; se agregó `/internal/voice-test` (misma auth JWT admin, fuera del nav del CRM) para poder probarlo sin que flote sobre el panel operativo.
- El modelo de voz pasó de Haiku 4.5 a Sonnet 4.6 (`lib/voz/prompt.ts`), el mismo string que ya usan propuestas/facturas/documentos/UAG.

---

## 4. Variables de entorno

Lista completa y actualizada en [`CLAUDE.md` §9](../CLAUDE.md). Resumen por función:

| Variable | Para qué sirve |
|---|---|
| `ANTHROPIC_API_KEY` | Claude — WhatsApp fallback, voz, generación de propuestas/cotizaciones/documentos |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Cliente Supabase público (auth de usuarios del validador) |
| `SUPABASE_SERVICE_ROLE_KEY` | Único acceso a las tablas de WhatsApp/CRM/pagos (RLS sin políticas) |
| `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_VERIFY_TOKEN`, `WHATSAPP_APP_SECRET` | Meta Cloud API — envío, verificación de webhook, firma de payloads |
| `WHATSAPP_AGENT_PROVIDER`, `WHATSAPP_GROQ_TEST_NUMBERS` | Feature flag + allowlist para habilitar Groq por número |
| `WHATSAPP_MASTER_ADMIN_NUMBERS` | Allowlist de administradores del Master Agent (captura manual vía WhatsApp) |
| `GROQ_API_KEY` | Groq Agent (llamado por HTTP directo, sin SDK) |
| `GMAIL_CLIENT_ID`, `GMAIL_CLIENT_SECRET`, `GMAIL_REFRESH_TOKEN`, `GMAIL_SENDER_EMAIL` | OAuth2 para el envío real de propuestas (ver `docs/gmail-proposal-delivery.md`) |
| `MERCADOPAGO_ACCESS_TOKEN`, `MERCADOPAGO_PUBLIC_KEY`, `NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY` | Checkout Pro — crear preferencias de pago y consultar pagos reales |
| `MERCADOPAGO_WEBHOOK_SECRET` | Verificación HMAC de la firma del webhook de Mercado Pago (sin esto, todo webhook se rechaza — falla cerrado) |
| `NEXT_PUBLIC_SITE_URL` | Base para los links públicos (`/propuesta/[slug]`, `/pagar/[token]`, `notification_url` del webhook de MP) |
| `RESEND_API_KEY`, `NOTIFY_FROM` | Notificaciones por email de escalación a asesor humano |
| `ELEVENLABS_API_KEY`, `ELEVENLABS_VOICE_ID`, `ELEVENLABS_MODEL_ID` | TTS del asistente de voz |
| `DIDIT_API_KEY` | Verificación de CURP/INE contra base oficial (módulo Validador, requiere autorización escrita del cliente antes de activarse en producción) |
| `UAG_API_KEY` | API key del cliente B2B UAG |
| `ZOHO_CLIENT_ID`, `ZOHO_CLIENT_SECRET`, `ZOHO_BACKSTAGE_REFRESH_TOKEN`, `ZOHO_BACKSTAGE_PORTAL_ID` | Experimento de tracking UTM en Zoho Backstage (POC, no productivo) |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `ADMIN_JWT_SECRET` | Login y firma de sesión del panel admin |
| `GOOGLE_ADS_*`, `CRON_SECRET` | Sync de métricas de campañas (ver `docs/acquisition-ads-sync.md`) |

Todas viven en `.env.local` (local, gitignored) y en el panel de Vercel (producción) — nunca en código ni en Git.

---

## 5. Migraciones: aplicadas vs pendientes

19 archivos en `supabase/migrations/`, `0001` a `0019`.

- **`0001` a `0019`**: todas aplicadas en producción (Supabase SQL Editor), incluidas `0016_proposal_delivery_finalize.sql`, `0017_crm_payments.sql`, `0018_crm_payments_public_token.sql` y `0019_whatsapp_leads_manual_crud.sql` — confirmado por el usuario 2026-08-29. `crm_finalize_proposal_delivery`, `crm_payments` (+ RPCs `crm_create_payment`/`crm_attach_payment_checkout`/`crm_confirm_payment`) y `whatsapp_leads.archived_at`/`archived_by` ya existen y están operativos.

No hay migraciones pendientes de aplicar al momento de esta actualización.

---

## 6. Deuda técnica y mejoras futuras abiertas

- **Verificación end-to-end de pago real pendiente.** `MERCADOPAGO_WEBHOOK_SECRET` ya está configurado (producción, en `.env.local` y Vercel), pero nadie ha corrido un pago real de punta a punta (crear pago → pagar en `/pagar/[token]` → confirmar que el webhook marca `paid`). Los tests cubren el flujo con mocks fieles a las respuestas documentadas de Mercado Pago, no una llamada real.
- **UX del admin es funcional pero visualmente básica.** Sin feedback de loading consistente en botones de acción, sin estados de seleccionado/activo claros, sin empty states diseñados, sin manejo de error consistente (más allá de mensajes de texto plano). Es el objeto de la siguiente ronda de trabajo (rediseño UX/UI del panel).
- **No hay un listado global de pagos.** `crm_payments` solo se puede ver desde la ficha de un contacto (`/admin/leads/[id]`); no existe un `/admin/pagos` con todos los pagos de todos los contactos (útil para conciliación).
- **`crm_activities.source` en `proponer_accion_sensible` sigue fijo en `"whatsapp_manual"`.** El campo `source` dinámico (fase 12) solo se conectó a `registrar_contacto_manual`; aceptar una propuesta o marcar `lost`/`convert_client` vía Master Agent no captura el canal real del evento porque esas acciones no tienen ese parámetro en su tool schema. Bajo impacto (son decisiones que de por sí requieren confirmación explícita), pero queda inconsistente si se le da importancia al reporting por canal.
- **Sync de ChatGPT Ads no implementado** (documentado en `docs/acquisition-ads-sync.md`) — no hay API pública para eso todavía.
- **Páginas legacy `/admin/cambios` y `/admin/clientes`** son redirects a `/admin/leads` (con y sin filtro de lifecycle). Funcionan, pero son rutas muertas que podrían limpiarse cuando se toque el nav del admin.
- **2 vulnerabilidades moderadas en `postcss`** (dependencia transitiva de Next.js), documentadas en `.cloud/agents/security.md`, sin fix no-breaking disponible — monitorear en cada release.

---

## 7. Cobertura de tests

303 tests (`node:test` nativo, sin Jest/Vitest — `npm run test`), en 52 archivos bajo `tests/`. Cubierto con test automatizado real (no manual):

- Firma HMAC del webhook de Mercado Pago (acepta válida, rechaza alterada, rechaza sin secret configurado — nunca falla abierto).
- Webhook de pago duplicado: idempotente, no reprocesa ni duplica actividad `payment_confirmed`.
- Redirect del navegador sin webhook nunca marca `paid` (test estructural: solo el webhook llama a `confirmPaymentFromProvider` en toda la app).
- `crm_payments` scoping por contacto (un `payment_id` no puede filtrar el pago de otro contacto).
- Reintento de `delivery_already_reserved` tras reserva huérfana/fallida (fix de fase 7).
- Finalización atómica de envío de propuesta: si el RPC de persistencia falla, no responde `ok:true` y preserva `messageId`/`threadId`.
- Tools de pago de Groq: schemas sin campo de monto/moneda/status; `numero`/`payment_id` siempre atados al número real de Meta vía `bindCanonicalToolInput`.
- Un admin autorizado nunca cae al Sales Agent (test estructural sobre el branch `isMasterAdmin`).
- Ambigüedad de contacto en Master Agent pide aclaración, nunca adivina un ID.
- Captura manual: canal real del evento (`source`) capturado o degradado a `whatsapp_manual` si el LLM inventa un valor fuera del enum.
- First-touch attribution nunca se sobrescribe (`captureFirstTouch`).
- Gating determinista: mensajes triviales en modo `human` no invocan ningún LLM.
- Observador pasivo: no responde en modo `human`, pero sí persiste señales comerciales relevantes.
- Groq nunca decide `stage` protegido (`won`/`lost`/`proposal`), nunca inventa el número de teléfono del contacto, nunca cambia el total de una cotización/propuesta.
- Aprobación de cotización → snapshot inmutable; cotización aprobada no se puede editar (guard triggers en Postgres).

Requiere verificación manual (no cubierto por test automatizado):
- **Pago real de punta a punta en Mercado Pago** (sandbox o producción con monto mínimo) — los tests mockean las respuestas de la API de MP, no llaman a la API real.
- **Entrega real de un correo por Gmail** — los tests mockean la respuesta de la API de Gmail.
- **Sync real de Google Ads** — cubierto por `npm run google-ads:smoke`, un script separado, no por la suite de `npm run test`.
- Comportamiento visual/UX del admin (loading states, responsive, accesibilidad) — no hay tests de UI/e2e de navegador en este proyecto.
