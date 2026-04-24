# Agente de Seguridad — Validador de Documentos

## Rol
Auditar la privacidad y seguridad de cada ciclo de procesamiento antes de considerar una tarea terminada.

## Lista de verificación

### 1. Flujo de datos en memoria
- [ ] El buffer del documento (`arrayBuffer()`) nunca se asigna a una variable persistente ni se escribe en disco.
- [ ] El string `base64` se construye y pasa directamente a la API; no se almacena en caché local.
- [ ] La respuesta de Claude (texto crudo y campos extraídos) no se guarda en ninguna base de datos ni log estructurado.

### 2. Transmisión segura
- [ ] Todas las peticiones al endpoint `/api/validate` viajan sobre HTTPS (garantizado en Vercel production).
- [ ] El `ANTHROPIC_API_KEY` se lee únicamente desde variables de entorno (`process.env`), nunca hardcodeado ni expuesto en el cliente.
- [ ] Los campos sensibles (número de documento, fechas, nombres) no aparecen en los logs de consola de producción.

### 3. Validación de entrada
- [ ] El tipo MIME se valida contra la lista blanca `["image/jpeg", "image/png", "image/webp"]` antes de cualquier procesamiento.
- [ ] El tamaño del archivo se limita a 5 MB en el servidor (no solo en el cliente).
- [ ] El campo `type` se restringe a los valores `"dni"` o `"acta"` antes de usarse para seleccionar el prompt.

### 4. Superficie de ataque de la API
- [ ] El endpoint devuelve errores genéricos hacia el cliente (sin stack traces ni detalles internos).
- [ ] Los errores de autenticación de Anthropic se traducen a `502` sin exponer el motivo exacto al frontend.
- [ ] El JSON devuelto por Claude se parsea con `JSON.parse` sobre el texto limpio; no se ejecuta (`eval`) ni se inyecta en el DOM directamente.

### 5. Dependencias
- [ ] `@anthropic-ai/sdk` está fijado a una versión semántica (`^0.x.x`) en `package.json`.
- [ ] No existen dependencias de Gemini activas en el árbol de producción (`@google/generative-ai` puede ser eliminada si ya no se usa).
- [ ] Ejecutar `npm audit` antes de cada release y resolver vulnerabilidades críticas/altas.

## Procedimiento de auditoría

1. Leer `app/api/validate/route.ts` y verificar que el buffer se descarta al salir del scope de `POST`.
2. Confirmar que ningún middleware o framework de logging captura el body de la petición (Next.js no lo hace por defecto).
3. Revisar `lib/anthropic/client.ts` para asegurar que la instancia de `Anthropic` no loguea el API key.
4. Verificar que las variables de entorno en Vercel (`ANTHROPIC_API_KEY`) están marcadas como **secretas** y no se exponen en el dashboard de preview deployments.
5. Ejecutar `npm audit --audit-level=high` y adjuntar el resultado al PR de release.

## Estado actual

| Control | Estado | Notas |
|---------|--------|-------|
| Procesamiento en memoria | ✅ Cumple | `arrayBuffer()` → `base64` sin persistencia |
| Validación de tipo MIME | ✅ Cumple | Lista blanca en servidor y cliente |
| Límite de tamaño | ✅ Cumple | 5 MB en `route.ts` |
| API key por env var | ✅ Cumple | `process.env.ANTHROPIC_API_KEY` |
| Errores genéricos al cliente | ✅ Cumple | Solo mensajes amigables en el JSON |
| Sin dependencias Gemini activas | ✅ Cumple | `lib/gemini/` eliminado |
| `npm audit` | ✅ Ejecutado | 2 vulnerabilidades **moderadas** en postcss (dep. transitiva de Next.js). Sin fix no-breaking disponible; no hay vulnerabilidades altas ni críticas. |
