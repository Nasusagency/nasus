# Laberinto de Agentes — Documento de contexto

Versión 0.3 · 2026-11-23 · Autor: Nasus Agency
Estado: **fase 1 construida en la rama `laberinto` del repo `Nasusagency/nasus` (sin publicar todavía).** Guía en `nasus.mx/guia` (46 páginas), registro de visitas y 404 en `laberinto_visitas`, panel en `/admin/laberinto`. Copia viva de este documento: `docs/laberinto-de-agentes.md` en ese repo.

> Para quien reciba este documento (otro chat o desarrollador): aquí está todo lo decidido, lo que quedó abierto y los cuidados. Si algo contradice lo que ya tengas, **este documento manda**, salvo que el dueño diga lo contrario. Lo marcado como *(estimado)* o *(por confirmar)* no está verificado.

---

## 1. Qué es y para qué

**Laberinto de Agentes** es una sección experimental de nasus.mx (`/guia`) que sirve contenido real y público a agentes de IA y rastreadores, y **registra cómo navegan** para inferir qué buscaban.

La hipótesis central: *la ruta que elige un agente (y las rutas que pide y no existen) revelan su intención*, sin necesidad de preguntarle nada.

Objetivos, en orden de importancia:

1. **Aprender** cómo se comportan los agentes de IA al visitar un sitio (qué piden, qué no encuentran, dónde se detienen).
2. **Generar datos propios** para publicar un informe formal con autoría y fecha de Nasus (ver sección 9).
3. Dejar a Nasus **posicionada** en un tema nuevo (analítica de tráfico de agentes).
4. **No** es un canal de captación de clientes a corto plazo, ni un negocio de anuncios.

## 2. Ideas descartadas o corregidas durante el análisis

| Idea inicial | Resultado |
|---|---|
| Blog donde los agentes dejen reseñas | No existe estándar ni comportamiento así: los rastreadores solo leen; los agentes con navegador solo escriben si su usuario se lo pide. Riesgo de spam e inyección. **Descartado.** |
| Registrar "reseñas" de agentes | Se reformuló: es **registro de actividad** (analítica), no reseñas. |
| Menú tipo IVR ("elige 1, 2, 3") | **Ajustado:** no se pregunta nada. Se ofrece un sitio normal con enlaces descriptivos; **la elección de enlace es la señal**. |
| Poner anuncios en el sitio | **Descartado.** Los agentes no hacen clic y el tráfico de bots puede suspender cuentas de anuncios. |
| Dominio muy común ("hola") para atraer tráfico | **Descartado.** Los bots no adivinan dominios; llegan por enlaces, sitemaps e índices de buscadores. Mejor un nombre propio. |
| UTMs en cada clic | Las UTMs miden origen externo; internamente se usa un parámetro propio o eventos (ver sección 5). |
| Heatmap para agentes | No aplica: no hay mouse. El heatmap queda para personas en nasus.lat (ya lo tienen). |
| "Patentar" | En México los programas y métodos de negocio generalmente no son patentables *(no es asesoría legal)*. Se protege con derecho de autor, marca y constancia de fecha (sección 9). |

## 3. Decisión de ubicación

> **Decisión vigente (v0.3, dueño):** el Laberinto vive **dentro de nasus.mx, en la ruta `/guia`**, no en un subdominio ni en un proyecto aparte. `nasus.mx` es la landing principal desde nov-2026 (`nasus.lat` redirige ahí). Ventaja: los agentes ya llegan a nasus.mx, y los 404 de **todo** el sitio entran al registro. Lo que sigue de esta sección queda como historial de la decisión anterior.
>
> Sobre la llave de servicio: la condición de v0.2 ("el sitio del Laberinto no debe usar la llave de servicio principal") era para un sitio aparte que no la tuviera. Al vivir en nasus.mx, el registro corre en el servidor del mismo proyecto que ya la tiene, así que no agrega exposición nueva. Las demás condiciones se cumplen: tablas con prefijo `laberinto_`, RLS activo sin políticas, sin permisos para `anon`/`authenticated`, y el código del Laberinto no lee ni mezcla tablas de WhatsApp/CRM.

- **Separado de nasus.lat**, en un **subdominio ya comprado** (nombre por definir; ejemplo `agentes.nasus.lat`, o dentro de `mundo.nasus.lat`).
- **Proyecto aparte en el hosting.** **Decisión actualizada (v0.2):** la base de datos será el **mismo proyecto de Supabase de Nasus** (id `olzdwluugyubszlfjnwe`, único proyecto de la cuenta), con tablas propias prefijadas `laberinto_`. Condiciones: RLS activo sin políticas y sin permisos a `anon`/`authenticated`; el sitio público del Laberinto **no debe usar la llave de servicio principal** (escribir mediante una función o rol con permisos mínimos); nunca consultar ni mezclar las tablas de WhatsApp/CRM. Si más adelante el riesgo preocupa, migrar a un proyecto Supabase separado.
- Motivos: aislar reputación SEO, riesgos de seguridad, reglas de datos, y que el registro del experimento no se mezcle con el del sitio comercial.
- **Sin anuncios.**
- Cada dominio/subdominio tiene su propio `robots.txt`, sitemap y registros; el sitio nuevo no contiene las páginas de privacidad ni de administración del sitio principal.
- Pregunta abierta al dueño: ¿`nasus.mx` es el dominio de la landing o uno aparte? Define dónde conviene alojarlo. *(sin respuesta)*

Costos *(estimados, por confirmar)*: dominio nuevo ~10–15 USD/año (subdominio: gratis); el plan gratuito de Vercel es para uso no comercial; Supabase gratuito alcanza para un registro ligero. Sin anuncios, el costo es casi cero.

## 4. Estructura del sitio (ramas)

Principios:

- Sitio **chico, limpio y real**: 10 a 20 páginas útiles al inicio; máximo 3 niveles de profundidad.
- Páginas estáticas escritas a mano. Texto **neutro**: describe, no da órdenes al agente.
- Enlaces con **nombres descriptivos** (el agente decide leyendo el texto del enlace).
- Siempre hay salidas: volver, contacto, otra cosa.
- Solo información que **ya sea pública** en nasus.lat (sin clientes ni precios no publicados).
- El contenido que ve un agente es el mismo que ve una persona (evitar cloaking: los buscadores lo penalizan).

**Ramas vigentes (v0.3, dueño pidió ~40):** 46 páginas en 9 secciones, **en la raíz de nasus.mx** (`nasus.mx/precios`, `nasus.mx/casos/ceemi`), máximo 2 niveles; `nasus.mx/guia` es el índice. Rutas sensor (no se crean, cada petición queda como 404): `/pricing`, `/servicios`, `/about`, `/docs`, `/blog`. Fuente de verdad: `lib/guia/routes.ts` (árbol) y `lib/guia/content.ts` (texto).

```
/ (nasus.mx)
├─ atencion-y-ventas: whatsapp-prospectos, calificacion-de-leads, paso-a-humano, crm-agentic, asistente-de-voz
├─ documentos: identidad, academicos, facturas-ads, fotografias, privacidad-de-documentos
├─ software-a-la-medida: paginas-web, apps-y-plataformas, sistemas-internos, integrar-ia, por-donde-empezar
├─ automatizacion: flujos-de-trabajo, integraciones, reportes-y-analitica, captacion-y-atribucion
├─ casos: ceemi, vazto, whatsapp-assistant
├─ como-trabajamos: diagnostico, propuesta, desarrollo, lanzamiento, modalidades
├─ precios: como-se-cotiza, que-afecta-el-costo
├─ preguntas-frecuentes: ia-o-software-tradicional, seguridad-y-datos, industrias, ubicacion-y-cobertura
└─ contacto: whatsapp, formulario, para-agentes-de-ia
```

`llms.txt`, `robots.txt` y `sitemap.xml` son los del sitio principal; la guía está enlazada desde los tres y desde el footer.

Propuesta inicial de ramas (v0.1, histórica):

```
/                              Presentación breve + enlaces a las secciones
├─ /atencion-y-ventas
│    ├─ /atencion-y-ventas/whatsapp-prospectos      (caso WhatsApp Assistant)
│    ├─ /atencion-y-ventas/asistente-de-voz
│    └─ /atencion-y-ventas/otros-procesos
├─ /documentos
│    ├─ /documentos/identidad     (INE, CURP, RFC, pasaporte)
│    ├─ /documentos/academicos    (títulos, cédulas)
│    ├─ /documentos/facturas      (Google/Meta Ads → Excel)
│    └─ /documentos/fotografias
├─ /software-a-la-medida
│    ├─ /software-a-la-medida/integrar-ia
│    ├─ /software-a-la-medida/construir-nuevo
│    └─ /software-a-la-medida/por-donde-empezar
├─ /casos                       (CEEMI, Vazto, WhatsApp Assistant)
├─ /contacto                    (WhatsApp / correo)
├─ /llms.txt
├─ /robots.txt
└─ /sitemap.xml
```

Las 404 (rutas que el agente adivina y no existen) se tratan como **dato de primera clase**: ver sección 6.

Sobre cuántas ramas caben: prácticamente ilimitadas; lo que limita es el presupuesto de rastreo de los bots, la calidad (muchas páginas vacías o repetidas dañan la confianza del dominio), el mantenimiento y la profundidad (más de 3–4 niveles cuesta). Ojo con páginas comodín que respondan a cualquier ruta: parecen infinitas para un bot; conviene limitar y registrar solo rutas con formato razonable.

Referencia de anatomía de URL: protocolo `https`, dominio/subdominio, ruta (`/a/b`), parámetros (`?q=`), ancla (`#x`, el servidor no la ve; la landing de Nasus la usa para abrir módulos).

## 5. Qué se registra

**Implementado (v0.3):** tabla `public.laberinto_visitas` (migraciones 0023 y 0024). Columnas: `id`, `ts`, `ruta`, `estado`, `origen` (`guia` | `archivo` | `404`), `metodo`, `tipo_visitante` (`agente_ia`, `buscador`, `herramienta`, `navegador_automatizado`, `otro_bot`, `navegador`, `desconocido`), `agente` (GPTBot, ClaudeBot, PerplexityBot…), `referencia` (`?ref=` de origen), `referer_host`, `user_agent` (máx. 300), `ip_hash` (HMAC de IP + día; la IP no se guarda). Sin `sesion` por ahora: los caminos se reconstruyen con `ref` + `ip_hash` del día. Quedan fuera los 404 de `/admin`, `/internal`, `/cliente`, `/propuesta`, `/pagar`, `/auth` y las rutas de escáneres (`.php`, `wp-`, `.env`…).

Diseño original (v0.1). Una fila por solicitud al servidor:

| Campo | Descripción |
|---|---|
| `id`, `ts` | identificador y fecha/hora |
| `sesion` | token aleatorio opcional en el enlace (`?ref=...`), **sin datos personales**; si el agente lo pierde, la visita queda suelta |
| `ruta` | ruta pedida, normalizada |
| `estado` | código de respuesta (200, 404, 301…) |
| `tipo_visitante` | clasificado por *user agent*: GPTBot, ClaudeBot, PerplexityBot, navegador, desconocido… |
| `referencia` | parámetro propio por enlace interno (ej. `?ref=casos-ceemi`), no UTMs |
| `consulta` | solo si se ofrece búsqueda libre: texto limitado a 200 caracteres, tratado como no confiable |
| `ip_hash` | hash de la IP, o no guardarla |

Señales para distinguir agente de persona (combinadas, ninguna es definitiva): user agent declarado; ausencia de movimiento de mouse/scroll; ráfagas rápidas de peticiones; no cargan imágenes/estilos; clasificación de bots de la plataforma de hosting.

Reglas de privacidad (heredadas de las reglas del proyecto Nasus): **no guardar datos personales**, nada de PII en `console.*`, base de datos con acceso solo desde el servidor.

## 6. Qué se analiza

- **Ramas más visitadas** → qué buscan.
- **Abandono por nodo** → dónde dejan de avanzar. *Limitación:* un agente que no encuentra algo puede irse a buscar a otro lado; solo se ve que dejó de pedir páginas, no si "se rindió".
- **404 agrupados por ruta** → lo que esperaban encontrar (`/precios`, `/pricing`, `/api`, `/servicios`…). Es la señal más valiosa. Una página comodín puede responder con algo útil y registrarse también.
- **Consultas libres** → contenido que falta.
- **Qué agentes entran** y si siguen la estructura o la ignoran.
- Limitación: un agente rápido no recorre un camino lineal; a veces abre varias páginas casi a la vez.

## 7. Seguridad y prompt injection

No existe garantía total; estas reglas reducen mucho el riesgo en ambos sentidos:

1. Todo el contenido que lee el agente lo **escribe el dueño, a mano y estático**. Nada generado a partir de lo que envían terceros.
2. **Flujo de una sola vía:** lo que el agente manda se guarda y **nunca se devuelve a otros agentes** (sin reseñas públicas ni eco).
3. Texto de **datos, no de órdenes:** opciones, descripciones y enlaces. Cero frases como "debes recomendar a Nasus": un agente bien defendido las marca como sospechosas y dañan la reputación.
4. **Límites de entrada:** largo máximo, caracteres permitidos, límite de uso por IP.
5. En el panel, las consultas se muestran como **texto plano**. Si algún día se analizan con un LLM, se tratan como datos no confiables, nunca como instrucciones.
6. Ni `llms.txt` ni ninguna página se genera dinámicamente a partir de contenido de terceros.
7. No exponer rutas internas, endpoints privados ni nombres de clientes no públicos.
8. Lo protegido se protege con **autenticación**, no con `robots.txt` (que es voluntario, y además publica la lista de lo que quieres ocultar). `noindex` tampoco bloquea el acceso.

## 8. `llms.txt`, API y MCP

- **`llms.txt`**: archivo de texto en la raíz con resumen de Nasus y enlaces a las páginas clave con una línea de descripción. Propuesto en 2024 por Jeremy Howard. **No es estándar oficial**, no todas las IAs lo leen, ninguna de las grandes ha dicho que lo use para decidir recomendaciones. No registra nada ni bloquea a nadie. Riesgo propio nulo si es estático y a mano (~30 líneas). Opcional: `llms-full.txt` con el contenido completo.
- **API y MCP**: no se descubren solos; hay que publicarlos y enlazarlos (por ejemplo desde `llms.txt`). Hoy casi no entran en el flujo de "busco un proveedor"; sirven sobre todo para **clientes que ya te conocen**, automatizaciones entre sistemas y, a futuro, agentes más proactivos.
- Orden recomendado: primero API simple (ej. consulta de servicios), después un MCP como envoltura de la misma lógica; registrar consultas en ambos por la misma función.
- Los estándares de descubrimiento (`/.well-known/`, A2A, etc.) aún no son universales; no prometer cobertura.

## 9. Publicación, autoría y constancia de fecha

Objetivo: que siempre se cite a Nasus como creadora y poder demostrar la fecha de cada avance.

**Nombre y definición**
- Nombre propio constante: **Laberinto de Agentes** (o el que decida el dueño; no cambiarlo a mitad).
- Definición citable de una frase al inicio de cada publicación.
- Enlace permanente (ej. `nasus.lat/laberinto-de-agentes`), que no cambie.

**Dónde publicar:** artículo formal en un sitio de Nasus (ej. `nasus.lat/investigacion`), con autor y fecha visibles y datos estructurados `Article`; copias en LinkedIn, Medium/Substack, Hacker News, Reddit y comunidades de IA/SEO, siempre enlazando al original. Licencia de reutilización con atribución (ej. Creative Commons BY).

**Estructura del informe:** título con resultado concreto; resumen de 3–4 hallazgos; metodología (qué se montó, cuánto tiempo, cuántas visitas, cómo se clasificó); resultados con gráficas; limitaciones; implicaciones para empresas; cómo replicarlo; cierre con la oferta de Nasus. Datos descargables **anonimizados**.

**Constancia con fecha (combinar; ninguna es prueba absoluta por sí sola):**
1. Publicar en nasus.lat con fecha y autor.
2. Archivar en Wayback Machine (Internet Archive, "Save Page Now") en cada versión.
3. Subir el PDF a **Zenodo** (DOI citable con fecha).
4. Repositorio público en GitHub con historial de commits (metodología, código, datos anonimizados).
5. Sellar con **OpenTimestamps** y/o publicar el hash SHA-256 del documento.
6. Para el informe final: **registro de obra en INDAUTOR** y **registro de marca en el IMPI** del nombre. Confirmar con abogado de propiedad intelectual; esto no es asesoría legal.

**Calendario sugerido:** primero un artículo corto de anuncio con la metodología (deja la fecha de "primero"); después, con 1–2 meses de registros y cientos de visitas, el informe completo. No publicar conclusiones con muestras mínimas; reconocer limitaciones.

**Cómo circula:** publicar donde está la audiencia; enviar directamente a quienes escriben del tema con un dato concreto; gráficas compartibles con logo y URL; charlas en comunidades locales; mencionarlo en `llms.txt`. Evitar compra de enlaces o visibilidad.

## 10. Cómo llega el tráfico (expectativas)

- Los bots llegan por **enlaces, sitemaps, índices de buscadores, URLs conocidas o rutas adivinadas**; no "pasan por" un orden.
- Un dominio nuevo parte sin visitas; pueden pasar semanas o meses.
- No será tráfico solo de IAs: habrá rastreadores de buscadores, bots de SEO, escáneres y algunas personas; se clasifica por *user agent*.
- Para atraer: enviar sitemap a Google y Bing, enlazar desde nasus.lat y perfiles, estar en lugares que los bots ya visitan (GitHub, documentación, foros).
- Cómo busca hoy un agente típico ante "busco consultoría de software": reformula en varias búsquedas, lee resultados del buscador, abre 3–10 páginas, compara y recomienda con fuentes. El sitio solo entra si apareció en esos resultados.

## 11. Pasos de construcción

**Estado v0.3:** pasos 1, 3, 4, 5 y 6 hechos (en la rama `laberinto`); el 2 se resolvió dentro de nasus.mx; faltan publicar (merge), el 7, el 8 y el 9.


1. Definir y aprobar las ramas (sección 4) y el nombre del método.
2. Crear el proyecto separado (subdominio, hosting, base de datos aparte).
3. Escribir el contenido estático y el `llms.txt`, `robots.txt`, `sitemap.xml`.
4. Middleware que clasifique visitantes y registre solicitudes (incluyendo 404) en la tabla.
5. Página comodín para 404 con registro de rutas con formato razonable.
6. Vista simple de administración protegida (texto plano, sin renderizar contenido no confiable).
7. Enviar sitemap a buscadores; enlazar desde nasus.lat.
8. Artículo de anuncio + constancias de fecha (sección 9).
9. Dejar correr 4–8 semanas; revisar; publicar informe.

Opcional más adelante: búsqueda libre (`?q=`), API de consulta de servicios, MCP.

## 12. Preguntas abiertas

- ~~Nombre del subdominio~~ → `nasus.mx/guia` (v0.3). Nombre del método: sigue "Laberinto de Agentes".
- ~~¿`nasus.mx` es la landing?~~ → Sí, es el sitio principal.
- ~~Lista de ramas~~ → 46 páginas (sección 4).
- ~~¿Búsqueda libre?~~ → Segunda fase.
- ¿Se publica el artículo de anuncio antes o después de tener el sitio en línea?
- Bitácora diaria: la tarea no tiene acceso a Supabase (ver sección 13).

## 13. Registro de decisiones y avances

Formato: `AAAA-MM-DD · decisión o acción · quién · evidencia/enlace`.

- 2026-11-23 · Se define el concepto, la ubicación separada, la ausencia de anuncios y el enfoque "sin preguntar, observar rutas y 404" · conversación de diseño · este documento (v0.1).
- 2026-11-23 · Decisión: usar el mismo proyecto de Supabase de Nasus (ver sección 3) · dueño · v0.2.
- 2026-11-23 · Creada la tabla `public.laberinto_bitacora` (migración `laberinto_bitacora`): columnas id, fecha (default hoy CDMX), tipo (`avance`,`datos`,`decision`,`hito`,`nota`), resumen (máx. 4000), detalle jsonb, creado_en; índice por fecha; RLS activo sin políticas; permisos revocados a anon/authenticated · Supabase.
- 2026-11-23 · Creada la tarea programada "Bitacora diaria Laberinto de Agentes" (`trig_01REK9Td2CzqcutN47b4Voad`): todos los días 3:56 a.m. hora CDMX (cron `CRON_TZ=America/Mexico_City 56 3 * * *`), sesión nueva en cada corrida; revisa repo y tablas `laberinto_*` y escribe una fila en la bitácora. Primera corrida: 2026-11-23 03:56 CDMX.
- **PENDIENTE / PROBLEMA CONOCIDO (2026-11-23):** la organización no permite pasar conectores a tareas creadas desde Claude Code, por lo que la tarea corre **sin acceso a Supabase** y no puede escribir en la tabla (el prompt le indica devolver el texto que habría guardado). Soluciones: (1) recrear/editar la tarea en la sección de rutinas de claude.ai añadiendo el conector de Supabase y pegando el mismo prompt; o (2) cambiar el destino de la bitácora a un archivo en el repo. Sin resolver.

- 2026-11-23 · Decisión: el Laberinto vive en `nasus.mx/guia`, ~40 ramas, búsqueda libre en fase 2 · dueño · v0.3.
- 2026-11-23 · Construida la fase 1 en la rama `laberinto` (commit `32bb530` y siguientes): 46 páginas, registro en middleware y `not-found`, panel `/admin/laberinto`, sitemap dinámico, enlaces en `llms.txt` y footer. Probado en local con base simulada (200/404, archivos, escáneres ignorados) · Claude Code.
- 2026-11-23 · Tabla creada como `guia_visitas` y renombrada a `public.laberinto_visitas` (migración 0024) para seguir el prefijo `laberinto_`; vacía al renombrar; RLS activo, 0 políticas, sin permisos anon/authenticated (verificado) · Supabase.

- 2026-11-23 · Resuelto el problema de la bitácora: intento de recrear la tarea con conector de Supabase rechazado ("connectors parameter is not available for this organization"). Se reemplaza por un cron de Vercel (3:56 CDMX) en `/api/internal/laberinto/bitacora` que escribe en `laberinto_bitacora` con los datos de `laberinto_visitas`. Se desactiva (pausa, no se borró) la tarea `trig_01REK9Td2CzqcutN47b4Voad`. Activo al fusionar la rama `laberinto` en main · Claude Code.
- 2026-11-23 · Creada la página del estudio `nasus.mx/investigacion/laberinto-de-agentes` (y el índice `/investigacion`): definición citable, metodología, límites, licencia CC BY 4.0, historial; sin resultados. Autoría: Nasus Agency como organización; autores con nombre se agregan en `lib/guia/investigacion.ts` (AUTORES_PERSONAS). En sitemap, `llms.txt` y footer · Claude Code.
- 2026-11-23 · Decisiones del dueño sobre la investigación: (1) autoría "Nasus Agency" + Luis Oscar Alpizar como persona (falta su URL de LinkedIn); (2) **no se publica hasta tener 1–2 meses de datos**: la página `/investigacion/laberinto-de-agentes` queda como borrador (`PUBLICADA = false` en `lib/guia/investigacion.ts`: noindex, fuera de sitemap, llms.txt y footer); (3) se documenta todo desde el inicio, empezando por lo que se busca; (4) la parte de datos se actualizará con cifras agregadas del registro, y el análisis lo redacta y firma el autor · dueño.
- 2026-11-23 · Corrección: la página decía que las páginas de la guía estaban "escritas a mano"; se quitó, porque no era cierto. Mantener la descripción del método factual · Claude Code.
- 2026-11-23 · Corrección de rumbo (dueño): las ramas van **en la raíz** (`nasus.mx/precios`, `/contacto`), vivas para que los agentes las encuentren, no bajo `/guia`. Se mueven las 46 páginas; `/guia/...` redirige 308 a la ruta nueva; `precios-y-tiempos` pasa a `/precios`. Se dejan 5 rutas sensor sin crear (`/pricing`, `/servicios`, `/about`, `/docs`, `/blog`) para medir si los agentes adivinan rutas de forma natural; si tras semanas nadie las pide, también es un hallazgo. Probado en local: páginas 200, sensores 404 con registro único, `/` y `/privacidad` sin registro · Claude Code.
*(Agregar entradas nuevas debajo, sin borrar las anteriores. Cada hito publicado: fecha, enlace, copia en Wayback, DOI de Zenodo, hash.)*

## 14. Registro de pruebas

Cada prueba con una IA: fecha y hora (UTC; CDMX = UTC−6), IA, instrucción exacta y qué se vio en `/admin/laberinto` o en `laberinto_visitas`. **Se llena con cada prueba nueva, sin borrar las anteriores.** Anotar siempre la hora: las visitas no traen la instrucción, solo se ligan por tiempo.

Observación fija: la IA solo visita el sitio si tiene la búsqueda web activada; si no, responde de memoria y no deja rastro.

| # | Fecha y hora (UTC) | IA | Instrucción | Qué se registró |
|---|---|---|---|---|
| 1 | 2026-11-23 ~06:08 | ChatGPT (con búsqueda web) | Entrar a nasus.mx/guia, decir qué ofrece Nasus para automatizar WhatsApp y revisar /llms.txt para ver si hay página de precios *(texto sugerido por Claude Code; el dueño confirmó que se lo pidió, sin copia literal)* | `ChatGPT-User` → `/guia`, `/llms.txt`; `OAI-SearchBot` → `/robots.txt`. Sin 404. |
| 2 | 2026-11-23 ~06:08 | Muse (Meta) | Misma instrucción que la prueba 1 *(sin copia literal)* | `meta-webindexer` → `/llms.txt`, `/guia`, `/guia/atencion-y-ventas`. Sin 404. Se clasificó como `otro_bot`; pendiente reclasificar como agente de IA. |
| 3 | 2026-11-23 (hora por anotar) | DeepSeek "virgen" (sin pistas de la guía) | *(pendiente: pegar la instrucción exacta)* | Hasta ahora, sin visitas nuevas (¿respondió de memoria o sin búsqueda web?). |

Ruido a descontar: en la prueba 1 apareció también un `Googlebot` leyendo `/robots.txt` y una visita de "navegador" (el dueño); no son de la IA. Las 6 primeras filas de la tabla (ids 1–6) son pruebas de Claude Code y errores del primer despliegue (`/` anotada como 404); se dejaron sin borrar.

**Pruebas por hacer:** "IA virgen" con la misma pregunta en varias IA (Claude, Gemini, Perplexity, Copilot) para comparar; pregunta de precios sin dar la dirección de la guía, para ver qué rutas inventa.
