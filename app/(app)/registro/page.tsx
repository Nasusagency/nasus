"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { readUTMsFromCookies } from "@/lib/utm/cookies";

interface DiagnosticData {
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_content?: string;
  utm_term?: string;
  event_id?: string | null;
  ticket_class_id?: string | null;
}

export default function RegistroPage() {
  const [data, setData] = useState<DiagnosticData>(() => {
    const params = new URLSearchParams(typeof window !== "undefined" ? window.location.search : "");
    const utmData = typeof window !== "undefined" ? readUTMsFromCookies() : {};

    return {
      ...utmData,
      event_id: params.get("event_id"),
      ticket_class_id: params.get("ticket_class_id"),
    };
  });

  useEffect(() => {
    // Read cookies after hydration to ensure fresh values from the browser
    const params = new URLSearchParams(window.location.search);
    const utmData = readUTMsFromCookies();

    // eslint-disable-next-line react-hooks/set-state-in-effect
    setData({
      ...utmData,
      event_id: params.get("event_id"),
      ticket_class_id: params.get("ticket_class_id"),
    });
  }, []);

  return (
    <div className="min-h-screen bg-[#050508] px-6 py-12">
      <div className="max-w-2xl mx-auto space-y-8">
        <div className="space-y-3">
          <h1 className="text-4xl font-bold text-white font-serif">Diagnóstico de Atribución</h1>
          <p className="text-zinc-400">
            Los datos recuperados de tu sesión de Zoho Backstage aparecen abajo.
          </p>
        </div>

        <div className="bg-zinc-900/50 border border-zinc-800 rounded-lg p-8 space-y-6">
          {/* UTM Data */}
          <div className="space-y-4">
            <h2 className="text-lg font-bold text-[#c4a882] font-mono text-sm tracking-wider uppercase">
              UTM Parameters
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"].map((key) => (
                <div key={key} className="space-y-1">
                  <label className="text-xs text-zinc-500 font-mono uppercase tracking-wider">
                    {key}
                  </label>
                  <div className="text-sm text-white font-mono bg-[#050508] px-3 py-2 rounded border border-zinc-800">
                    {data?.[key as keyof DiagnosticData] || <span className="text-zinc-600">—</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Event Data */}
          <div className="border-t border-zinc-800 pt-6 space-y-4">
            <h2 className="text-lg font-bold text-[#00f2ff] font-mono text-sm tracking-wider uppercase">
              Event Parameters
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {["event_id", "ticket_class_id"].map((key) => (
                <div key={key} className="space-y-1">
                  <label className="text-xs text-zinc-500 font-mono uppercase tracking-wider">
                    {key}
                  </label>
                  <div className="text-sm text-white font-mono bg-[#050508] px-3 py-2 rounded border border-zinc-800">
                    {data?.[key as keyof DiagnosticData] || <span className="text-zinc-600">—</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Status */}
          <div className="border-t border-zinc-800 pt-6">
            <div className="flex items-center gap-3">
              <div className="w-2 h-2 rounded-full bg-green-500" />
              <span className="text-sm text-zinc-300">
                {Object.values(data || {}).some((v) => v) ? "Datos recuperados exitosamente" : "Sin datos de atribución"}
              </span>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <div className="flex gap-3 pt-4">
          <Link
            href="/"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-zinc-800 text-zinc-300 hover:text-white hover:border-[#c4a882] transition-colors text-sm font-mono"
          >
            ← Inicio
          </Link>
          <Link
            href="/track"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#c4a882] text-[#050508] hover:bg-[#d4b89a] transition-colors text-sm font-mono font-bold"
          >
            Hacer prueba →
          </Link>
        </div>
      </div>
    </div>
  );
}
