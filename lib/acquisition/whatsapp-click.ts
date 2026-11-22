import { reportGoogleAdsWhatsAppConversion } from "@/lib/google-ads/conversions";

type TrackingResult = { attributionId: string | null };

export type WhatsAppClickDependencies = {
  trackInternal: () => Promise<TrackingResult>;
  navigate: (url: string) => void;
  reportConversion?: (onComplete: () => void) => void;
};

export async function completeTrackedWhatsAppClick(
  url: string,
  destinationType: "comercial" | "demo",
  dependencies: WhatsAppClickDependencies,
): Promise<void> {
  const result = await dependencies.trackInternal().catch(() => ({ attributionId: null }));
  const target = new URL(url);
  // Todo el sitio apunta a la línea de la Cloud API: el token [N:...] liga el clic con el lead
  // que crea el webhook, sea demo o comercial.
  if (result.attributionId) {
    const fallbackText = destinationType === "demo" ? "Hola, quiero conocer el asistente de Nasus." : "Hola Nasus, quiero platicar sobre un proyecto.";
    const existing = target.searchParams.get("text") || fallbackText;
    target.searchParams.set("text", `${existing}\n\n[N:${result.attributionId}]`);
  }

  const navigate = () => dependencies.navigate(target.toString());
  // Solo los clics comerciales cuentan como conversión de Google Ads (probar la demo no).
  if (destinationType === "comercial") {
    (dependencies.reportConversion ?? reportGoogleAdsWhatsAppConversion)(navigate);
  } else {
    navigate();
  }
}
