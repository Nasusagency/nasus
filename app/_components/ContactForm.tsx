"use client";

import { useState } from "react";
import { currentAttribution, openTrackedWhatsApp } from "./AcquisitionTracker";
import { CONSENT_TEXT } from "@/lib/crm/consent-text";
import { trackMeta } from "@/lib/meta/pixel";

export default function ContactForm() {
  const [form, setForm] = useState({ name: "", company: "", problem: "", phone: "", email: "", website: "", consentEmail: false, consentWhatsapp: false });
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (sending) return;
    setError(null);
    setSending(true);
    // 1) Guardar en el CRM (+ aviso al equipo). Si falla, igual se abre WhatsApp:
    //    nunca se pierde al prospecto por un error del servidor.
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          nombre: form.name, empresa: form.company, problema: form.problem,
          telefono: form.phone, email: form.email, website: form.website,
          consents: { email: form.consentEmail && form.email.trim() !== "", whatsapp: form.consentWhatsapp },
          attribution: currentAttribution(),
        }),
      });
      if (res.ok) trackMeta("Lead", { content_name: "contact_form" });
      if (res.status === 400) {
        setError("Revisa tu teléfono (10 dígitos) y tu correo.");
        setSending(false);
        return;
      }
    } catch { /* se continúa a WhatsApp */ }
    // 2) Abrir WhatsApp con el mensaje, como antes.
    const message = encodeURIComponent(
      `Hola, soy ${form.name} de ${form.company}.\n\nProblema:\n${form.problem}`
    );
    await openTrackedWhatsApp(`https://wa.me/523329621602?text=${message}`, "comercial", "contact_form", "Enviar mensaje");
    setSending(false);
  };

  const inputClass =
    "w-full bg-zinc-900 border border-zinc-800 text-white rounded-lg px-4 py-3 focus:outline-none focus:border-[#c4a882] transition-colors placeholder:text-zinc-600";

  return (
    <form onSubmit={(e) => void handleSubmit(e)} className="space-y-6">
      <div>
        <label className="block text-zinc-400 text-sm mb-2">Nombre</label>
        <input
          type="text"
          required
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          className={inputClass}
          placeholder="Tu nombre"
        />
      </div>
      <div>
        <label className="block text-zinc-400 text-sm mb-2">Empresa</label>
        <input
          type="text"
          required
          value={form.company}
          onChange={(e) => setForm({ ...form, company: e.target.value })}
          className={inputClass}
          placeholder="Nombre de tu empresa"
        />
      </div>
      <div className="grid gap-6 sm:grid-cols-2">
        <div>
          <label className="block text-zinc-400 text-sm mb-2">WhatsApp / teléfono</label>
          <input type="tel" required inputMode="tel" autoComplete="tel" value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })} className={inputClass} placeholder="33 1234 5678" />
        </div>
        <div>
          <label className="block text-zinc-400 text-sm mb-2">Correo (opcional)</label>
          <input type="email" autoComplete="email" value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })} className={inputClass} placeholder="tu@empresa.com" />
        </div>
      </div>
      {/* Honeypot anti-bots: oculto para personas. */}
      <input type="text" tabIndex={-1} autoComplete="off" aria-hidden="true" value={form.website}
        onChange={(e) => setForm({ ...form, website: e.target.value })} className="hidden" />
      <div>
        <label className="block text-zinc-400 text-sm mb-2">
          ¿Cuál es tu problema?
        </label>
        <textarea
          required
          value={form.problem}
          onChange={(e) => setForm({ ...form, problem: e.target.value })}
          rows={5}
          className={`${inputClass} resize-none`}
          placeholder="Describe el problema técnico que quieres resolver..."
        />
      </div>
      {/* Permisos de marketing: opcionales y SIN marcar. No condicionan el envío del formulario. */}
      <fieldset className="space-y-3 rounded-lg border border-zinc-800 p-4">
        <legend className="px-1 text-xs text-zinc-500">Opcional</legend>
        <label className="flex items-start gap-3 text-sm text-zinc-400">
          <input type="checkbox" checked={form.consentEmail} disabled={!form.email.trim()}
            onChange={(e) => setForm({ ...form, consentEmail: e.target.checked })}
            className="mt-1 h-4 w-4 shrink-0 accent-[#c4a882] disabled:opacity-40" />
          <span>{CONSENT_TEXT.email}{!form.email.trim() && <span className="text-zinc-600"> (escribe tu correo para activarla)</span>}</span>
        </label>
        <label className="flex items-start gap-3 text-sm text-zinc-400">
          <input type="checkbox" checked={form.consentWhatsapp}
            onChange={(e) => setForm({ ...form, consentWhatsapp: e.target.checked })}
            className="mt-1 h-4 w-4 shrink-0 accent-[#c4a882]" />
          <span>{CONSENT_TEXT.whatsapp}</span>
        </label>
        <p className="text-xs text-zinc-600">
          Más detalles en nuestro <a href="/privacidad" target="_blank" className="underline hover:text-zinc-400">aviso de privacidad</a>.
        </p>
      </fieldset>
      {error && <p role="alert" className="text-sm text-red-400">{error}</p>}
      <button
        type="submit"
        disabled={sending}
        className="w-full bg-[#c4a882] text-[#050508] font-bold py-4 rounded-lg hover:bg-[#d4b892] transition-colors"
      >
        Enviar mensaje
      </button>
      <p className="text-center text-zinc-600 text-sm">
        o escríbenos directo por{" "}
        <a
          href="https://wa.me/523329621602"
          target="_blank"
          rel="noopener noreferrer"
          className="text-zinc-400 hover:text-[#c4a882] transition-colors"
        >
          WhatsApp
        </a>
      </p>
    </form>
  );
}
