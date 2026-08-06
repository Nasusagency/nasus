const ELEVENLABS_BASE = "https://api.elevenlabs.io/v1/text-to-speech";

/** Modelo de ElevenLabs. `eleven_multilingual_v2` da la mejor calidad en español con voces clonadas. */
const DEFAULT_MODEL_ID = "eleven_multilingual_v2";

export type TtsResult = { audio: ArrayBuffer; mimeType: "audio/mpeg" };

/**
 * Convierte texto a voz con la voz clonada de Nasus.
 * Lanza un Error con un código estable; el texto nunca se registra en logs.
 */
export async function textToSpeech(text: string): Promise<TtsResult> {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  const voiceId = process.env.ELEVENLABS_VOICE_ID;

  if (!apiKey || !voiceId) {
    throw new Error("tts_not_configured");
  }

  const modelId = process.env.ELEVENLABS_MODEL_ID ?? DEFAULT_MODEL_ID;
  const url = `${ELEVENLABS_BASE}/${encodeURIComponent(voiceId)}?output_format=mp3_44100_128`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "xi-api-key": apiKey,
      "content-type": "application/json",
      accept: "audio/mpeg",
    },
    body: JSON.stringify({
      text,
      model_id: modelId,
      voice_settings: {
        stability: 0.45,
        similarity_boost: 0.8,
        style: 0.15,
        use_speaker_boost: true,
      },
    }),
    signal: AbortSignal.timeout(20_000),
  });

  if (!res.ok) {
    // Solo el status — el cuerpo puede contener el texto enviado.
    throw new Error(`tts_failed:${res.status}`);
  }

  return { audio: await res.arrayBuffer(), mimeType: "audio/mpeg" };
}
