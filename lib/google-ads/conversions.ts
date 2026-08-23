export const GOOGLE_ADS_WHATSAPP_CONVERSION_ID = "AW-18354242244/yfozCNv1zOYcEMSF_q9E";

type ConversionParams = {
  send_to: typeof GOOGLE_ADS_WHATSAPP_CONVERSION_ID;
  event_callback?: () => void;
};

export type GoogleAdsGtag = (
  command: "event",
  eventName: "conversion",
  params: ConversionParams,
) => void;

type ConversionOptions = {
  gtag?: GoogleAdsGtag | null;
  fallbackMs?: number;
  setTimer?: (callback: () => void, delay: number) => ReturnType<typeof setTimeout>;
  clearTimer?: (timer: ReturnType<typeof setTimeout>) => void;
};

function browserGtag(): GoogleAdsGtag | null {
  if (typeof window === "undefined") return null;
  return (window as typeof window & { gtag?: GoogleAdsGtag }).gtag ?? null;
}

export function reportGoogleAdsWhatsAppConversion(
  onComplete?: () => void,
  options: ConversionOptions = {},
): void {
  const gtag = options.gtag === undefined ? browserGtag() : options.gtag;
  if (typeof gtag !== "function") {
    onComplete?.();
    return;
  }

  let completed = false;
  let fallback: ReturnType<typeof setTimeout> | undefined;
  const complete = () => {
    if (completed) return;
    completed = true;
    if (fallback !== undefined) (options.clearTimer ?? clearTimeout)(fallback);
    try { onComplete?.(); } catch { /* la navegación no debe generar errores visibles */ }
  };

  if (onComplete) fallback = (options.setTimer ?? setTimeout)(complete, options.fallbackMs ?? 500);
  try {
    gtag("event", "conversion", {
      send_to: GOOGLE_ADS_WHATSAPP_CONVERSION_ID,
      ...(onComplete ? { event_callback: complete } : {}),
    });
  } catch {
    complete();
  }
}
