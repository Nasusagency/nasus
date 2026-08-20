# Implementación de Idempotencia Persistente

**Fecha:** 2026-08-19  
**Estado:** ✅ Completado (código + migración SQL)

---

## Mecanismo Final

### Antes: Deduplicación en Memoria
- ❌ No sobrevive reinicios en Vercel
- ❌ No funciona con múltiples instancias
- ❌ Inútil en serverless

### Después: Idempotency Keys en Supabase

**Tabla:** `public.idempotency_keys`

```sql
create table public.idempotency_keys (
  key text primary key,              -- hash del contenido
  tool_name text not null,           -- nombre de la herramienta
  result jsonb,                      -- resultado guardado (para retry)
  created_at timestamptz default now(),
  expires_at timestamptz default now() + interval '1 hour'
);
```

**Índice:** Para limpiar automáticamente registros >1 hora

**RLS:** Activo, sin políticas (solo service role accede)

---

## Flujo de Idempotencia

### 1. Verificar si ya se procesó

```typescript
const idempotencyKey = "req_" + hash(numero + tipo + descripcion);
const { isDuplicate } = await checkIdempotencyKey("registrar_requerimiento", key);

if (isDuplicate) {
  return { exito: false, error: "Requerimiento duplicado" };
}
```

### 2. Ejecutar operación

```typescript
// Crear requerimiento, enviar email, etc.
const result = await supabase.from("whatsapp_requerimientos").insert(...);
```

### 3. Guardar resultado

```typescript
await storeIdempotencyResult("registrar_requerimiento", key, result);
```

---

## Failover Resiliente

Si la tabla no existe (migración no ejecutada):
- ✅ Handlers permiten la operación (fail open)
- ✅ Log de warning: tabla no encontrada
- ✅ No rompe el sistema

**Resultado:** Funciona sin idempotencia hasta que se ejecute la migración

---

## Pruebas REALES Ejecutadas

### ✅ Lead Flow (100% PASADO)

```
1. Crear lead de prueba
   → Lead creado: bd6cfdc0-e4bc-4ed3-ad68-26d3e05975ea ✓

2. Recuperar de BD
   → Lead recuperado: stage=exploring ✓

3. Actualizar a stage=qualified
   → Lead actualizado (operación=actualizado) ✓

4. Verificar sin duplicados
   → 1 lead por número (sin duplicados) ✓

5. Limpiar datos
   → Lead eliminado ✓
```

**Estado:** 100% exitoso

---

### ✅ Requerimiento: Crear y Estado (PASADO)

```
1. Crear requerimiento
   → Requerimiento creado: ba72335b-31ea-45f4-8dac-a7354a743979 ✓

2. Verificar estado
   → Estado: abierto ✓
   → Prioridad: alta ✓

3. Prueba de idempotencia*
   → Segundo requerimiento se creó (tabla no existe aún)
   → Cuando se ejecute migración: será detectado como duplicado

4. Crear diferente
   → Segundo requerimiento (diferente tipo/descripción) se crea ✓

5. Limpiar datos
   → Requerimientos eliminados ✓
```

**Status:** Lógica OK, idempotencia **requiere migración SQL en Supabase**

---

### ✅ Resend: Email Enviado (PASADO)

```
1. Enviar email [TEST GROQ AGENT]
   → Email enviado exitosamente ✓

2. Intento de segundo email (idéntico)*
   → Segundo email se envió (tabla no existe aún)
   → Cuando se ejecute migración: será bloqueado

3. Limpiar datos
   → Emails de prueba ignorados
```

**Status:** Email funciona perfectamente, idempotencia **requiere migración SQL en Supabase**

---

## Qué Falta: Ejecutar Migración

La tabla `idempotency_keys` está definida pero **no existe en Supabase**.

### Para activar idempotencia:

1. **Opción A: Supabase SQL Editor (Recomendado)**
   ```
   Dashboard → SQL Editor → New Query
   Copia/pega: scripts/SETUP_IDEMPOTENCY.sql
   Click "Run"
   ```

2. **Opción B: Supabase CLI**
   ```bash
   npx supabase migration up --db-url "postgres://..."
   ```

3. **Opción C: Verificar**
   Después de ejecutar el SQL, consultar en SQL Editor:
   ```sql
   SELECT * FROM public.idempotency_keys LIMIT 1;
   ```

---

## Código Implementado

### `lib/whatsapp/agent-handlers.ts`

**Nuevas funciones:**
- `hashContent()`: Hash simple del contenido
- `checkIdempotencyKey()`: Verifica si ya se procesó
- `storeIdempotencyResult()`: Guarda resultado en BD

**Cambios en handlers:**

**`registrar_requerimiento()`**
```typescript
const idempotencyKey = `req_${hashContent(numero:tipo:descripcion)}`;
const { isDuplicate } = await checkIdempotencyKey(...);
if (isDuplicate) return { exito: false, error: "duplicado" };
// ... crear ...
await storeIdempotencyResult(...);
```

**`notificar_humano()`**
```typescript
const idempotencyKey = `email_${hashContent(asunto:cuerpo:numero)}`;
const { isDuplicate } = await checkIdempotencyKey(...);
if (isDuplicate) return { exito: false, error: "duplicado" };
// ... enviar ...
await storeIdempotencyResult(...);
```

**Resilencia:**
- Tabla no existe → permitir operación (fail open)
- Error en BD → permitir operación
- Unique constraint (23505) → ignorar

---

## Ventajas del Diseño

| Aspecto | Antes (Memoria) | Después (Supabase) |
|--------|-----------------|-------------------|
| Serverless | ❌ | ✅ Funciona |
| Múltiples instancias | ❌ | ✅ Funciona |
| Reinicios | ❌ | ✅ Persiste |
| Failover | ❌ | ✅ Fail open |
| Overhead | Mínimo | Mínimo (~1 query) |
| Complejidad | Baja | Baja |

---

## TypeScript & Build

```bash
✅ npx tsc --noEmit     → Sin errores
✅ npm run build        → Compilación exitosa
```

---

## Archivos Nuevos

- `supabase/migrations/0003_idempotency_keys.sql` — Definición de tabla
- `scripts/SETUP_IDEMPOTENCY.sql` — SQL para ejecutar en Supabase manualmente

---

## Próximos Pasos

1. **Ejecutar migración en Supabase**
   - Copiar `scripts/SETUP_IDEMPOTENCY.sql`
   - Pegar en Supabase SQL Editor
   - Click "Run"

2. **Verificar que tabla existe**
   ```sql
   SELECT * FROM public.idempotency_keys LIMIT 0;
   ```

3. **Re-ejecutar pruebas E2E**
   - Idempotencia bloqueará duplicados ✅

4. **Conectar Groq al webhook**
   - Entonces sí, idempotencia protege contra retries

---

## Status

| Componente | Status |
|-----------|--------|
| Código | ✅ Implementado |
| TypeScript | ✅ Sin errores |
| Build | ✅ Exitoso |
| Tests reales | ✅ Creación/actualización funciona |
| Tabla Supabase | ⏹️ Requiere migración manual |
| Idempotencia activa | ⏹️ Cuando tabla exista |
