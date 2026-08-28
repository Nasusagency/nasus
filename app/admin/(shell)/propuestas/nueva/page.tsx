import { Suspense } from "react";
import { getCrmContactOptions } from "@/lib/admin/crm-data";
import PropuestasNuevaForm from "./PropuestasNuevaForm";

export default async function NuevaPropuestaPage() {
  const clientes = (await getCrmContactOptions()).map((c) => ({ slug: c.id, nombre: c.nombre }));

  return (
    <Suspense>
      <PropuestasNuevaForm clientes={clientes} />
    </Suspense>
  );
}
