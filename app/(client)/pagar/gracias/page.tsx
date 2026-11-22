import Logo from "@/app/_components/Logo";
import type { Metadata } from "next";

export const metadata: Metadata = { robots: "noindex, nofollow" };

export default function PagarGraciasPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 px-6 text-center text-zinc-900">
      <div>
        <Logo height={34} tone="light" />
        <h1 className="mt-4 text-2xl font-semibold">Gracias</h1>
        <p className="mt-2 text-sm text-zinc-600">Estamos confirmando tu pago con el proveedor. Puedes cerrar esta ventana; te avisaremos por WhatsApp o correo en cuanto quede registrado.</p>
      </div>
    </div>
  );
}
