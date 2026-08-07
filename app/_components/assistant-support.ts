/**
 * Pequeñas piezas compartidas entre el asistente de voz y la invitación del hero.
 */

/** ID del botón flotante del asistente, para que el hero pueda dispararlo. */
export const ASSISTANT_BUTTON_ID = "nasus-assistant-button";

/** ¿El navegador expone la Web Speech API para dictado? */
export function haySoporteDeDictado(): boolean {
  if (typeof window === "undefined") return false;
  const w = window as unknown as {
    SpeechRecognition?: unknown;
    webkitSpeechRecognition?: unknown;
  };
  return Boolean(w.SpeechRecognition ?? w.webkitSpeechRecognition);
}
