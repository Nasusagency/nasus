# API de Validación UAG — Nasus Agency

Endpoint de integración para la validación automatizada de documentos del proceso de admisión UAG.

**Base URL:** `https://nasus.lat`  
**Contacto:** nasusagency@gmail.com

---

## Autenticación

Todas las solicitudes deben incluir el header `X-API-KEY` con la clave proporcionada por Nasus Agency.

```
X-API-KEY: nasus-uag-2026-xxxx-xxxx-xxxx-xxxx
```

Si la clave es incorrecta o está ausente, la API devuelve `401` sin detalles adicionales.

---

## Endpoint

### `POST /api/uag/validate`

Valida un documento y devuelve un resultado estructurado listo para el asesor.

#### Límites
- **Rate limit:** 100 solicitudes por minuto por API key
- **Tamaño máximo:** 15 MB por imagen
- **Timeout:** 30 segundos
- **Formatos aceptados:** JPEG, PNG, WEBP, PDF

---

## Request

El cuerpo debe ser JSON. Acepta dos formatos de imagen:

### Formato 1 — Base64

```json
{
  "documento_tipo": "fotografia",
  "imagen": "data:image/jpeg;base64,/9j/4AAQSkZJRgAB...",
  "solicitud_id": "96891",
  "alumno_nombre": "LUIS OSCAR ALPIZAR ESTRADA"
}
```

O sin prefijo data URI:

```json
{
  "documento_tipo": "ine",
  "imagen": "/9j/4AAQSkZJRgABAQEASABIAAD...",
  "solicitud_id": "96891"
}
```

### Formato 2 — URL pública HTTPS

```json
{
  "documento_tipo": "certificado_licenciatura",
  "imagen_url": "https://storage.ejemplo.com/docs/cert-96891.pdf",
  "solicitud_id": "96891",
  "alumno_nombre": "LUIS OSCAR ALPIZAR ESTRADA"
}
```

### Campos del request

| Campo | Tipo | Requerido | Descripción |
|---|---|---|---|
| `documento_tipo` | string | ✅ | Tipo de documento (ver lista abajo) |
| `imagen` | string | ✅* | Imagen en base64 o data URI |
| `imagen_url` | string | ✅* | URL pública HTTPS de la imagen |
| `solicitud_id` | string | ✅ | ID único de la solicitud del alumno |
| `alumno_nombre` | string | ❌ | Nombre del alumno para cruce de datos |

*Se requiere `imagen` o `imagen_url`, no ambos.

### Tipos de documento (`documento_tipo`)

| Valor | Descripción |
|---|---|
| `certificado_licenciatura` | Certificado oficial de conclusión de licenciatura |
| `acta_nacimiento` | Acta del Registro Civil mexicano |
| `constancia_certificado` | Constancia de validación oficial SEP |
| `fotografia` | Fotografía para expediente UAG |
| `carta_compromiso` | Carta de compromiso firmada |
| `ine` | Credencial para votar (INE/IFE) |
| `curp` | Clave Única de Registro de Población |
| `rfc` | Registro Federal de Contribuyentes |

---

## Response

Siempre en formato JSON, independientemente del resultado:

```json
{
  "solicitud_id": "96891",
  "documento_tipo": "fotografia",
  "valido": true,
  "confianza": "alta",
  "recomendacion": "Fotografía aceptada. Cumple todos los requisitos UAG. Puede proceder.",
  "campos_extraidos": {
    "veredicto": "APTA",
    "reglas_fallidas": null
  },
  "issues": [],
  "requiere_revision_humana": false,
  "timestamp": "2026-05-02T12:00:00.000Z",
  "version": "1.0"
}
```

### Campos del response

| Campo | Tipo | Descripción |
|---|---|---|
| `solicitud_id` | string | Mismo ID enviado en el request |
| `documento_tipo` | string | Tipo de documento validado |
| `valido` | boolean | `true` si el documento es válido |
| `confianza` | `"alta" \| "media" \| "baja"` | Nivel de confianza del análisis |
| `recomendacion` | string | Texto en lenguaje natural para el asesor |
| `campos_extraidos` | object | Datos extraídos del documento |
| `issues` | string[] | Lista de problemas encontrados (vacía si válido) |
| `requiere_revision_humana` | boolean | `true` si se recomienda revisión manual |
| `timestamp` | string | ISO 8601 del momento de validación |
| `version` | `"1.0"` | Versión del API |

### Niveles de confianza

- **`alta`**: El documento es válido y todos los campos fueron extraídos correctamente.
- **`media`**: El documento fue analizado pero tiene problemas menores o es inválido con causa clara.
- **`baja`**: La calidad de imagen es insuficiente o muchos campos son ilegibles. `requiere_revision_humana` siempre es `true`.

---

## Ejemplos por tipo de documento

### certificado_licenciatura — Válido

**Request:**
```json
{
  "documento_tipo": "certificado_licenciatura",
  "imagen": "data:application/pdf;base64,...",
  "solicitud_id": "96891",
  "alumno_nombre": "MARIA GUADALUPE TORRES REYES"
}
```

**Response:**
```json
{
  "solicitud_id": "96891",
  "documento_tipo": "certificado_licenciatura",
  "valido": true,
  "confianza": "alta",
  "recomendacion": "Certificado de licenciatura válido. Institución: Universidad de Guadalajara. El nombre coincide con el expediente. Puede proceder.",
  "campos_extraidos": {
    "nombre_completo": "MARIA GUADALUPE TORRES REYES",
    "institucion": "Universidad de Guadalajara",
    "cct": "14PSU0001Z",
    "carrera": "Licenciatura en Administración",
    "fecha_egreso": "2025-06-15",
    "promedio": "8.90",
    "firmante": "Dr. Ricardo Villanueva Lomelí, Rector",
    "tipo_detectado": "certificado"
  },
  "issues": [],
  "requiere_revision_humana": false,
  "timestamp": "2026-05-02T12:00:00.000Z",
  "version": "1.0"
}
```

### certificado_licenciatura — Kardex rechazado

**Response:**
```json
{
  "solicitud_id": "96892",
  "documento_tipo": "certificado_licenciatura",
  "valido": false,
  "confianza": "alta",
  "recomendacion": "El documento adjunto es un kardex, no un certificado oficial. Solicitar el certificado de licenciatura con sello oficial.",
  "campos_extraidos": {
    "nombre_completo": "CARLOS MENDEZ LUNA",
    "institucion": "ITESO",
    "cct": null,
    "carrera": "Ingeniería en Sistemas",
    "fecha_egreso": null,
    "promedio": null,
    "firmante": null,
    "tipo_detectado": "kardex"
  },
  "issues": ["Se requiere certificado oficial, no historial académico"],
  "requiere_revision_humana": false,
  "timestamp": "2026-05-02T12:01:00.000Z",
  "version": "1.0"
}
```

### fotografia — Rechazada

**Request:**
```json
{
  "documento_tipo": "fotografia",
  "imagen": "data:image/jpeg;base64,...",
  "solicitud_id": "96893"
}
```

**Response:**
```json
{
  "solicitud_id": "96893",
  "documento_tipo": "fotografia",
  "valido": false,
  "confianza": "media",
  "recomendacion": "La fotografía fue rechazada. El alumno usa lentes y el fondo no es blanco. Solicitar nueva fotografía cumpliendo los requisitos UAG.",
  "campos_extraidos": {
    "veredicto": "NO_APTA",
    "reglas_fallidas": ["Sin lentes", "Fondo blanco o neutro"]
  },
  "issues": [
    "Se detectaron lentes. Los requisitos UAG no permiten lentes de ningún tipo.",
    "El fondo no es blanco o neutro como requieren los lineamientos."
  ],
  "requiere_revision_humana": false,
  "timestamp": "2026-05-02T12:02:00.000Z",
  "version": "1.0"
}
```

### carta_compromiso — No firmada

**Response:**
```json
{
  "solicitud_id": "96894",
  "documento_tipo": "carta_compromiso",
  "valido": false,
  "confianza": "alta",
  "recomendacion": "Carta de compromiso rechazada. La carta de compromiso no está firmada. Solicitar al alumno que firme la carta antes de continuar.",
  "campos_extraidos": {
    "nombre_firmante": null,
    "fecha_firma": null,
    "tipo_firma": "ausente"
  },
  "issues": ["La carta de compromiso no está firmada"],
  "requiere_revision_humana": false,
  "timestamp": "2026-05-02T12:03:00.000Z",
  "version": "1.0"
}
```

### acta_nacimiento — Revisión humana recomendada

**Response:**
```json
{
  "solicitud_id": "96895",
  "documento_tipo": "acta_nacimiento",
  "valido": true,
  "confianza": "baja",
  "recomendacion": "El documento parece válido pero la calidad de imagen es baja o hay datos ilegibles. Se recomienda revisión manual antes de proceder.",
  "campos_extraidos": {
    "tipo_acta": "nacimiento",
    "numero_acta": null,
    "fecha_emision": null,
    "entidad_emisora": "Registro Civil",
    "nombres_involucrados": [],
    "nombre_registrado": null,
    "fecha_nacimiento": null,
    "nombre_madre": null,
    "nombre_padre": null,
    "curp": null,
    "folio_renasp": null,
    "formato": null
  },
  "issues": ["Calidad de imagen insuficiente — sube una foto con mejor iluminación y enfoque."],
  "requiere_revision_humana": true,
  "timestamp": "2026-05-02T12:04:00.000Z",
  "version": "1.0"
}
```

---

## Códigos de error

| Código | Descripción |
|---|---|
| `200` | Validación completada correctamente |
| `400` | Request inválido (campo faltante, tipo no soportado, URL inválida) |
| `401` | API key ausente o incorrecta |
| `413` | Imagen supera el límite de 15 MB |
| `415` | Formato de imagen no soportado |
| `422` | No se pudo obtener la imagen o el modelo no pudo interpretarla |
| `429` | Límite de solicitudes alcanzado (100/min por API key) |
| `500` | Error interno |
| `502` | Error de comunicación con el servicio de IA |

Los errores devuelven JSON con campo `error`:

```json
{
  "error": "Descripción del error en español."
}
```

La respuesta `401` devuelve `{}` sin detalles por seguridad.

---

## Seguridad

- Las imágenes se procesan en memoria y **no se almacenan** en ningún servidor.
- No se registran datos personales (PII) en los logs, solo el tipo de documento y el estado del error.
- La API key debe mantenerse confidencial y no exponerse en código frontend.
- Las URLs proporcionadas en `imagen_url` deben ser HTTPS públicas; se rechazan direcciones privadas (localhost, 192.168.x.x, 10.x.x.x, etc.).

---

## Integración rápida (ejemplo cURL)

```bash
curl -X POST https://nasus.lat/api/uag/validate \
  -H "Content-Type: application/json" \
  -H "X-API-KEY: nasus-uag-2026-xxxx-xxxx-xxxx-xxxx" \
  -d '{
    "documento_tipo": "ine",
    "imagen_url": "https://tu-sistema.uag.mx/docs/ine-96891.jpg",
    "solicitud_id": "96891",
    "alumno_nombre": "LUIS OSCAR ALPIZAR ESTRADA"
  }'
```

---

## Contacto y soporte

Para solicitar tu API key o reportar problemas:

**Nasus Agency**  
nasusagency@gmail.com  
https://nasus.lat
