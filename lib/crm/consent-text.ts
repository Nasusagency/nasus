/**
 * Textos EXACTOS de los permisos de contacto. Los usa el formulario (para
 * mostrarlos) y el servidor (para guardarlos en crm_consents como prueba de qué
 * aceptó la persona). Al vivir en un solo lugar no pueden desalinearse.
 */
export type ConsentChannel = "email" | "whatsapp";

export const CONSENT_TEXT: Record<ConsentChannel, string> = {
  email: "Quiero recibir por correo novedades y casos de Nasus. Puedo darme de baja cuando quiera.",
  whatsapp: "Acepto que Nasus me envíe novedades por WhatsApp al número que registré. Puedo pedir la baja cuando quiera.",
};
