"use client";

import { useState } from "react";
import { openTrackedWhatsApp } from "./AcquisitionTracker";

export default function ContactForm() {
  const [form, setForm] = useState({ name: "", company: "", problem: "" });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const message = encodeURIComponent(
      `Hola, soy ${form.name} de ${form.company}.\n\nProblema:\n${form.problem}`
    );
    void openTrackedWhatsApp(`https://wa.me/523329142391?text=${message}`, "humano", "contact_form", "Enviar mensaje");
  };

  const inputClass =
    "w-full bg-zinc-900 border border-zinc-800 text-white rounded-lg px-4 py-3 focus:outline-none focus:border-[#c4a882] transition-colors placeholder:text-zinc-600";

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
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
      <button
        type="submit"
        className="w-full bg-[#c4a882] text-[#050508] font-bold py-4 rounded-lg hover:bg-[#d4b892] transition-colors"
      >
        Enviar mensaje
      </button>
      <p className="text-center text-zinc-600 text-sm">
        o escríbenos directo por{" "}
        <a
          href="https://wa.me/523329142391"
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
