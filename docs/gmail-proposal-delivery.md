# Gmail para propuestas

La entrega usa OAuth 2.0 de Google y nunca almacena contraseñas. En Google Cloud:

1. habilita Gmail API;
2. configura la pantalla de consentimiento OAuth;
3. crea un OAuth Client para la cuenta remitente;
4. autoriza `https://www.googleapis.com/auth/gmail.send` y, para **Revisar respuesta**, `https://www.googleapis.com/auth/gmail.readonly`;
5. genera un refresh token para esa misma cuenta.

Configura en el entorno del servidor:

- `GMAIL_CLIENT_ID`
- `GMAIL_CLIENT_SECRET`
- `GMAIL_REFRESH_TOKEN`
- `GMAIL_SENDER_EMAIL`
- `NEXT_PUBLIC_SITE_URL` (URL pública usada en el enlace de la propuesta)

Los tokens nunca se envían al navegador ni se escriben en logs. La lectura se limita al `thread_id` real guardado después de enviar cada propuesta; no existe sincronización global ni job periódico.
