import Link from "next/link";
import type { AdminLead } from "@/lib/admin/acquisition-data";
import { maskPhone } from "@/lib/acquisition/attribution";
import { Badge, type BadgeTone } from "../_ui/Badge";
import RestoreLeadAction from "./RestoreLeadAction";

const LIFECYCLE_TONE: Record<string, BadgeTone> = { lead: "neutral", client: "success", former_client: "warning" };
const STAGE_TONE: Record<string, BadgeTone> = { exploring: "neutral", opportunity: "info", qualified: "info", proposal: "warning", won: "success", lost: "danger" };

const fecha = (value: string) => new Date(value).toLocaleString("es-MX", { dateStyle: "short", timeStyle: "short" });

/**
 * Listado de contactos. En celular, tarjetas apiladas (toda la tarjeta es tocable y
 * no hay scroll horizontal); desde md, la tabla completa con todas las columnas.
 */
export default function LeadsList({ leads, archived }: { leads: AdminLead[]; archived: boolean }) {
  return <>
    <ul className="md:hidden space-y-3">
      {leads.map(l => <li key={l.id} className="rounded-xl border border-zinc-200 bg-white">
        <Link href={`/admin/leads/${l.id}`} className="block p-4 active:bg-amber-50/40">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-[#76582f]">{l.nombre_contacto || "Sin nombre"}</p>
              <p className="text-xs text-zinc-500">{maskPhone(l.numero)}{l.nombre_empresa ? ` · ${l.nombre_empresa}` : ""}</p>
            </div>
            <Badge tone={STAGE_TONE[l.stage] ?? "neutral"}>{l.stage}</Badge>
          </div>
          <div className="mt-3 flex flex-wrap gap-1.5">
            <Badge tone={LIFECYCLE_TONE[l.lifecycle] ?? "neutral"}>{l.lifecycle}</Badge>
            {l.high_intent_detected_at && <Badge tone="warning">High intent</Badge>}
            {l.requiere_humano && <Badge tone="danger">Requiere humano</Badge>}
          </div>
          <div className="mt-3 flex items-center justify-between gap-3 text-[11px] text-zinc-500">
            <span className="truncate">{l.source || "Sin atribución"}{l.campaign ? ` · ${l.campaign}` : ""}</span>
            <time className="shrink-0">{fecha(l.ultima_interaccion)}</time>
          </div>
        </Link>
        {archived && <div className="border-t border-zinc-100 px-4 py-3"><RestoreLeadAction leadId={l.id} /></div>}
      </li>)}
    </ul>

    <div className="hidden md:block overflow-x-auto border border-zinc-200 bg-white rounded-xl"><table className="w-full text-xs"><thead className="bg-zinc-50 text-zinc-600"><tr>{["Contacto", "Teléfono", "Empresa / sector", "Fuente / campaña", "Lifecycle", "Stage", "Señales", "Última interacción", ...(archived ? ["Acciones"] : [])].map(h => <th key={h} className="text-left font-medium px-3 py-3">{h}</th>)}</tr></thead><tbody>{leads.map(l => <tr key={l.id} className="border-t border-zinc-100 align-top hover:bg-amber-50/30"><td className="px-3 py-3"><Link href={`/admin/leads/${l.id}`} className="font-medium text-[#76582f]">{l.nombre_contacto || "Sin nombre"}</Link></td><td className="px-3 py-3 text-zinc-600">{maskPhone(l.numero)}</td><td className="px-3 py-3 text-zinc-700">{l.nombre_empresa || "—"}<br/><span className="text-zinc-500">{l.sector || "—"}</span></td><td className="px-3 py-3 text-zinc-700">{l.source || "Sin atribución"}<br/><span className="text-zinc-500">{l.campaign || "—"}</span></td><td className="px-3 py-3"><Badge tone={LIFECYCLE_TONE[l.lifecycle] ?? "neutral"}>{l.lifecycle}</Badge></td><td className="px-3 py-3"><Badge tone={STAGE_TONE[l.stage] ?? "neutral"}>{l.stage}</Badge></td><td className="px-3 py-3 space-y-1">{l.high_intent_detected_at && <Badge tone="warning">High intent</Badge>}{l.requiere_humano && <Badge tone="danger" className="block w-fit">Requiere humano</Badge>}</td><td className="px-3 py-3 text-zinc-500">{fecha(l.ultima_interaccion)}</td>{archived && <td className="px-3 py-3"><RestoreLeadAction leadId={l.id} /></td>}</tr>)}</tbody></table></div>
  </>;
}
