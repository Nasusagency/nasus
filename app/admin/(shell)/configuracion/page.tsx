export default function SettingsPage() {
  const integrations = [
    ["WhatsApp Cloud API", Boolean(process.env.WHATSAPP_ACCESS_TOKEN)],
    ["Groq Agent", Boolean(process.env.GROQ_API_KEY)],
    ["Resend", Boolean(process.env.RESEND_API_KEY)],
    ["Supabase service role", Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY)],
  ] as const;
  return <div className="p-6 lg:p-8 max-w-4xl mx-auto"><p className="text-[10px] tracking-[.18em] text-[#8c6a3b]">SISTEMA</p><h1 className="text-2xl font-semibold text-zinc-950 mb-6">Configuración</h1><div className="rounded-xl border border-zinc-200 bg-white divide-y divide-zinc-100">{integrations.map(([name, configured]) => <div key={name} className="flex items-center justify-between px-5 py-4"><span className="text-sm text-zinc-800">{name}</span><span className={`rounded-full px-2 py-1 text-xs ${configured ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-800"}`}>{configured ? "Configurado" : "Pendiente"}</span></div>)}</div><p className="mt-4 text-xs text-zinc-500">Por seguridad, esta vista solo indica disponibilidad y nunca muestra secretos.</p></div>;
}
