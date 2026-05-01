"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/browser";
import { useRouter } from "next/navigation";

type Mode = "signin" | "signup";

export default function LoginPage() {
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "error" | "success"; text: string } | null>(null);
  const router = useRouter();
  const supabase = createClient();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    if (mode === "signin") {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        setMessage({ type: "error", text: error.message });
      } else {
        const next = new URLSearchParams(window.location.search).get("next") ?? "/validador";
        router.push(next);
        router.refresh();
      }
    } else {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: `${location.origin}/auth/callback` },
      });
      if (error) {
        setMessage({ type: "error", text: error.message });
      } else {
        setMessage({ type: "success", text: "Revisa tu correo para confirmar tu cuenta." });
      }
    }

    setLoading(false);
  }

  function toggleMode() {
    setMode((m) => (m === "signin" ? "signup" : "signin"));
    setMessage(null);
  }

  return (
    <div className="min-h-screen bg-[#050508] flex items-center justify-center px-4">
      <div className="w-full max-w-sm flex flex-col gap-6">
        <div>
          <a href="/" className="text-[#c4a882] font-mono font-bold tracking-wide text-sm mb-8 inline-block">
            Nasus Agency
          </a>
          <h1 className="text-2xl font-semibold text-white tracking-tight mt-4">
            {mode === "signin" ? "Iniciar sesión" : "Crear cuenta"}
          </h1>
          <p className="text-sm text-zinc-500 mt-1">
            {mode === "signin" ? "Accede a tu cuenta para continuar." : "Crea una cuenta nueva."}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-zinc-400 font-mono">
              Correo electrónico
            </label>
            <input
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="h-10 px-3 rounded-lg border border-zinc-800 bg-zinc-900 text-sm text-white outline-none focus:ring-2 focus:ring-[#c4a882]/50 focus:border-[#c4a882]/50 transition-shadow placeholder:text-zinc-700"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-zinc-400 font-mono">
              Contraseña
            </label>
            <input
              type="password"
              required
              minLength={6}
              autoComplete={mode === "signin" ? "current-password" : "new-password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="h-10 px-3 rounded-lg border border-zinc-800 bg-zinc-900 text-sm text-white outline-none focus:ring-2 focus:ring-[#c4a882]/50 focus:border-[#c4a882]/50 transition-shadow placeholder:text-zinc-700"
            />
          </div>

          {message && (
            <p
              className={`text-sm font-mono ${
                message.type === "error" ? "text-red-400" : "text-emerald-400"
              }`}
            >
              {message.text}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="h-11 rounded-xl bg-[#c4a882] text-[#050508] text-sm font-mono font-bold transition-colors hover:bg-[#d4b892] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading
              ? "Cargando…"
              : mode === "signin"
              ? "Iniciar sesión"
              : "Crear cuenta"}
          </button>
        </form>

        <p className="text-sm text-center text-zinc-600 font-mono">
          {mode === "signin" ? "¿No tienes cuenta?" : "¿Ya tienes cuenta?"}{" "}
          <button
            onClick={toggleMode}
            className="text-[#c4a882] hover:text-[#d4b892] transition-colors"
          >
            {mode === "signin" ? "Regístrate" : "Inicia sesión"}
          </button>
        </p>
      </div>
    </div>
  );
}
