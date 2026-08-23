# Sincronización de adquisición publicitaria

## Arquitectura

`acquisition_campaign_metrics` es la capa común para métricas externas. La captura del admin escribe filas `manual`; Google Ads escribe filas `synced`. Para cada combinación de plataforma, campaña y fecha, reporting elige `synced` cuando existe y usa `manual` sólo como fallback. Las filas manuales nunca se borran ni se sobrescriben.

`acquisition_ads_sync_status` conserva por fuente el último intento, la última sincronización exitosa y el estado (`pending`, `synced` o `error`). El admin presenta estas fechas con `America/Mexico_City`; un error nuevo no borra la fecha del último éxito.

El flujo automático es:

1. Vercel Cron llama `GET /api/internal/google-ads/sync` con `Authorization: Bearer CRON_SECRET`.
2. El endpoint valida el secreto, obtiene OAuth mediante la service account y scope `https://www.googleapis.com/auth/adwords`.
3. Consulta `GoogleAdsService.SearchStream` por los últimos tres días y obtiene la moneda de la cuenta.
4. Convierte `cost_micros / 1_000_000` y hace upsert con `platform=google` y `source_type=synced`.
5. El dashboard combina esas filas con eventos y leads owned.

También puede ejecutarse manualmente con el botón discreto **Sincronizar Google Ads** dentro del admin. Esa llamada reutiliza la cookie JWT admin.

## Variables

Obligatorias en Vercel:

```text
GOOGLE_ADS_DEVELOPER_TOKEN
GOOGLE_ADS_LOGIN_CUSTOMER_ID
GOOGLE_ADS_CUSTOMER_ID
GOOGLE_ADS_SERVICE_ACCOUNT_JSON
CRON_SECRET
```

Los customer IDs pueden incluir guiones en configuración; el módulo los elimina antes de llamar a Google. `GOOGLE_ADS_SERVICE_ACCOUNT_JSON` contiene el JSON completo como string y nunca debe usar prefijo `NEXT_PUBLIC_`.

Mapping opcional, no secreto:

```text
GOOGLE_ADS_CAMPAIGN_MAP={"123456789":"nasus_mundo_test"}
```

La clave es `campaign.id` y el valor es el `utm_campaign` usado por Nasus. Sin mapping se usa `campaign.name`, por lo que debe coincidir exactamente con `utm_campaign` para unir métricas externas y owned.

## Consulta y frecuencia

La consulta diaria usa campos de campaña, `segments.date`, impresiones, clics y costo en micros. Las fechas se generan internamente y se validan antes de construir GAQL; no se interpola texto libre.

El cron corre a `09:15 UTC`, equivalente a las `03:15` de `America/Mexico_City` con la zona vigente del proyecto. Reprocesa tres días —incluido el actual— porque Google puede ajustar reportes recientes. El unique existente `(platform, campaign, metric_date, source_type)` mantiene la operación idempotente.

Referencias oficiales: [autenticación y headers](https://developers.google.com/google-ads/api/rest/auth), [SearchStream REST](https://developers.google.com/google-ads/api/rest/common/search) y [service accounts](https://developers.google.com/google-ads/api/docs/oauth/service-accounts).

## Ejecución y diagnóstico

Desde el admin, usar **Sincronizar Google Ads**. La respuesta visible sólo contiene el número de filas; nunca tokens o detalles de la credencial.

Smoke test local de sólo lectura:

```bash
npm run google-ads:smoke
```

Consulta como máximo tres días y muestra campaña, fecha, impresiones, clics y gasto. Si no existen variables locales, termina correctamente como omitido. No escribe en Supabase.

Errores controlados:

- `not_configured`: falta una variable o el mapping opcional es JSON inválido.
- `invalid_credentials`: JSON inválido, llave inválida o token OAuth no obtenido.
- `permission_denied`: la service account no tiene acceso a la cuenta/MCC.
- `invalid_customer`: customer ID incorrecto.
- `api_not_enabled`: Google Ads API no habilitada en el proyecto.
- `rate_limited`: cuota temporal de Google.
- `timeout`: Google no respondió en 25 segundos.

Para revocar acceso, quitar el correo de la service account en **Google Ads → Admin → Access and security**, deshabilitar o eliminar la clave en Google Cloud IAM y reemplazar/eliminar `GOOGLE_ADS_SERVICE_ACCOUNT_JSON` en Vercel. Si el developer token se comprometió, revocarlo desde el API Center del MCC.

## ChatGPT Ads

Al 22 de agosto de 2026, la referencia pública oficial de OpenAI no documenta endpoints de Ads Manager para campañas ni reporting de `impressions`, `clicks`, `spend`, `CTR`, `CPC` o `CPM`. La API de Usage/Costs documentada corresponde al consumo de modelos de OpenAI, no a gasto publicitario. Por eso `OPENAI_ADS_API_KEY` no se consume todavía y no existe cron ni botón de sincronización ChatGPT Ads.

La fuente `chatgpt` queda preparada en la misma capa: captura `manual`, prioridad futura de filas `synced`, columna `synced_at` y estado inicial `pending`. Para activar sincronización faltan documentación oficial del endpoint, autenticación/alcances, identificador de cuenta, esquema de respuesta, paginación, unidades monetarias y semántica de zona horaria/fechas.

ChatGPT Ads permanece fuera de alcance.
