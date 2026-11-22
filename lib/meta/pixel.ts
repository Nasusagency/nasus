/**
 * Pixel de Meta (Facebook / Instagram).
 *
 * El ID es público (va en el navegador), pero se configura en Vercel con
 * NEXT_PUBLIC_META_PIXEL_ID para no tocar código. Sin esa variable, el pixel no se
 * carga y trackMeta no hace nada.
 *
 * Privacidad: solo se mandan eventos estándar sin datos personales (sin "advanced
 * matching": ni correo, ni teléfono, ni nombre). Lo mismo que con Google Ads.
 */

const raw = process.env.NEXT_PUBLIC_META_PIXEL_ID?.trim() ?? "";

/** Solo dígitos: evita inyectar cualquier otra cosa en el script del layout. */
export const META_PIXEL_ID = /^\d{5,20}$/.test(raw) ? raw : null;

export type MetaStandardEvent = "PageView" | "Contact" | "Lead";

type Fbq = (command: "track", event: MetaStandardEvent, params?: Record<string, string>) => void;

export function trackMeta(event: MetaStandardEvent, params?: Record<string, string>): void {
  if (typeof window === "undefined") return;
  const fbq = (window as typeof window & { fbq?: Fbq }).fbq;
  if (typeof fbq !== "function") return;
  try {
    fbq("track", event, params);
  } catch {
    // Un fallo del pixel nunca debe romper la navegación ni el formulario.
  }
}

/** Código base oficial de Meta, con PageView inicial. */
export function metaPixelSnippet(pixelId: string): string {
  return `!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?
n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;
n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;
t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,
document,'script','https://connect.facebook.net/en_US/fbevents.js');
fbq('init', '${pixelId}');
fbq('track', 'PageView');`;
}
