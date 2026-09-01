import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPaymentByPublicToken } from "@/lib/crm/payments";

// Lee el estado del pago vía service role (sin cookies()), lo que no
// auto-opta a Next a render dinámico: sin esto, Next cachearía el HTML
// en el primer build y el estado del pago quedaría congelado.
export const dynamic = "force-dynamic";

export const metadata: Metadata = { robots: "noindex, nofollow" };

const money = (value: number, currency: string) => `${currency} ${value.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const statusCopy: Record<string, { title: string; tone: string }> = {
  pending: { title: "Pago pendiente", tone: "text-amber-700 bg-amber-50 border-amber-200" },
  paid: { title: "Pago confirmado", tone: "text-emerald-700 bg-emerald-50 border-emerald-200" },
  failed: { title: "Pago rechazado", tone: "text-red-700 bg-red-50 border-red-200" },
  cancelled: { title: "Pago cancelado", tone: "text-zinc-700 bg-zinc-100 border-zinc-200" },
  refunded: { title: "Pago reembolsado", tone: "text-zinc-700 bg-zinc-100 border-zinc-200" },
};

export default async function PagarPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const payment = await getPaymentByPublicToken(token);
  if (!payment) notFound();
  const status = statusCopy[payment.status as string] ?? statusCopy.pending;

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900">
      <header className="border-b border-zinc-200 bg-white px-6 py-4">
        <div className="mx-auto flex max-w-lg items-center justify-between">
          <span className="font-mono text-sm font-bold tracking-widest text-[#c4a882]">NASUS</span>
          <span className="text-xs text-zinc-400">Pago seguro</span>
        </div>
      </header>
      <main className="mx-auto max-w-lg px-6 py-12">
        <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${status.tone}`}>{status.title}</span>
        <h1 className="mt-4 text-2xl font-semibold">{payment.description}</h1>
        <strong className="mt-2 block text-3xl">{money(Number(payment.amount), String(payment.currency))}</strong>
        {payment.due_at && payment.status === "pending" && <p className="mt-1 text-xs text-zinc-500">Vence el {new Date(payment.due_at as string).toLocaleDateString("es-MX")}</p>}
        {payment.status === "pending" && payment.payment_url && (
          <a href={payment.payment_url as string} className="mt-8 inline-block rounded-xl bg-[#050508] px-6 py-3 font-mono text-sm text-[#c4a882] transition-colors hover:bg-zinc-800">Pagar ahora →</a>
        )}
        {payment.status === "paid" && <p className="mt-8 text-sm text-zinc-600">Gracias, tu pago fue confirmado. El equipo de Nasus ya tiene el registro.</p>}
        {(payment.status === "failed" || payment.status === "cancelled") && (
          <p className="mt-8 text-sm text-zinc-600">Este intento no se completó. Contacta a Nasus Agency para generar un nuevo link de pago.</p>
        )}
      </main>
      <footer className="mt-12 border-t border-zinc-200 px-6 py-6">
        <div className="mx-auto max-w-lg">
          <p className="text-xs text-zinc-400">© Nasus Agency · nasusagency@gmail.com · nasus.lat</p>
        </div>
      </footer>
    </div>
  );
}
