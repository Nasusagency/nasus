/**
 * Pequeñas piezas compartidas entre el asistente de voz y la invitación del hero.
 */

/** ID del botón flotante del asistente, para que el hero pueda dispararlo. */
export const ASSISTANT_BUTTON_ID = "nasus-assistant-button";

/**
 * ¿Se puede mostrar el asistente? Misma condición con la que VoiceAssistant se
 * renderiza: voz en vivo (WebRTC) o, de respaldo, el dictado del navegador.
 */
export function hayAsistente(): boolean {
  if (typeof window === "undefined") return false;
  return typeof RTCPeerConnection !== "undefined" || haySoporteDeDictado();
}

/** ¿El navegador expone la Web Speech API para dictado? */
export function haySoporteDeDictado(): boolean {
  if (typeof window === "undefined") return false;
  const w = window as unknown as {
    SpeechRecognition?: unknown;
    webkitSpeechRecognition?: unknown;
  };
  return Boolean(w.SpeechRecognition ?? w.webkitSpeechRecognition);
}
