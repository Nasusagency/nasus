import type { Metadata } from "next";

export const metadata: Metadata = { robots: "noindex, nofollow" };

export default function PagarGraciasPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 px-6 text-center text-zinc-900">
      <div>
        <span className="font-mono text-sm font-bold tracking-widest text-[#c4a882]">NASUS</span>
        <h1 className="mt-4 text-2xl font-semibold">Gracias</h1>
        <p className="mt-2 text-sm text-zinc-600">Estamos confirmando tu pago con el proveedor. Puedes cerrar esta ventana; te avisaremos por WhatsApp o correo en cuanto quede registrado.</p>
      </div>
    </div>
  );
}
