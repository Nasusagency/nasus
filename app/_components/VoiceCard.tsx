"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";

/**
 * Tarjeta de demo del agente de voz (OpenAI GPT-Live, tiempo real).
 *
 * A diferencia del dictado del navegador, que grababa una frase y la mandaba al
 * terminar, aquí la conversación es continua y en ambos sentidos: el agente
 * escucha mientras hablas, puedes interrumpirlo y responde en el idioma en que
 * le hables. Los anillos del micrófono reaccionan al nivel de audio de cada
 * lado, y así se ve en todo momento que te está escuchando.
 *
 * Si la voz en vivo no está disponible (sin llave, sin presupuesto, error de
 * OpenAI) se explica y se manda a WhatsApp: no hay respaldo por dictado.
 */

type Fase = "idle" | "conectando" | "vivo" | "cerrando" | "error";
type Quien = "usuario" | "agente" | null;

const CONEXION_MS = 15_000;
const CIERRE_MS = 3_000;
const MAX_DEFAULT_S = 90;

const noSuscribir = () => () => {};
const hayWebrtc = () => typeof RTCPeerConnection !== "undefined";

function nivel(an: AnalyserNode | null, buf: Uint8Array<ArrayBuffer>): number {
  if (!an) return 0;
  an.getByteTimeDomainData(buf);
  let suma = 0;
  for (let i = 0; i < buf.length; i++) {
    const v = (buf[i] - 128) / 128;
    suma += v * v;
  }
  const rms = Math.sqrt(suma / buf.length);
  return Math.max(0, Math.min(1, (rms - 0.015) * 7));
}

function mensajeDeMicrofono(err: unknown): string {
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
    default:
      return "No pude acceder al micrófono. Intenta de nuevo.";
  }
}

export default function VoiceCard({
  whatsappUrl,
  className = "",
}: {
  whatsappUrl: string;
  className?: string;
}) {
  const [fase, setFase] = useState<Fase>("idle");
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [quien, setQuien] = useState<Quien>(null);
  const soportado = useSyncExternalStore(noSuscribir, hayWebrtc, () => true);

  const faseRef = useRef<Fase>("idle");
  const quienRef = useRef<Quien>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const eventosRef = useRef<RTCDataChannel | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);
  const anUsuarioRef = useRef<AnalyserNode | null>(null);
  const anAgenteRef = useRef<AnalyserNode | null>(null);
  const rafRef = useRef(0);
  const orbRef = useRef<HTMLDivElement | null>(null);
  const tConexionRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tCierreRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tLimiteRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cambiar = useCallback((f: Fase) => {
    faseRef.current = f;
    setFase(f);
  }, []);

  const limpiar = useCallback(() => {
    for (const r of [tConexionRef, tCierreRef, tLimiteRef]) {
      if (r.current) clearTimeout(r.current);
      r.current = null;
    }
    cancelAnimationFrame(rafRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    // Se anula antes de cerrar: el listener de `close` distingue así un cierre propio.
    const ev = eventosRef.current;
    eventosRef.current = null;
    ev?.close();
    pcRef.current?.close();
    pcRef.current = null;
    if (audioRef.current) {
      audioRef.current.srcObject = null;
      audioRef.current = null;
    }
    void ctxRef.current?.close().catch(() => {});
    ctxRef.current = null;
    anUsuarioRef.current = null;
    anAgenteRef.current = null;
    orbRef.current?.style.setProperty("--u", "0");
    orbRef.current?.style.setProperty("--a", "0");
    quienRef.current = null;
    setQuien(null);
  }, []);

  useEffect(() => limpiar, [limpiar]);

  const fallar = useCallback(
    (msg: string) => {
      limpiar();
      setMensaje(msg);
      cambiar("error");
    },
    [cambiar, limpiar],
  );

  const terminar = useCallback(() => {
    if (faseRef.current !== "vivo" && faseRef.current !== "conectando") return;
    if (tLimiteRef.current) clearTimeout(tLimiteRef.current);
    tLimiteRef.current = null;
    const ev = eventosRef.current;
    if (ev && ev.readyState === "open") {
      try {
        ev.send(JSON.stringify({ type: "session.close" }));
      } catch {
        // Si no se puede enviar, el corte de abajo cierra igual.
      }
      cambiar("cerrando");
      tCierreRef.current = setTimeout(() => {
        limpiar();
        cambiar("idle");
      }, CIERRE_MS);
      return;
    }
    limpiar();
    cambiar("idle");
  }, [cambiar, limpiar]);

  const iniciar = useCallback(async () => {
    if (faseRef.current !== "idle" && faseRef.current !== "error") return;
    setMensaje(null);
    cambiar("conectando");

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
    } catch (err) {
      fallar(mensajeDeMicrofono(err));
      return;
    }
    streamRef.current = stream;

    try {
      const pc = new RTCPeerConnection();
      pcRef.current = pc;

      // Medidores de nivel: uno para tu voz y otro para la del agente.
      const ctx = new window.AudioContext();
      ctxRef.current = ctx;
      const anU = ctx.createAnalyser();
      anU.fftSize = 256;
      ctx.createMediaStreamSource(stream).connect(anU);
      anUsuarioRef.current = anU;

      const audio = new Audio();
      audio.autoplay = true;
      audioRef.current = audio;
      pc.addEventListener("track", (e) => {
        const remoto = new MediaStream([e.track]);
        audio.srcObject = remoto;
        void audio.play().catch(() => {});
        const anA = ctx.createAnalyser();
        anA.fftSize = 256;
        ctx.createMediaStreamSource(remoto).connect(anA);
        anAgenteRef.current = anA;
      });
      stream.getAudioTracks().forEach((t) => pc.addTrack(t, stream));

      const eventos = pc.createDataChannel("oai-events");
      eventosRef.current = eventos;
      let maxS = MAX_DEFAULT_S;

      eventos.addEventListener("message", ({ data }) => {
        let ev: { type?: string };
        try {
          ev = JSON.parse(String(data)) as { type?: string };
        } catch {
          return;
        }
        if (ev.type === "session.started") {
          if (tConexionRef.current) clearTimeout(tConexionRef.current);
          tConexionRef.current = null;
          cambiar("vivo");
          // Tope de duración del lado del cliente (el servidor ya reservó ese tiempo).
          tLimiteRef.current = setTimeout(terminar, maxS * 1000);
          // Medición de audio en cada cuadro: escribe variables CSS, sin re-render.
          const bufU = new Uint8Array(new ArrayBuffer(anU.fftSize));
          const bufA = new Uint8Array(new ArrayBuffer(256));
          const medir = () => {
            const u = nivel(anUsuarioRef.current, bufU);
            const a = nivel(anAgenteRef.current, bufA);
            orbRef.current?.style.setProperty("--u", u.toFixed(3));
            orbRef.current?.style.setProperty("--a", a.toFixed(3));
            const q: Quien = a > 0.12 ? "agente" : u > 0.12 ? "usuario" : null;
            if (q !== quienRef.current) {
              quienRef.current = q;
              setQuien(q);
            }
            rafRef.current = requestAnimationFrame(medir);
          };
          rafRef.current = requestAnimationFrame(medir);
        } else if (ev.type === "session.closed") {
          limpiar();
          cambiar("idle");
        }
      });
      eventos.addEventListener("close", () => {
        if (eventosRef.current !== eventos) return; // cierre propio
        limpiar();
        cambiar("idle");
      });

      tConexionRef.current = setTimeout(
        () => fallar("No pude conectar la voz. Intenta de nuevo."),
        CONEXION_MS,
      );

      const oferta = await pc.createOffer();
      await pc.setLocalDescription(oferta);
      if (pc.iceGatheringState !== "complete") {
        await new Promise<void>((resolve) => {
          const alCambiar = () => {
            if (pc.iceGatheringState !== "complete") return;
            pc.removeEventListener("icegatheringstatechange", alCambiar);
            resolve();
          };
          pc.addEventListener("icegatheringstatechange", alCambiar);
          alCambiar();
        });
      }
      const sdp = pc.localDescription?.sdp;
      if (!sdp) throw new Error("sin_sdp");

      const res = await fetch("/api/live/session", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ sdp }),
      });
      const data = (await res.json()) as {
        sdp?: string;
        maxSeconds?: number;
        error?: string;
        reason?: string;
      };
      if (!res.ok || !data.sdp) {
        const limite = data.reason === "ip" || data.reason === "day" || data.reason === "month";
        fallar(
          limite
            ? (data.error ?? "La demo tiene mucha demanda ahora. Escríbenos por WhatsApp.")
            : "La demo de voz no está disponible en este momento. Escríbenos por WhatsApp.",
        );
        return;
      }
      if (typeof data.maxSeconds === "number" && data.maxSeconds > 0) {
        maxS = Math.min(data.maxSeconds, 300);
      }
      await pc.setRemoteDescription({ type: "answer", sdp: data.sdp });
    } catch {
      fallar("No pude conectar la voz. Intenta de nuevo.");
    }
  }, [cambiar, fallar, limpiar, terminar]);

  // El botón "Agentes de IA" de la barra arranca la conversación desde fuera.
  useEffect(() => {
    const alPedir = () => void iniciar();
    window.addEventListener("nasus:voice", alPedir);
    return () => window.removeEventListener("nasus:voice", alPedir);
  }, [iniciar]);

  const alPulsar = () => {
    if (fase === "vivo" || fase === "conectando") terminar();
    else if (fase === "idle" || fase === "error") void iniciar();
  };

  const enVivo = fase === "vivo";
  const activo = enVivo || fase === "conectando";
  const etiqueta =
    fase === "conectando"
      ? "Conectando…"
      : fase === "cerrando"
        ? "Cerrando…"
        : enVivo
          ? quien === "agente"
            ? "Nasus responde…"
            : quien === "usuario"
              ? "Te escucho…"
              : "Habla cuando quieras"
          : "Toca para hablar";

  return (
    <section
      id="agentes"
      aria-label="Agente de voz"
      className={`voice-card relative scroll-mt-24 ${className}`}
    >
      <div className="flex flex-col items-center px-6 pb-7 pt-7 text-center">
        <span className="font-pixel text-[10px] uppercase tracking-[0.22em] text-[#00f2ff]">
          Prueba el agente
        </span>
        <h3 className="mt-3 text-[22px] font-bold leading-tight text-white">Habla con nuestra IA</h3>
        <p className="mt-1.5 max-w-[250px] text-[13px] leading-relaxed text-zinc-400">
          Pregúntale lo que quieras, en tu idioma.
        </p>

        {soportado ? (
          <div
            ref={orbRef}
            className={`voice-orb relative mt-7 h-[92px] w-[92px] ${fase === "idle" ? "voice-idle" : ""}`}
          >
            <span aria-hidden="true" className="voice-ring voice-ring-a" />
            <span aria-hidden="true" className="voice-ring voice-ring-u" />
            <button
              type="button"
              onClick={alPulsar}
              disabled={fase === "cerrando"}
              aria-label={activo ? "Terminar la conversación" : "Hablar con el agente"}
              className="relative flex h-full w-full items-center justify-center rounded-full border border-[#00f2ff]/60 bg-[#0b0b12] text-[#00f2ff] transition-colors hover:bg-[#00f2ff] hover:text-[#050508] disabled:cursor-wait"
            >
              {activo ? (
                <svg width="26" height="26" viewBox="0 0 24 24" aria-hidden="true">
                  <rect x="6" y="6" width="12" height="12" rx="2" fill="currentColor" />
                </svg>
              ) : (
                <svg width="30" height="30" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M12 3a3 3 0 0 1 3 3v6a3 3 0 0 1-6 0V6a3 3 0 0 1 3-3Z" fill="currentColor" />
                  <path d="M5 11a7 7 0 0 0 14 0M12 18v3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                </svg>
              )}
            </button>
          </div>
        ) : (
          <p className="mt-6 text-[13px] text-zinc-400">
            Tu navegador no permite voz en tiempo real. Prueba con Chrome, Edge o Safari.
          </p>
        )}

        <p
          role="status"
          aria-live="polite"
          className={`mt-5 font-mono text-[12px] ${fase === "error" ? "max-w-[260px] text-red-400" : "text-zinc-300"}`}
        >
          {fase === "error" && mensaje ? mensaje : soportado ? etiqueta : ""}
        </p>
        {fase === "error" && (
          <a
            href={whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 font-mono text-[12px] text-[#c4a882] underline-offset-4 hover:underline"
          >
            Escribir por WhatsApp →
          </a>
        )}
      </div>
    </section>
  );
}
