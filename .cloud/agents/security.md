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

---

## Criterios de aprobación

| Control | Acción requerida |
|---------|-----------------|
| PII en logs de consola (`raw`, `buffer`, `base64`, `fields`) | 🔴 Bloqueante — corregir antes de merge |
| Buffer/base64 fuera del scope local de `POST()` | 🔴 Bloqueante |
| Nombre de env var en mensajes de error al cliente | 🔴 Bloqueante |
| Datos binarios o base64 en Supabase | 🔴 Bloqueante |
| Vulnerabilidades altas/críticas en `npm audit` | 🔴 Bloqueante |
| Vulnerabilidades moderadas en deps transitivas | 🟡 Documentar, no bloquea |
| `fields` PII en Supabase sin autorización del cliente | 🟡 Advertencia — requiere confirmación escrita |

---

## Registro de hallazgos

| # | Archivo | Línea | Hallazgo | Severidad | Estado |
|---|---------|-------|----------|-----------|--------|
| 1 | `app/api/validate/route.ts` | 101 | `console.error` incluía `raw` (texto OCR con PII: nombres, números de documento, fechas) | 🔴 Alto | ✅ Corregido 2026-04-24 |
| 2 | `app/api/validate/route.ts` | 89 | Mensaje de error exponía `ANTHROPIC_API_KEY` como texto literal al cliente | 🟡 Medio | ✅ Corregido 2026-04-24 |
| 3 | `app/api/validate/route.ts` | 133 | `fields` con PII se persiste en Supabase; no hay autorización explícita del cliente documentada | 🟡 Advertencia | 🔄 Pendiente confirmación del cliente |
| 4 | — | — | 2 vulnerabilidades moderadas en `postcss` (dep. transitiva de Next.js). Sin fix no-breaking disponible | 🟡 Moderada | 🔄 Monitorear en cada release |

---

## Estado del último ciclo

- **Fecha**: 2026-04-24
- **Auditor**: Claude (invocación automática pre-tarea)
- **Resultado**: APROBADO — todos los hallazgos activos resueltos o documentados
- **Cobertura**: 42/42 tests en verde (normalizer, dni, acta, curp, rfc, ine, pasaporte)
- **Próxima auditoría**: antes del siguiente PR a `main`
