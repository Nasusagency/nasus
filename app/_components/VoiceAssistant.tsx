"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";

const GOLD = "#c4a882";
const CYAN = "#00f2ff";
const MAX_LISTEN_MS = 30_000;

type Estado = "idle" | "listening" | "processing" | "speaking" | "error";

const ETIQUETAS: Record<Estado, string> = {
  idle: "Hablar con Nasus",
  listening: "Escuchando…",
  processing: "Procesando…",
  speaking: "Nasus responde…",
  error: "Reintentar",
};

// ─── Web Speech API (no está en las libs de TS por defecto) ───────────────────

interface SpeechRecognitionAlternative {
  transcript: string;
}
interface SpeechRecognitionResult {
  readonly length: number;
  isFinal: boolean;
  [index: number]: SpeechRecognitionAlternative;
}
interface SpeechRecognitionResultList {
  readonly length: number;
  [index: number]: SpeechRecognitionResult;
}
interface SpeechRecognitionEventLike extends Event {
  resultIndex: number;
  results: SpeechRecognitionResultList;
}
interface SpeechRecognitionErrorEventLike extends Event {
  error: string;
}
interface SpeechRecognitionLike extends EventTarget {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((e: SpeechRecognitionEventLike) => void) | null;
  onerror: ((e: SpeechRecognitionErrorEventLike) => void) | null;
  onend: (() => void) | null;
}
type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

function getRecognitionCtor(): SpeechRecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

// ─── Permiso de micrófono ─────────────────────────────────────────────────────

// getUserMedia solo existe en contextos seguros (https, localhost o 127.0.0.1).
// Servir el sitio por IP de red local (http://192.168.x.x) deja `mediaDevices`
// como undefined, lo que sin esta comprobación se confunde con permiso denegado.
function contextoInseguro(): boolean {
  if (window.isSecureContext) return false;
  return !navigator.mediaDevices?.getUserMedia;
}

// Devuelve null si el micrófono está disponible, o el mensaje de error concreto.
async function asegurarMicrofono(): Promise<string | null> {
  if (contextoInseguro()) {
    return "El micrófono necesita una conexión segura (https o localhost).";
  }
  if (!navigator.mediaDevices?.getUserMedia) {
    return "Tu navegador no permite acceder al micrófono.";
  }

  // Si el permiso ya está concedido no volvemos a abrir el stream: dejamos que
  // SpeechRecognition tome el micrófono directamente y evitamos el ciclo
  // abrir/cerrar/reabrir, que en Chrome a veces falla.
  try {
    const estado = await navigator.permissions?.query({
      name: "microphone" as PermissionName,
    });
    if (estado?.state === "granted") return null;
  } catch {
    // Permissions API no disponible o sin soporte para "microphone": seguimos.
  }

  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    stream.getTracks().forEach((t) => t.stop());
    return null;
  } catch (err) {
    const nombre = err instanceof DOMException ? err.name : "";
    switch (nombre) {
      case "NotAllowedError":
      case "SecurityError":
        return "Necesito permiso para usar tu micrófono.";
      case "NotFoundError":
      case "OverconstrainedError":
        return "No encontré ningún micrófono conectado.";
      case "NotReadableError":
        return "Otra aplicación está usando el micrófono. Ciérrala e intenta de nuevo.";
      case "AbortError":
        return "No pude abrir el micrófono. Intenta de nuevo.";
      default:
        return "No pude acceder al micrófono. Intenta de nuevo.";
    }
  }
}

// El soporte del navegador es estado externo: se lee con useSyncExternalStore
// para no provocar un mismatch de hidratación ni un setState dentro de un efecto.
const noSuscribir = () => () => {};
const leerSoporte = () => getRecognitionCtor() !== null;
const soporteEnServidor = () => true;

// ─── Componente ───────────────────────────────────────────────────────────────

export default function VoiceAssistant() {
  const [estado, setEstado] = useState<Estado>("idle");
  const [mensajeError, setMensajeError] = useState<string | null>(null);
  const [respuesta, setRespuesta] = useState<string | null>(null);
  const soportado = useSyncExternalStore(noSuscribir, leerSoporte, soporteEnServidor);

  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioUrlRef = useRef<string | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const transcriptRef = useRef("");
  const enviadoRef = useRef(false);

  const limpiarAudio = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    if (audioUrlRef.current) {
      URL.revokeObjectURL(audioUrlRef.current);
      audioUrlRef.current = null;
    }
  }, []);

  useEffect(
    () => () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      recognitionRef.current?.abort();
      limpiarAudio();
    },
    [limpiarAudio],
  );

  const fallar = useCallback((msg: string) => {
    setMensajeError(msg);
    setEstado("error");
  }, []);

  const reproducir = useCallback(
    (base64: string, mimeType: string) => {
      const binario = atob(base64);
      const bytes = new Uint8Array(binario.length);
      for (let i = 0; i < binario.length; i++) bytes[i] = binario.charCodeAt(i);
      const url = URL.createObjectURL(new Blob([bytes], { type: mimeType }));

      audioUrlRef.current = url;
      const audio = new Audio(url);
      audioRef.current = audio;
      audio.onended = () => {
        limpiarAudio();
        setEstado("idle");
      };
      audio.onerror = () => {
        limpiarAudio();
        setEstado("idle");
      };
      setEstado("speaking");
      void audio.play().catch(() => {
        limpiarAudio();
        setEstado("idle");
      });
    },
    [limpiarAudio],
  );

  const enviar = useCallback(
    async (texto: string) => {
      setEstado("processing");
      try {
        const res = await fetch("/api/assistant", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ message: texto }),
        });
        const data = (await res.json()) as {
          text?: string;
          audio?: string | null;
          mimeType?: string | null;
          error?: string;
        };

        if (!res.ok) {
          fallar(data.error ?? "No pude responder ahora. Intenta de nuevo.");
          return;
        }

        setRespuesta(data.text ?? null);
        if (data.audio && data.mimeType) {
          reproducir(data.audio, data.mimeType);
        } else {
          setEstado("idle");
        }
      } catch {
        fallar("No pude conectar. Revisa tu conexión e intenta de nuevo.");
      }
    },
    [fallar, reproducir],
  );

  const detener = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    recognitionRef.current?.stop();
  }, []);

  const iniciar = useCallback(async () => {
    const Ctor = getRecognitionCtor();
    if (!Ctor) {
      fallar("Tu navegador no permite dictado por voz. Prueba con Chrome o Edge.");
      return;
    }

    limpiarAudio();
    setRespuesta(null);
    setMensajeError(null);
    transcriptRef.current = "";
    enviadoRef.current = false;

    // Permiso explícito de micrófono. Se solicita aquí — dentro del gesto del
    // usuario — nunca al montar el componente.
    const errorMicrofono = await asegurarMicrofono();
    if (errorMicrofono) {
      fallar(errorMicrofono);
      return;
    }

    const recognition = new Ctor();
    recognition.lang = "es-MX";
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    recognition.onresult = (event) => {
      let final = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) final += result[0].transcript;
      }
      if (final) transcriptRef.current += final;
    };

    recognition.onerror = (event) => {
      enviadoRef.current = true;
      switch (event.error) {
        case "not-allowed":
          fallar("Necesito permiso para usar tu micrófono.");
          break;
        case "service-not-allowed":
          // El micrófono puede estar concedido: lo bloqueado es el servicio de
          // dictado (origen no seguro o política del navegador).
          fallar("Tu navegador bloqueó el dictado por voz en esta página.");
          break;
        case "audio-capture":
          fallar("No encontré ningún micrófono conectado.");
          break;
        case "network":
          fallar("El dictado necesita conexión. Revísala e intenta de nuevo.");
          break;
        case "no-speech":
          fallar("No escuché nada. Toca y habla de nuevo.");
          break;
        case "aborted":
          setEstado("idle");
          break;
        default:
          fallar("Hubo un problema con el micrófono. Intenta de nuevo.");
      }
    };

    recognition.onend = () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      recognitionRef.current = null;
      if (enviadoRef.current) return;
      enviadoRef.current = true;

      const texto = transcriptRef.current.trim();
      if (!texto) {
        fallar("No escuché nada. Toca y habla de nuevo.");
        return;
      }
      void enviar(texto);
    };

    recognitionRef.current = recognition;
    try {
      recognition.start();
    } catch {
      fallar("No pude iniciar el micrófono. Intenta de nuevo.");
      return;
    }

    setEstado("listening");
    timeoutRef.current = setTimeout(() => recognition.stop(), MAX_LISTEN_MS);
  }, [enviar, fallar, limpiarAudio]);

  const alHacerClick = useCallback(() => {
    if (estado === "listening") {
      detener();
      return;
    }
    if (estado === "speaking") {
      limpiarAudio();
      setEstado("idle");
      return;
    }
    if (estado === "processing") return;
    void iniciar();
  }, [detener, estado, iniciar, limpiarAudio]);

  if (!soportado) return null;

  const activo = estado === "listening";
  const color = activo || estado === "speaking" ? CYAN : GOLD;

  return (
    <div className="fixed bottom-6 left-4 sm:left-6 z-50 flex flex-col items-start gap-2 max-w-[calc(100vw-2rem)]">
      {(respuesta || mensajeError) && (
        <div
          className="max-w-[18rem] sm:max-w-xs rounded-lg border border-zinc-800 bg-[#050508]/95 px-3 py-2 text-xs leading-relaxed shadow-lg shadow-black/50 backdrop-blur"
          style={{ color: mensajeError ? "#f87171" : "#e4e4e7" }}
          role="status"
          aria-live="polite"
        >
          {mensajeError ?? respuesta}
        </div>
      )}

      <button
        type="button"
        onClick={alHacerClick}
        disabled={estado === "processing"}
        aria-label={ETIQUETAS[estado]}
        className="group flex items-center gap-2 rounded-full border bg-[#050508]/90 py-2 pl-2 pr-3 sm:pr-4 shadow-lg shadow-black/50 backdrop-blur transition-transform hover:scale-105 disabled:cursor-wait disabled:hover:scale-100"
        style={{ borderColor: color }}
      >
        <span
          className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
          style={{ backgroundColor: `${color}1a` }}
        >
          {activo && (
            <span
              className="absolute inset-0 animate-ping rounded-full opacity-60"
              style={{ backgroundColor: `${CYAN}33` }}
            />
          )}

          {estado === "processing" ? (
            <svg viewBox="0 0 24 24" className="h-5 w-5 animate-spin" aria-hidden="true">
              <circle
                cx="12"
                cy="12"
                r="9"
                fill="none"
                stroke={color}
                strokeWidth="2"
                strokeOpacity="0.25"
              />
              <path
                d="M21 12a9 9 0 0 0-9-9"
                fill="none"
                stroke={color}
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          ) : estado === "speaking" ? (
            <svg viewBox="0 0 24 24" className="relative h-5 w-5" aria-hidden="true">
              <path
                d="M4 9v6h4l5 4V5L8 9H4Z"
                fill={color}
              />
              <path
                d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12"
                fill="none"
                stroke={color}
                strokeWidth="1.8"
                strokeLinecap="round"
              />
            </svg>
          ) : activo ? (
            <span className="relative flex items-end gap-[3px]" aria-hidden="true">
              {[0, 1, 2, 3].map((i) => (
                <span
                  key={i}
                  className="w-[3px] rounded-full"
                  style={{
                    backgroundColor: CYAN,
                    height: "1rem",
                    animation: `nasus-wave 0.9s ease-in-out ${i * 0.12}s infinite`,
                  }}
                />
              ))}
            </span>
          ) : (
            <svg viewBox="0 0 24 24" className="relative h-5 w-5" aria-hidden="true">
              <path
                d="M12 3a3 3 0 0 1 3 3v6a3 3 0 0 1-6 0V6a3 3 0 0 1 3-3Z"
                fill={color}
              />
              <path
                d="M5 11a7 7 0 0 0 14 0M12 18v3"
                fill="none"
                stroke={color}
                strokeWidth="1.8"
                strokeLinecap="round"
              />
            </svg>
          )}
        </span>

        <span
          className="font-mono text-[11px] sm:text-xs tracking-wide whitespace-nowrap"
          style={{ color }}
        >
          {ETIQUETAS[estado]}
        </span>
      </button>
    </div>
  );
}
