import { getCambios, getClientes } from "@/lib/admin/data";
import CambiosClient from "./CambiosClient";

export default function CambiosPage() {
  const cambios = getCambios();
  const clientes = getClientes();

  return (
    <div className="p-8 max-w-3xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-mono font-bold text-zinc-100">
            Control de cambios
          </h1>
          <p className="text-xs text-zinc-500 mt-0.5">{cambios.length} solicitudes</p>
        </div>
      </div>

      <CambiosClient
        cambiosInit={cambios}
        clientes={clientes.map((c) => ({ slug: c.slug, nombre: c.nombre }))}
      />
    </div>
  );
}
