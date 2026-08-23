import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, test } from "node:test";
import { completeTrackedWhatsAppClick } from "@/lib/acquisition/whatsapp-click";
import { GOOGLE_ADS_WHATSAPP_CONVERSION_ID, reportGoogleAdsWhatsAppConversion, type GoogleAdsGtag } from "@/lib/google-ads/conversions";

const DUMMY_TIMER = {} as ReturnType<typeof setTimeout>;

describe("Google Ads WhatsApp conversion", () => {
  test("humano conserva whatsapp_click y dispara una conversión", async () => {
    let internal = 0; let conversions = 0; const navigations: string[] = [];
    await completeTrackedWhatsAppClick("https://wa.me/523329142391", "humano", {
      trackInternal: async () => { internal += 1; return { attributionId: null }; },
      reportConversion: callback => { conversions += 1; callback(); },
      navigate: url => navigations.push(url),
    });
    assert.equal(internal, 1); assert.equal(conversions, 1); assert.equal(navigations.length, 1);
  });

  test("demo conserva whatsapp_click y el token, sin conversión Google", async () => {
    let internal = 0; let conversions = 0; let destination = "";
    await completeTrackedWhatsAppClick("https://wa.me/523329621602", "demo", {
      trackInternal: async () => { internal += 1; return { attributionId: "ABCD1234" }; },
      reportConversion: () => { conversions += 1; },
      navigate: url => { destination = url; },
    });
    assert.equal(internal, 1); assert.equal(conversions, 0);
    assert.match(decodeURIComponent(destination), /\[N:ABCD1234\]/);
  });

  test("demo nunca invoca reportGoogleAdsWhatsAppConversion", async () => {
    let reported = false;
    await completeTrackedWhatsAppClick("https://wa.me/523329621602", "demo", {
      trackInternal: async () => ({ attributionId: null }),
      reportConversion: () => { reported = true; },
      navigate: () => {},
    });
    assert.equal(reported, false);
  });

  test("page_view no utiliza el flujo de conversión de WhatsApp", () => {
    const tracker = readFileSync("app/_components/AcquisitionTracker.tsx", "utf8");
    assert.match(tracker, /track\("page_view"\)/);
    assert.doesNotMatch(tracker, /reportGoogleAdsWhatsAppConversion\([^)]*page_view/);
  });

  test("callback y fallback son idempotentes para un clic físico", () => {
    let callback: (() => void) | undefined; let fallback: (() => void) | undefined; let navigations = 0;
    const gtag: GoogleAdsGtag = (_command, _event, params) => { callback = params.event_callback; };
    reportGoogleAdsWhatsAppConversion(() => { navigations += 1; }, { gtag, setTimer: fn => { fallback = fn; return DUMMY_TIMER; }, clearTimer: () => {} });
    callback?.(); fallback?.();
    assert.equal(navigations, 1);
  });

  test("gtag inexistente no rompe y continúa navegación", () => {
    let navigated = false;
    reportGoogleAdsWhatsAppConversion(() => { navigated = true; }, { gtag: null });
    assert.equal(navigated, true);
  });

  test("gtag inexistente no rompe los destinos humano ni demo", async () => {
    const destinations: string[] = [];
    for (const destinationType of ["humano", "demo"] as const) {
      await completeTrackedWhatsAppClick(`https://wa.me/${destinationType === "humano" ? "523329142391" : "523329621602"}`, destinationType, {
        trackInternal: async () => ({ attributionId: null }),
        reportConversion: callback => reportGoogleAdsWhatsAppConversion(callback, { gtag: null }),
        navigate: url => destinations.push(url),
      });
    }
    assert.equal(destinations.length, 2);
  });

  test("error de gtag no rompe y continúa navegación", () => {
    let navigated = false;
    const gtag = (() => { throw new Error("unavailable"); }) as GoogleAdsGtag;
    assert.doesNotThrow(() => reportGoogleAdsWhatsAppConversion(() => { navigated = true; }, { gtag, setTimer: () => DUMMY_TIMER, clearTimer: () => {} }));
    assert.equal(navigated, true);
  });

  test("event_callback navega correctamente", () => {
    let callback: (() => void) | undefined; let navigated = false;
    const gtag: GoogleAdsGtag = (_command, _event, params) => { callback = params.event_callback; };
    reportGoogleAdsWhatsAppConversion(() => { navigated = true; }, { gtag, setTimer: () => DUMMY_TIMER, clearTimer: () => {} });
    callback?.(); assert.equal(navigated, true);
  });

  test("fallback navega si Google nunca invoca el callback", () => {
    let fallback: (() => void) | undefined; let navigated = false;
    reportGoogleAdsWhatsAppConversion(() => { navigated = true; }, { gtag: () => {}, setTimer: fn => { fallback = fn; return DUMMY_TIMER; }, clearTimer: () => {} });
    assert.equal(navigated, false); fallback?.(); assert.equal(navigated, true);
  });

  test("sólo envía el ID de conversión y el callback, sin PII", () => {
    let payload: Record<string, unknown> | undefined;
    const gtag: GoogleAdsGtag = (_command, _event, params) => { payload = params; };
    reportGoogleAdsWhatsAppConversion(() => {}, { gtag, setTimer: () => DUMMY_TIMER, clearTimer: () => {} });
    assert.deepEqual(Object.keys(payload ?? {}).sort(), ["event_callback", "send_to"]);
    assert.equal(payload?.send_to, GOOGLE_ADS_WHATSAPP_CONVERSION_ID);
    assert.doesNotMatch(JSON.stringify(payload), /phone|name|email|message|attribution|session/i);
  });
});
