-- Validación de migraciones aplicadas
-- Ejecuta en Supabase SQL Editor para confirmar que todo está en lugar

-- 1. Verificar tablas
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('whatsapp_leads', 'whatsapp_requerimientos', 'whatsapp_clientes')
ORDER BY table_name;

-- 2. Verificar tipos enums
SELECT typname
FROM pg_type
WHERE typname IN ('lead_stage', 'requerimiento_tipo', 'requerimiento_prioridad', 'requerimiento_estado')
ORDER BY typname;

-- 3. Verificar índices
SELECT indexname
FROM pg_indexes
WHERE tablename IN ('whatsapp_leads', 'whatsapp_requerimientos')
ORDER BY indexname;

-- 4. Verificar columnas nuevas en whatsapp_clientes
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'whatsapp_clientes'
  AND column_name IN ('resumen_vivo', 'datos_estructurados', 'ultima_actualizacion_automatica')
ORDER BY column_name;

-- 5. Verificar RLS
SELECT schemaname, tablename, rowsecurity
FROM pg_tables
WHERE tablename IN ('whatsapp_leads', 'whatsapp_requerimientos')
ORDER BY tablename;

-- 6. CRUD Test: insertar lead de prueba
INSERT INTO public.whatsapp_leads (numero, nombre_contacto, nombre_empresa, stage, resumen)
VALUES ('5235551234', 'Test User', 'Test Company', 'exploring'::lead_stage, 'Test lead para validar migraciones')
RETURNING id, numero, stage, created_at;

-- 7. CRUD Test: insertar requerimiento de prueba
INSERT INTO public.whatsapp_requerimientos (numero_contacto, tipo, descripcion_original, estado)
VALUES ('5235551234', 'consulta'::requerimiento_tipo, 'Test requerimiento', 'abierto'::requerimiento_estado)
RETURNING id, numero_contacto, tipo, estado, created_at;

-- 8. Limpiar datos de prueba
DELETE FROM public.whatsapp_leads WHERE numero = '5235551234';
DELETE FROM public.whatsapp_requerimientos WHERE numero_contacto = '5235551234';

SELECT 'Validación completada correctamente' as resultado;
