"use client";

import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { captureFirstTouch } from "@/lib/acquisition/attribution";

const STORAGE_KEY = "nasus_first_touch_v1";
const SESSION_KEY = "nasus_session_v1";
const UTM_KEYS = ["source", "medium", "campaign", "content", "term"] as const;

type Touch = Partial<Record<(typeof UTM_KEYS)[number], string>> & { referrer?: string };

function sessionId(): string {
  let id = sessionStorage.getItem(SESSION_KEY);
  if (!id) { id = crypto.randomUUID(); sessionStorage.setItem(SESSION_KEY, id); }
  return id;
}

function firstTouch(params: URLSearchParams): Touch {
  let saved: Touch = {};
  try { saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}"); } catch { /* datos locales inválidos */ }
  if (Object.keys(saved).length === 0) {
    saved = captureFirstTouch(null, params, document.referrer || null) as Touch;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));
  }
  return saved;
}

async function track(eventType: string, metadata: Record<string, string> = {}) {
  const touch = firstTouch(new URLSearchParams(location.search));
  const response = await fetch("/api/acquisition/events", {
    method: "POST", headers: { "content-type": "application/json" }, keepalive: true,
    body: JSON.stringify({ eventType, sessionId: sessionId(), ...touch, landingPath: location.pathname, referrer: document.referrer || null, metadata }),
  });
  return response.json() as Promise<{ attributionId: string | null }>;
}

export async function openTrackedWhatsApp(url: string, destinationType: "humano" | "demo", ctaLocation: string) {
  const pending = window.open("about:blank", "_blank");
  const result = await track("whatsapp_click", { destination_type: destinationType, cta_location: ctaLocation }).catch(() => ({ attributionId: null }));
  const target = new URL(url);
  if (destinationType === "demo" && result.attributionId) {
    const existing = target.searchParams.get("text") || "Hola, quiero conocer el asistente de Nasus.";
    target.searchParams.set("text", `${existing}\n\n[N:${result.attributionId}]`);
  }
  if (pending) pending.location.href = target.toString(); else window.location.href = target.toString();
}

export default function AcquisitionTracker() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  useEffect(() => { void track("page_view"); }, [pathname, searchParams]);
  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      const anchor = (event.target as Element | null)?.closest<HTMLAnchorElement>('a[href*="wa.me/"]');
      if (!anchor || event.defaultPrevented) return;
      event.preventDefault();
      const demo = anchor.href.includes("523329621602");
      void openTrackedWhatsApp(anchor.href, demo ? "demo" : "humano", anchor.dataset.ctaLocation || "link");
    };
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);
  return null;
}
