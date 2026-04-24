# Proyecto: Validador de Documentos Oficiales Automatizado
## Rol: Arquitecto de Infraestructura IA

### 1. Contexto del Negocio
* **Agencia**: El Proyecto (Soluciones Artesanales).
* **Objetivo**: Desarrollar una herramienta que valide la integridad de documentos oficiales (DNI, actas) mediante visión artificial.
* **ROI**: Ahorrar 25 horas semanales de revisión manual.

### 2. Reglas de Construcción (Guía de Pasos)
1. **Acceso**: Usa servidores **MCP** para leer documentos directamente desde el Drive/Slack del cliente; no pidas descargas manuales.
2. **Construcción**: Prioriza la lógica en el "Taller" (Local) antes de sugerir cualquier despliegue.
3. **Validación**: Antes de considerar una tarea terminada, invoca al **Agente de Seguridad** (`.cloud/agents/security.md`) para auditar la privacidad de los documentos procesados.
4. **Higiene de Datos**: Todos los textos extraídos deben ser normalizados y validados contra los formatos oficiales del país correspondiente.

### 3. Stack Tecnológico
* **Frontend**: Next.js 14 (App Router) + Tailwind CSS.
* **Backend**: Supabase (Auth & Database).
* **IA**: Gemini Vision API (OCR y análisis visual).
* **Despliegue**: Vercel (Configuración de variables de entorno segura).

### 4. Instrucción Crítica de Seguridad
* **No almacenar datos sensibles**: Los documentos deben procesarse en memoria. No deben persistir en bases de datos a menos que el cliente lo autorice explícitamente.
