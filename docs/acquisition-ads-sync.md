# Acquisition: métricas externas (fase futura)

El MVP separa métricas propias (`page_view`, `whatsapp_click`, conversaciones y stages de leads) de métricas publicitarias externas. Impresiones, clics de anuncio, spend, CPC y CTR se muestran como **Sincronización no configurada** hasta contar con una API oficial y credenciales server-side.

Una integración futura debe implementar un adaptador server-side por proveedor (Google Ads o ChatGPT Ads) que entregue métricas diarias normalizadas por `provider`, `source`, `campaign`, `date`, `impressions`, `clicks` y `spend`. No se deben estimar valores, hacer scraping ni exponer credenciales al navegador. La UI actual está preparada para incorporar esos valores encima del funnel owned.
