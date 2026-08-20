"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
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

interface RegistrationResponse {
  success: boolean;
  orderId?: string;
  tickets?: Array<{ ticket_id: string; ticketclass_id: string }>;
  error?: string;
  message?: string;
}

interface FormState {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
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

  const [formState, setFormState] = useState<FormState>({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [registrationResult, setRegistrationResult] = useState<RegistrationResponse | null>(null);
  const [formError, setFormError] = useState<string>("");

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

  const handleFormChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormState((prev) => ({ ...prev, [name]: value }));
    setFormError("");
  };

  const validateForm = (): boolean => {
    if (!formState.firstName.trim()) {
      setFormError("El nombre es requerido");
      return false;
    }
    if (!formState.lastName.trim()) {
      setFormError("El apellido es requerido");
      return false;
    }
    if (!formState.email.trim()) {
      setFormError("El email es requerido");
      return false;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formState.email)) {
      setFormError("El email no es válido");
      return false;
    }
    return true;
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    if (!data.event_id || !data.ticket_class_id) {
      setFormError("Faltan parámetros de evento requeridos");
      return;
    }

    setIsSubmitting(true);
    setFormError("");

    try {
      const response = await fetch("/api/backstage/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: formState.firstName,
          lastName: formState.lastName,
          email: formState.email,
          phone: formState.phone || undefined,
          eventId: data.event_id,
          ticketClassId: data.ticket_class_id,
        }),
      });

      const result: RegistrationResponse = await response.json();

      if (!response.ok) {
        setFormError(result.error || "Error en el registro");
        setRegistrationResult(null);
      } else {
        setRegistrationResult(result);
        setFormState({ firstName: "", lastName: "", email: "", phone: "" });
      }
    } catch {
      setFormError("Error de conexión. Intenta de nuevo.");
      setRegistrationResult(null);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#050508] px-6 py-12">
      <div className="max-w-2xl mx-auto space-y-8">
        <div className="space-y-3">
          <h1 className="text-4xl font-bold text-white font-serif">Registro de Asistente</h1>
          <p className="text-zinc-400">
            Completa el formulario para registrarte en el evento de Zoho Backstage.
          </p>
        </div>

        {/* Diagnostic Data */}
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

        {/* Registration Form */}
        {!registrationResult?.success ? (
          <form onSubmit={handleSubmit} className="bg-zinc-900/50 border border-zinc-800 rounded-lg p-8 space-y-6">
            <h2 className="text-lg font-bold text-white">Completa tu registro</h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label htmlFor="firstName" className="text-sm text-zinc-300 font-medium">
                  Nombre <span className="text-red-500">*</span>
                </label>
                <input
                  id="firstName"
                  name="firstName"
                  type="text"
                  value={formState.firstName}
                  onChange={handleFormChange}
                  disabled={isSubmitting}
                  className="w-full px-3 py-2 bg-[#050508] border border-zinc-800 rounded text-white placeholder-zinc-600 focus:outline-none focus:border-[#c4a882] disabled:opacity-50"
                  placeholder="Tu nombre"
                />
              </div>

              <div className="space-y-2">
                <label htmlFor="lastName" className="text-sm text-zinc-300 font-medium">
                  Apellido <span className="text-red-500">*</span>
                </label>
                <input
                  id="lastName"
                  name="lastName"
                  type="text"
                  value={formState.lastName}
                  onChange={handleFormChange}
                  disabled={isSubmitting}
                  className="w-full px-3 py-2 bg-[#050508] border border-zinc-800 rounded text-white placeholder-zinc-600 focus:outline-none focus:border-[#c4a882] disabled:opacity-50"
                  placeholder="Tu apellido"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label htmlFor="email" className="text-sm text-zinc-300 font-medium">
                Email <span className="text-red-500">*</span>
              </label>
              <input
                id="email"
                name="email"
                type="email"
                value={formState.email}
                onChange={handleFormChange}
                disabled={isSubmitting}
                className="w-full px-3 py-2 bg-[#050508] border border-zinc-800 rounded text-white placeholder-zinc-600 focus:outline-none focus:border-[#c4a882] disabled:opacity-50"
                placeholder="correo@ejemplo.com"
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="phone" className="text-sm text-zinc-300 font-medium">
                Teléfono <span className="text-zinc-600 text-xs">(opcional)</span>
              </label>
              <input
                id="phone"
                name="phone"
                type="tel"
                value={formState.phone}
                onChange={handleFormChange}
                disabled={isSubmitting}
                className="w-full px-3 py-2 bg-[#050508] border border-zinc-800 rounded text-white placeholder-zinc-600 focus:outline-none focus:border-[#c4a882] disabled:opacity-50"
                placeholder="+52 3312345678"
              />
            </div>

            {formError && (
              <div className="p-3 bg-red-900/20 border border-red-800 rounded text-red-300 text-sm">
                {formError}
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full px-4 py-3 bg-[#c4a882] text-[#050508] rounded-lg font-bold hover:bg-[#d4b89a] disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-[#050508] border-t-transparent rounded-full animate-spin" />
                  Registrando...
                </>
              ) : (
                "Registrarme"
              )}
            </button>
          </form>
        ) : (
          <div className="bg-green-900/20 border border-green-800 rounded-lg p-8 space-y-6">
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 rounded-full bg-green-500" />
                <h2 className="text-2xl font-bold text-green-300">¡Registro Exitoso!</h2>
              </div>
              <p className="text-green-200">Tu registro ha sido procesado correctamente en Zoho Backstage.</p>
            </div>

            {registrationResult.orderId && (
              <div className="space-y-3 border-t border-green-800 pt-4">
                <div>
                  <label className="text-xs text-green-600 font-mono uppercase tracking-wider">Order ID</label>
                  <div className="text-sm text-green-300 font-mono bg-green-950/50 px-3 py-2 rounded border border-green-800">
                    {registrationResult.orderId}
                  </div>
                </div>

                {registrationResult.tickets?.[0]?.ticket_id && (
                  <div>
                    <label className="text-xs text-green-600 font-mono uppercase tracking-wider">Ticket ID</label>
                    <div className="text-sm text-green-300 font-mono bg-green-950/50 px-3 py-2 rounded border border-green-800">
                      {registrationResult.tickets[0].ticket_id}
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="flex gap-3">
              <Link
                href="/"
                className="flex-1 px-4 py-2 rounded-lg border border-green-800 text-green-300 hover:text-green-200 transition-colors text-sm font-mono text-center"
              >
                ← Inicio
              </Link>
              <Link
                href="/track"
                className="flex-1 px-4 py-2 rounded-lg bg-green-700 text-white hover:bg-green-600 transition-colors text-sm font-mono text-center font-bold"
              >
                Nueva prueba →
              </Link>
            </div>
          </div>
        )}

        {/* Navigation (when not successful) */}
        {!registrationResult?.success && (
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
              Nueva prueba →
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
