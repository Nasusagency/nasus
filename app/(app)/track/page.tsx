"use client";

import { useEffect } from "react";
import { saveUTMsToCookies } from "@/lib/utm/cookies";

const ZOHO_BACKSTAGE_URL = "https://nasus-labs.zohobackstage.com/APITestNasus";

export default function TrackPage() {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    saveUTMsToCookies(params);

    const timer = setTimeout(() => {
      window.location.href = ZOHO_BACKSTAGE_URL;
    }, 100);

    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#050508] px-6">
      <div className="text-center space-y-6">
        <h1 className="text-3xl font-bold text-white">Guardando datos...</h1>
        <p className="text-zinc-400">
          Te estamos redirigiendo a Zoho Backstage. Esta página se cierra automáticamente en un momento.
        </p>
        <div className="flex justify-center">
          <div className="w-8 h-8 border-2 border-[#c4a882] border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    </div>
  );
}
