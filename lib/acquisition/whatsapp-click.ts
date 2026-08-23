import { reportGoogleAdsWhatsAppConversion } from "@/lib/google-ads/conversions";

type TrackingResult = { attributionId: string | null };

export type WhatsAppClickDependencies = {
  trackInternal: () => Promise<TrackingResult>;
  navigate: (url: string) => void;
  reportConversion?: (onComplete: () => void) => void;
};

export async function completeTrackedWhatsAppClick(
  url: string,
  destinationType: "humano" | "demo",
  dependencies: WhatsAppClickDependencies,
): Promise<void> {
  const result = await dependencies.trackInternal().catch(() => ({ attributionId: null }));
  const target = new URL(url);
  if (destinationType === "demo" && result.attributionId) {
    const existing = target.searchParams.get("text") || "Hola, quiero conocer el asistente de Nasus.";
    target.searchParams.set("text", `${existing}\n\n[N:${result.attributionId}]`);
  }

  const navigate = () => dependencies.navigate(target.toString());
  if (destinationType === "humano") {
    (dependencies.reportConversion ?? reportGoogleAdsWhatsAppConversion)(navigate);
  } else {
    navigate();
  }
}
