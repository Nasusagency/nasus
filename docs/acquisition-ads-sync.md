# Acquisition: métricas externas (fase futura)

El MVP separa métricas propias (`page_view`, `whatsapp_click`, conversaciones y stages de leads) de métricas publicitarias externas. Impresiones, clics de anuncio, spend, CPC y CTR se muestran como **Sincronización no configurada** hasta contar con una API oficial y credenciales server-side.

La tabla `acquisition_campaign_metrics` es la capa común. La captura del admin escribe `source_type=manual`; una integración futura debe implementar un adaptador server-side por proveedor (Google Ads o ChatGPT Ads) que escriba métricas diarias en esa misma tabla con `source_type=synced`. No se deben estimar valores, hacer scraping ni exponer credenciales al navegador. Los campos desconocidos permanecen `NULL`; un cero se reserva para un cero real reportado por la plataforma.
