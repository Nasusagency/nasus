# Configuración de Allowlist para Prueba Groq

**Fecha:** 2026-08-20  
**Estado:** ✅ Implementado y validado

---

## Resumen

Implementación de allowlist controlada para probar **Groq Agent solo con número autorizado** mientras se mantiene Claude como fallback y default.

---

## Variables de Entorno Requeridas

### En desarrollo local (`.env.local`)

```bash
# Activar Groq (si no está configurado, default = claude)
WHATSAPP_AGENT_PROVIDER=groq

# Números autorizados para Groq (tu número)
WHATSAPP_GROQ_TEST_NUMBERS=523331002790
```

### En Vercel (producción)

**Project Settings → Environment Variables**

Agregar dos variables:

| Variable | Valor | Notas |
|----------|-------|-------|
| `WHATSAPP_AGENT_PROVIDER` | `groq` | Activar Groq |
| `WHATSAPP_GROQ_TEST_NUMBERS` | `523331002790` | Tu número |

**⚠️ IMPORTANTE:** Si no configuras `WHATSAPP_GROQ_TEST_NUMBERS`, aunque `WHATSAPP_AGENT_PROVIDER=groq`, el sistema **automáticamente rechaza Groq y usa Claude** (seguridad).

---

## Lógica de Selección

```
┌─ ¿WHATSAPP_AGENT_PROVIDER = "groq"?
│
├─ NO → Claude (default)
│
└─ SÍ
   ├─ ¿WHATSAPP_GROQ_TEST_NUMBERS configurado?
   │
   ├─ NO → Claude (seguridad: evita activación accidental)
   │
   └─ SÍ
      ├─ ¿Número entrante en allowlist?
      │
      ├─ SÍ  → Groq Agent
      ├─ NO  → Claude
      │
      └─ ¿Groq falla?
         └─ SÍ → Fallback automático a Claude
```

---

## Funciones de Utilidad

### `lib/whatsapp/groq-allowlist.ts`

```typescript
// Normalizar número (elimina +, espacios, guiones)
normalizePhoneNumber("52 333-100-2790")  // → "523331002790"

// Verificar si está autorizado
isNumberInGroqAllowlist("523331002790", "523331002790,523331002791")  // → true

// Enmascarar para logging (sin PII)
maskPhoneNumber("523331002790")  // → "523***790"

// Seleccionar provider
selectProvider(
  "523331002790",
  "groq",                          // WHATSAPP_AGENT_PROVIDER
  "523331002790,523331002791"     // WHATSAPP_GROQ_TEST_NUMBERS
)  // → "groq"
```

---

## Logging y Observabilidad

### Número 523331002790 (AUTORIZADO)

```
[whatsapp] 523***790 → Groq Agent (autorizado)
[whatsapp] 523***790 Groq completado 245ms | groq | prospecto
```

### Número 523331002791 (NO AUTORIZADO)

```
[whatsapp] 523***791 Claude 180ms | prospecto | ticket
```

### Si Groq falla (fallback)

```
[groq-allowlist] Groq fallback a Claude (312ms)
[whatsapp] 523***790 Fallback a Claude | prospecto: sí
```

---

## Casos de Prueba Validados

### ✅ Normalización

```
"523331002790"       → "523331002790"
"+523331002790"      → "523331002790"
"52 333-100-2790"    → "523331002790"
"52-333-100-2790"    → "523331002790"
"+52 333-100-2790"   → "523331002790"
```

### ✅ Allowlist

```
Número: 523331002790, Allowlist: "523331002790"          → AUTORIZADO
Número: 523331002790, Allowlist: "523331002791"          → NO autorizado
Número: 523331002790, Allowlist: (vacío)                 → NO autorizado
Número: 523331002790, Allowlist: (undefined)             → NO autorizado
Número: 523331002790, Allowlist: "523331002790,523331002791"  → AUTORIZADO
```

### ✅ Provider Selection

```
Provider: "claude"        → Siempre Claude
Provider: "groq" + allowlist vacío    → Claude (seguridad)
Provider: "groq" + número autorizado  → Groq
Provider: "groq" + número NO autorizado → Claude
Provider: "groq" + Groq falla         → Fallback a Claude
```

---

## Enmascaramiento de Números

**En logs:** `523***790` (sin PII)

Estructura: `primeros3dígitos***últimos3dígitos`

---

## Flujo Completo del Webhook

```
1. Mensaje llega de WhatsApp
2. Verificar firma Meta (igual que antes)
3. Guardar mensaje en BD (igual que antes)
4. Obtener histórico (igual que antes)

5. NUEVO: selectProvider()
   - Leer WHATSAPP_AGENT_PROVIDER
   - Leer WHATSAPP_GROQ_TEST_NUMBERS
   - Verificar si número autorizado
   - Retornar "groq" o "claude"

6. Si provider = "groq":
   - Llamar callGroqAgent()
   - Si falla → fallback a Claude

7. Si provider = "claude":
   - Ejecutar flujo actual (detectarSolicitud + responderConClaude)

8. Responder al cliente (igual que antes)
```

---

## Instalación en Vercel

### Paso 1: Desplegar la rama

```bash
git push origin feat/groq-agent-v1
```

Vercel automáticamente construirá la rama.

### Paso 2: Configurar variables en Vercel

1. **Project Settings → Environment Variables**
2. **Add Variable:**
   - Nombre: `WHATSAPP_AGENT_PROVIDER`
   - Valor: `groq`
   - Environments: `Production`

3. **Add Variable:**
   - Nombre: `WHATSAPP_GROQ_TEST_NUMBERS`
   - Valor: `523331002790`
   - Environments: `Production`

### Paso 3: Re-desplegar

```bash
# En Vercel dashboard: Deployments → Redeploy
# O simplemente push un nuevo commit
```

### Paso 4: Probar

1. **Con tu número (523331002790)**
   - Envía un mensaje a WhatsApp
   - Groq debería responder (con fallback a Claude si hay error)
   - Verifica logs: `"523***790 → Groq Agent (autorizado)"`

2. **Con otro número (para verificar)**
   - Usa otro número de prueba (ej: 523331002791)
   - Claude debería responder
   - Verifica logs: `"523***791 Claude ..."`

---

## Seguridad

✅ No hay números hardcodeados en código  
✅ Números vienen de variable de entorno  
✅ Logging enmascara números (sin PII)  
✅ Si allowlist vacía → Claude (fail-safe)  
✅ Firma Meta verificada (igual que antes)  
✅ Fallback automático si Groq falla  
✅ Historial de conversación intacto  
✅ Rate limit intacto  

---

## Deshabilitar Groq (rollback)

Si quieres volver a Claude:

**En Vercel:** Eliminar variable `WHATSAPP_AGENT_PROVIDER` (o poner `claude`)

**Resultado:** Todos los mensajes usan Claude

---

## Archivos Modificados

- `lib/whatsapp/groq-allowlist.ts` (nuevo)
  - Lógica de normalización, verificación, enmascaramiento, selección
  
- `app/api/whatsapp/webhook/route.ts`
  - Integración de allowlist
  - Logging sin PII
  - Fallback handling

---

## Pruebas Unitarias

**24/24 PASADAS:**

```
✓ Normalización (6 tests)
✓ Allowlist (7 tests)
✓ Enmascaramiento (2 tests)
✓ Selección de provider (9 tests)
```

---

## Próximos Pasos

1. **Configura variables en Vercel**
2. **Envía mensaje desde tu número (523331002790)**
3. **Verifica logs:**
   - `"523***790 → Groq Agent (autorizado)"`
4. **Si funciona:** Considera agregar más números a allowlist
5. **Si falla:** Logs mostrán `"fallback a Claude"`

---

## Commits

```
68ec530 feat: fail-closed idempotencia + feature flag webhook para Groq Agent
c56e57c feat: idempotencia persistente con idempotency_keys en Supabase
a6ee925 feat: limpiar servicios/portafolio e implementar deduplicación mínima
ffe1a86 docs: agregar reportes de validación E2E de handlers
4e7b91e feat: implementar 4 handlers reales del Groq Agent v1
b2eed1d feat: allowlist controlada para prueba Groq con número autorizado
```

---

## Nota Final

Esta implementación permite probar **Groq Agent de forma controlada y segura** con tu número autorizado, sin afectar otros usuarios. En cualquier momento puedes:

- Agregar más números a allowlist
- Desactivar Groq (basta cambiar variable)
- Investigar logs sin PII
- Fallback automático si hay problemas

**Claude permanece como fallback y default** en todo momento.
