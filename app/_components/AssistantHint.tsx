"use client";

import { useCallback, useSyncExternalStore } from "react";

import { ASSISTANT_BUTTON_ID, haySoporteDeDictado } from "./assistant-support";

// El soporte del navegador es estado externo: se lee con useSyncExternalStore
// para no provocar un mismatch de hidratación ni un setState dentro de un efecto.
const noSuscribir = () => () => {};
// En servidor devolvemos false: preferimos que la invitación aparezca tras
// hidratar antes que ofrecer algo que el navegador no puede ejecutar.
const soporteEnServidor = () => false;

/**
 * Invitación discreta del hero hacia el asistente de voz.
 *
 * Solo aparece si el navegador soporta dictado, que es la misma condición bajo
 * la que VoiceAssistant se renderiza.
 */
export default function AssistantHint() {
  const soportado = useSyncExternalStore(
    noSuscribir,
    haySoporteDeDictado,
    soporteEnServidor,
  );

  const activar = useCallback(() => {
    const boton = document.getElementById(ASSISTANT_BUTTON_ID);
    boton?.focus();
    boton?.click();
  }, []);

  if (!soportado) return null;

  return (
    <button
      type="button"
      onClick={activar}
      className="group mx-auto flex items-center gap-2 font-mono text-[11px] sm:text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
    >
      <span>Esta página también tiene IA.</span>
      <span className="text-[#00f2ff] group-hover:underline underline-offset-4">
        Pruébala ↙
      </span>
    </button>
  );
}
