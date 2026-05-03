import { Suspense } from "react";
import { getClientes } from "@/lib/admin/data";
import PropuestasNuevaForm from "./PropuestasNuevaForm";

export default function NuevaPropuestaPage() {
  const clientes = getClientes().map((c) => ({ slug: c.slug, nombre: c.nombre }));

  return (
    <Suspense>
      <PropuestasNuevaForm clientes={clientes} />
    </Suspense>
  );
}
