import FacturasForm from "@/components/facturas/FacturasForm";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Nasus Facturas — Extractor de Facturas Google Ads y Meta Ads a Excel",
  description:
    "Sube tu factura de Google Ads o Meta Ads en PDF y descarga el desglose completo en Excel. Listo para contabilidad.",
};

export default function FacturasPage() {
  return (
    <div className="min-h-screen bg-[#050508] flex flex-col items-center px-4 py-16">
      <div className="w-full max-w-2xl flex flex-col gap-8">
        <div>
          <p className="text-[#00f2ff] text-xs font-mono tracking-[0.3em] uppercase mb-3">
            Nasus Facturas
          </p>
          <h1 className="text-3xl font-display font-semibold text-white tracking-tight">
            Extractor de Facturas
          </h1>
          <p className="text-sm text-zinc-500 mt-2 leading-relaxed">
            Sube tu factura de Google Ads o Meta Ads en PDF y descarga el desglose completo en Excel.
            <span className="text-zinc-600"> Desglose por campaña, cuenta y período listo para contabilidad.</span>
          </p>
          <p className="text-xs font-mono text-[#c4a882] mt-3">
            Tu factura de Google o Meta en Excel en segundos
          </p>
        </div>

        <FacturasForm />

        <p className="text-[10px] font-mono text-zinc-700 text-center">
          El PDF se procesa en memoria y no se almacena. · 3 extracciones gratuitas por sesión.
        </p>
      </div>
    </div>
  );
}
