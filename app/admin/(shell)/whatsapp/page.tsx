import Link from "next/link";
import { getWhatsAppInbox } from "@/lib/admin/whatsapp-data";
import { maskPhone } from "@/lib/acquisition/attribution";
import { attributionLabel } from "@/lib/whatsapp/conversation-policy";

const views = [
  ["", "Todas"], ["new", "Nuevas"], ["high_intent", "High intent"],
  ["requires_human", "Requiere humano"], ["ai", "IA"], ["human", "Humano"],
  ["paused", "Pausadas"], ["resolved", "Cerradas"],
];

export default async function WhatsAppInboxPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const query = await searchParams;
  const view = typeof query.view === "string" ? query.view : "";
  const source = typeof query.source === "string" ? query.source : "";
  const campaign = typeof query.campaign === "string" ? query.campaign : "";
  const all = await getWhatsAppInbox({});
  const conversations = await getWhatsAppInbox({ view, source: source || undefined, campaign: campaign || undefined });
  const sources = [...new Set(all.map(item => item.source).filter(Boolean))] as string[];
  const campaigns = [...new Set(all.map(item => item.campaign).filter(Boolean))] as string[];
  return <div className="p-4 lg:p-8 max-w-7xl mx-auto font-mono">
    <div className="mb-6"><p className="text-[10px] tracking-widest text-[#c4a882]">INBOX</p><h1 className="text-2xl font-bold mt-1">Conversaciones de WhatsApp</h1></div>
    <div className="flex gap-2 flex-wrap mb-4">{views.map(([value, label]) => <Link key={value} href={{ pathname: "/admin/whatsapp", query: { ...(value ? { view: value } : {}), ...(source ? { source } : {}), ...(campaign ? { campaign } : {}) } }} className={`px-3 py-1.5 rounded-lg border text-[10px] ${view === value ? "border-[#c4a882]/50 bg-[#c4a882]/10 text-[#c4a882]" : "border-zinc-800 text-zinc-500"}`}>{label}</Link>)}</div>
    <form className="flex gap-2 flex-wrap mb-5 text-xs"><input type="hidden" name="view" value={view}/><select name="source" defaultValue={source} className="bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2"><option value="">Todas las fuentes</option>{sources.map(value => <option key={value}>{value}</option>)}</select><select name="campaign" defaultValue={campaign} className="bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2"><option value="">Todas las campañas</option>{campaigns.map(value => <option key={value}>{value}</option>)}</select><button className="bg-[#c4a882] text-black rounded-lg px-4">Filtrar</button></form>
    <div className="border border-zinc-800 rounded-xl overflow-hidden">{conversations.map(item => <Link key={item.conversationId} href={`/admin/whatsapp/${item.conversationId}`} className="grid grid-cols-[1fr_auto] lg:grid-cols-[1.2fr_2fr_1fr_1fr_auto] gap-3 items-center px-4 py-4 border-t first:border-t-0 border-zinc-900 hover:bg-zinc-900/60">
      <div className="min-w-0"><div className="flex items-center gap-2"><strong className="text-sm text-zinc-200 truncate">{item.nombre || maskPhone(item.numero)}</strong>{item.unread > 0 && <span className="rounded-full bg-[#c4a882] text-black text-[9px] px-1.5 py-0.5">{item.unread}</span>}</div><span className="text-[10px] text-zinc-600">{maskPhone(item.numero)}</span></div>
      <p className="hidden lg:block text-xs text-zinc-500 truncate">{item.lastMessage || "[media]"}</p>
      <div className="hidden lg:block text-[10px]"><span className="text-cyan-400">{item.stage || "sin lead"}</span>{item.requiereHumano && <span className="block text-yellow-400">requiere humano</span>}</div>
      <div className="hidden lg:block text-[10px] text-zinc-500"><span className="block">{attributionLabel(item.source)}</span><span className="text-zinc-700">{item.campaign || "Sin campaña"}</span></div>
      <div className="text-right"><span className={`text-[9px] uppercase ${item.mode === "ai" ? "text-emerald-400" : item.mode === "human" ? "text-yellow-400" : "text-zinc-500"}`}>{item.mode}</span><time className="block text-[9px] text-zinc-700 mt-1">{new Date(item.lastActivity).toLocaleString("es-MX")}</time></div>
    </Link>)}{!conversations.length && <p className="p-10 text-center text-xs text-zinc-600">No hay conversaciones para estos filtros.</p>}</div>
  </div>;
}

