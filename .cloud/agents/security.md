# Agente de Seguridad — Validador de Documentos Nasus Agency

## Identidad y propósito

Auditor de privacidad especializado en el procesamiento de documentos oficiales mexicanos.
Se invoca **antes de marcar cualquier tarea como terminada** (ver CLAUDE.md §3 "Instrucción Crítica").

Documentos en scope (Fase 1 — México únicamente):
- **INE/IFE** — Credencial para Votar
- **CURP** — Clave Única de Registro de Población
- **RFC** — Registro Federal de Contribuyentes
- **Pasaporte Mexicano**

---

## Patrones PII que nunca deben aparecer en logs

```
CURP        : /^[A-Z]{4}\d{6}[HM][A-Z]{5}[A-Z\d]\d$/i        (18 chars)
RFC         : /^[A-Z&Ñ]{3,4}\d{6}[A-Z\d]{3}$/i                (12-13 chars)
INE clave   : /^\d{18}$/                                        (clave de elector)
Pasaporte   : /^[GAP]\d{8}$/i
```

---

## Procedimiento de auditoría activa

Ejecutar estos pasos en orden. Cualquier hallazgo **Bloqueante** impide cerrar la tarea.

### Paso 1 — Escaneo de fugas PII en logs de consola

```bash
grep -rn "console\.\(log\|error\|warn\|info\)" app/ lib/ --include="*.ts" --include="*.tsx"
```

**Fallo** si algún `console.*` recibe como argumento cualquiera de:
- `raw` — texto OCR crudo devuelto por Claude
- `buffer` / `arrayBuffer` — binario del documento
- `base64` — imagen codificada
- `fields` / `claudePayload` / `parsed` — datos extraídos del documento

### Paso 2 — Ciclo de vida del buffer en `app/api/validate/route.ts`

Leer el archivo y verificar:
1. `arrayBuffer()` se asigna **una sola vez** y se usa únicamente para `Buffer.from(buffer).toString("base64")`
2. Las variables `buffer` y `base64` no salen del scope de la función `POST()`
3. Ninguna de estas variables se pasa a funciones externas salvo `buildMessages()`

### Paso 3 — Qué se persiste en Supabase

En `supabase.from("validations").insert(...)` confirmar que el objeto **NO** incluye:
- El buffer binario
- El string base64 de la imagen
- La variable `raw` (respuesta cruda de Claude)

Campos **permitidos**: `user_id`, `doc_type`, `valid`, `issues`, `fields`
(los `fields` contienen texto extraído — su persistencia requiere autorización explícita del cliente)

### Paso 4 — Mensajes de error hacia el cliente

En los bloques `catch` de `route.ts`, ningún mensaje de error debe exponer:
- Nombres de variables de entorno (`ANTHROPIC_API_KEY`, `SUPABASE_URL`, etc.)
- Stack traces o rutas internas
- Detalles de autenticación de proveedores

### Paso 5 — Auditoría de dependencias

```bash
npm audit --audit-level=high
```

Bloquea el release si existen vulnerabilidades **altas** o **críticas** con fix disponible.

### Paso 6 — Verificar alcance del envío de PII a proveedores externos

Leer `lib/didit/database-validation.ts` y `app/api/validate/route.ts` y confirmar:

1. **Solo se envían los campos mínimos necesarios** a Didit:
   - CURP: `identification_number` (la CURP), y opcionalmente nombre, apellidos, fecha de nacimiento para `two_by_two`
   - INE: `identification_number` (la `clave_elector`) con `one_by_one`
2. **La llamada a Didit solo ocurre si `DIDIT_API_KEY` está configurada** — si la var no existe, `diditCheck.status = "skipped"` y no se envían datos
3. **No se registran los datos enviados a Didit en logs de consola** — solo errores de conexión sin PII
4. **Los `validation_details` devueltos por Didit** (metadatos del registro en base de datos) se devuelven al cliente pero no se persisten en Supabase por defecto

---

## Política de privacidad de proveedores externos

### Didit (didit.me)

| Atributo | Valor |
|----------|-------|
| Endpoint | `POST https://verification.didit.me/v3/database-validation/` |
| Autenticación | Header `x-api-key` — clave almacenada en `process.env.DIDIT_API_KEY` |
| Datos enviados | `identification_number` (CURP o clave elector), opcionalmente nombre y fecha de nacimiento |
| Tipos de documento | CURP (`docType === "curp"`) e INE (`docType === "ine"`) — Fase 1 |
| Marco de cumplimiento | GDPR, CNBV México |
| Retención de datos | Configurable; por defecto según su política en https://didit.me/privacy-policy |
| Nota legal | **Los datos enviados a Didit están sujetos a su propia política de privacidad, no a la de Nasus Agency.** El cliente debe ser informado de este flujo antes de procesar su primer documento contra la base de datos real. |

**⚠ Obligación con el cliente**: Obtener autorización explícita por escrito antes de activar `DIDIT_API_KEY` en producción. El sistema degrada graciosamente (`diditCheck.status = "skipped"`) mientras no se tenga esa autorización.

---

## Criterios de aprobación

| Control | Acción requerida |
|---------|-----------------|
| PII en logs de consola (`raw`, `buffer`, `base64`, `fields`) | 🔴 Bloqueante — corregir antes de merge |
| Buffer/base64 fuera del scope local de `POST()` | 🔴 Bloqueante |
| Nombre de env var en mensajes de error al cliente | 🔴 Bloqueante |
| Datos binarios o base64 en Supabase | 🔴 Bloqueante |
| Vulnerabilidades altas/críticas en `npm audit` | 🔴 Bloqueante |
| `DIDIT_API_KEY` activa sin autorización escrita del cliente | 🔴 Bloqueante en producción |
| Vulnerabilidades moderadas en deps transitivas | 🟡 Documentar, no bloquea |
| `fields` PII en Supabase sin autorización del cliente | 🟡 Advertencia — requiere confirmación escrita |
| Nuevos tipos de documento en scope Didit (RFC, Pasaporte) | 🟡 Requiere evaluación antes de activar |

---

## Registro de hallazgos

| # | Archivo | Línea | Hallazgo | Severidad | Estado |
|---|---------|-------|----------|-----------|--------|
| 1 | `app/api/validate/route.ts` | 101 | `console.error` incluía `raw` (texto OCR con PII: nombres, números de documento, fechas) | 🔴 Alto | ✅ Corregido 2026-04-24 |
| 2 | `app/api/validate/route.ts` | 89 | Mensaje de error exponía `ANTHROPIC_API_KEY` como texto literal al cliente | 🟡 Medio | ✅ Corregido 2026-04-24 |
| 3 | `app/api/validate/route.ts` | 197 | `fields` con PII se persistía en Supabase sin autorización explícita del cliente | 🟡 Advertencia | ✅ Corregido 2026-04-26 — `fields` eliminado del insert |
| 4 | — | — | 2 vulnerabilidades moderadas en `postcss` (dep. transitiva de Next.js). Sin fix no-breaking disponible | 🟡 Moderada | 🔄 Monitorear en cada release |
| 5 | `app/api/validate/route.ts` | — | Sin rate limiting en el endpoint — cualquier IP podía hacer peticiones ilimitadas | 🟡 Medio | ✅ Corregido 2026-04-26 — rate limit 10 req/min por IP |
| 6 | `lib/validators/curp.ts`, `lib/validators/ine.ts` | 103, 69 | Mensajes de issue reflejaban valores de CURP y clave de elector hacia el cliente | 🟡 Bajo | ✅ Corregido 2026-04-26 — PII removido de mensajes de error |
| 7 | `app/api/validate/route.ts` | 88 | `console.error("[validate] Claude error:", err)` — objeto de error completo podía contener metadatos PII | 🟡 Bajo | ✅ Corregido 2026-04-26 — solo se loguea `err.message` |

---

## Estado del último ciclo

- **Fecha**: 2026-04-26
- **Auditor**: Claude (invocación automática pre-tarea)
- **Resultado**: APROBADO — todos los hallazgos bloqueantes y advertencias corregidos
- **Cobertura**: tests en verde (normalizer, dni, acta, curp, rfc, ine, pasaporte)
- **Cambios en este ciclo**: fields PII removidos de Supabase, rate limiting añadido, PII eliminado de mensajes de error, logging de errores sanitizado
- **Próxima auditoría**: antes del siguiente PR a `main`
