# Mini Fase - Limpieza, Deduplicación y Validación

**Fecha:** 2026-08-19  
**Estado:** ✅ Completado

---

## 1. Limpieza de Servicios y Portafolio

### Servicios (antes: 6 genéricos, después: 6 profesionales)

**ANTES:**
- Validador de Documentos (producto específico)
- Extractor de Facturas (producto específico)
- Validador de Fotografías (producto específico)
- Desarrollo Web/Apps
- Automatización de Procesos
- Ecosistemas de Marketing

**DESPUÉS (aprobados para Nasus):**
```javascript
[
  "Páginas Web",
  "Apps Web y Móviles",
  "IA Aplicada a Procesos",
  "Automatización de Procesos",
  "CRM y Gestión",
  "Ecosistemas de Marketing Digital"
]
```

✅ Cambio: Reemplazados con servicios genéricos (sin inventar detalles)

---

### Portafolio (antes: 2 registros mixtos, después: 1 proyecto confirmado)

**ANTES:**
- Universidad Autónoma de Guadalajara (UAG)
- Automatización de Facturas (producto interno)

**DESPUÉS (únicamente proyectos confirmados):**
```javascript
[
  {
    nombre: "Sistema de Validación de Documentos (UAG)",
    descripcion: "Plataforma de validación de documentos para procesos de admisión",
    cliente: "UAG",
    resultado: "API v1.0 en fase de integración. Validación de certificados, actas, fotografías."
  }
]
```

✅ Cambio: 
- Eliminado: "Automatización de Facturas" (es producto interno, no portafolio comercial)
- Mantenido: UAG (cliente real, en CLAUDE.md como activo)

---

## 2. Deduplicación Mínima Implementada

### Ventana: 5 minutos

### Para `registrar_requerimiento()`

**Lógica:**
1. Hash del contenido: `numero_contacto:tipo:descripcion_original`
2. Si existe en la ventana 5min → rechazar
3. Si se inserta exitosamente → marcar como "enviado"
4. Limpiar automáticamente entradas >5min

**Código:**
```typescript
const dedupeKey = `${numero_contacto}:${tipo}`;
const contentHash = hashContent(descripcion_original);
const dedupeHash = `${dedupeKey}:${contentHash}`;

if (isDeduped(requerImientoDedupe, dedupeHash)) {
  return {
    exito: false,
    mensaje: "Requerimiento duplicado detectado (enviado hace <5 min)"
  };
}

// ... insertar en BD ...

markDeduped(requerImientoDedupe, dedupeHash);
```

✅ Protección contra retry de Groq

---

### Para `notificar_humano()`

**Lógica:**
1. Hash del contenido: `numero_contacto:asunto:cuerpo`
2. Si existe en ventana 5min → rechazar (no llamar Resend)
3. Si se envía exitosamente → marcar como "enviado"
4. Limpiar automáticamente entradas >5min

**Código:**
```typescript
const contentHash = hashContent(`${asunto}:${cuerpo}`);
const dedupeKey = numero_contacto ? `${numero_contacto}:${contentHash}` : contentHash;

if (isDeduped(emailDedupe, dedupeKey)) {
  return {
    exito: false,
    mensaje: "Email duplicado detectado (enviado hace <5 min)"
  };
}

// ... enviar con Resend ...

markDeduped(emailDedupe, dedupeKey);
```

✅ Protección contra retries de Groq + Resend

---

## 3. Validación TypeScript

```bash
✅ npx tsc --noEmit
   → Sin errores
```

---

## 4. Validación Build

```bash
✅ npm run build
   → Compilación exitosa
   → 15 rutas generadas sin warnings críticos
```

---

## 5. Pruebas Supabase

### Requisitos Previos
- NEXT_PUBLIC_SUPABASE_URL configurada
- SUPABASE_SERVICE_ROLE_KEY configurada
- Migración 0002_groq_agent_v1.sql ejecutada

### Casos a Validar (manual o en CI/CD)

**Lead Flow:**
```
1. Crear lead: numero=523399998888, stage=exploring
2. Recuperar: debe existir
3. Actualizar: stage=qualified
4. Verificar: solo 1 registro por número (sin duplicados)
5. Limpiar: DELETE WHERE numero=523399998888
```

**Requerimiento Flow:**
```
1. Crear req: numero=523399997777, tipo=problema, descripcion="Test"
2. Verificar: estado="abierto"
3. Intentar crear idéntico: debe ser rechazado (deduplicado)
4. Crear diferente: tipo=consulta, descripcion="Different" → debe ser aceptado
5. Limpiar: DELETE WHERE numero=523399997777
```

**Status:** ⚠️ Requiere credenciales Supabase en ambiente real

---

## 6. Pruebas Resend

### Requisitos
- RESEND_API_KEY configurada (opcional en desarrollo)

### Casos a Validar

**Email Flow:**
```
1. Enviar email: asunto="TEST", cuerpo="Test body"
2. Verificar: email_enviado=true
3. Intentar enviar idéntico: debe ser rechazado (deduplicado)
4. Enviar diferente: asunto="TEST2", cuerpo="Different" → debe ser aceptado
```

**Status:** ⚠️ Requiere RESEND_API_KEY en ambiente real

---

## Cambios de Código

### `lib/whatsapp/agent-handlers.ts`

**Adiciones:**
- Deduplicación en memoria (Maps con ventana 5min)
- Funciones helper: `hashContent()`, `isDeduped()`, `markDeduped()`, `cleanOldEntries()`
- Validación en `registrar_requerimiento()` y `notificar_humano()`

**Cambios:**
- `consultar_servicios()`: Lista de 6 servicios aprobados (antes: 6 genéricos)
- `consultar_portafolio()`: 1 proyecto confirmado (antes: 2 mixtos)

**Líneas:** +150 de deduplicación, -50 de limpieza = +100 neto

---

## Resumen de Estado

| Componente | Antes | Después | Status |
|-----------|-------|---------|--------|
| Servicios | 6 genéricos (mezcla) | 6 aprobados | ✅ Limpio |
| Portafolio | 2 mixtos | 1 confirmado | ✅ Limpio |
| Dedup Req | ❌ No | ✅ Ventana 5min | ✅ Implementado |
| Dedup Email | ❌ No | ✅ Ventana 5min | ✅ Implementado |
| TypeScript | ✅ | ✅ | ✅ Sin errores |
| Build | ✅ | ✅ | ✅ Exitoso |
| Webhook | 🔌 Stub | 🔌 Stub | ⏹️ No conectado |

---

## Próximos Pasos

### Para validación real (requiere ambiente con credenciales):
1. Ejecutar con `NEXT_PUBLIC_SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY`
2. Crear leads de prueba → verificar en `whatsapp_leads`
3. Crear requerimientos → verificar estado `abierto` en `whatsapp_requerimientos`
4. Probar deduplicación (doble crear idéntico → debe fallar)
5. Limpiar datos de prueba

### Para Resend (opcional):
1. Configurar `RESEND_API_KEY`
2. Llamar `notificar_humano()` → verificar en Resend dashboard
3. Llamar idéntico → debe ser rechazado

### Cuando todo esté validado:
1. Conectar Groq al webhook de WhatsApp
2. Push a `main`
3. Merge de `feat/groq-agent-v1`

---

## Commits

```
✅ 4e7b91e feat: implementar 4 handlers reales del Groq Agent v1
✅ ffe1a86 docs: agregar reportes de validación E2E de handlers
```

---

## Nota de Seguridad

✅ Deduplicación no depende de Groq "portándose bien"
✅ Handlers validan todos los inputs (número, campos obligatorios)
✅ Resend no se llama si el email es duplicado (ahorro de créditos)
✅ Supabase mantiene RLS sin políticas (solo service role accede)
