/**
 * Reset de UN contacto de WhatsApp para poder correr un E2E "desde cero".
 *
 * Borra únicamente lo relacionado con el número recibido: whatsapp_leads,
 * whatsapp_mensajes, whatsapp_conversations, whatsapp_requerimientos,
 * crm_proposals/crm_activities/crm_suggestions (vía cascade + borrado
 * explícito en la función SQL), whatsapp_clientes, el acquisition_event
 * enlazado exclusivamente a ese lead, y las idempotency_keys de
 * registrar_requerimiento que se pueden recomputar con certeza.
 *
 * El input puede venir en cualquier formato (521..., 52..., 10 dígitos
 * locales): no se asume cuál es el "correcto". Se prueban las variantes
 * seguras (ver lib/whatsapp/qa-reset-candidates.ts) contra el preview
 * (solo lectura) y se resuelve al número real almacenado ANTES de borrar
 * nada. Si más de una variante tiene registros, se aborta por ambigüedad.
 *
 * El borrado real ocurre dentro de public.qa_reset_contact(), una función
 * plpgsql (supabase/migrations/0009_qa_reset_contact.sql) que corre como una
 * sola transacción implícita en Postgres y está restringida a service_role.
 *
 * Uso:
 *   npm run qa:reset-contact -- 3331002790            (dry-run: solo preview)
 *   npm run qa:reset-contact -- 3331002790 --yes       (ejecuta el borrado)
 *
 * Requiere además QA_RESET_CONFIRM=1 en el entorno para el borrado real,
 * como segunda confirmación explícita e independiente del flag --yes.
 *
 * Nunca imprime el número completo: todo el output usa maskPhoneNumber.
 */

import { createServiceClient } from "@/lib/supabase/service";
import { maskPhoneNumber } from "@/lib/whatsapp/groq-allowlist";
import { hashContent } from "@/lib/whatsapp/agent-handlers";
import { resolveContactNumero, totalRows, type ContactPreview } from "@/lib/whatsapp/qa-reset-candidates";
import type { SupabaseClient } from "@supabase/supabase-js";

function printCounts(label: string, counts: Record<string, unknown>) {
  console.log(`\n[qa-reset-contact] ${label}`);
  for (const [table, value] of Object.entries(counts)) {
    console.log(`  ${table.padEnd(28)} ${value}`);
  }
}

function fetchPreviewFactory(supabase: SupabaseClient) {
  return async (numero: string): Promise<ContactPreview> => {
    const { data, error } = await supabase.rpc("qa_reset_contact_preview", { p_numero: numero });
    if (error) throw new Error(`preview_failed: ${error.message}`);
    return data as ContactPreview;
  };
}

async function main() {
  const args = process.argv.slice(2);
  const yes = args.includes("--yes");
  const rawNumero = args.find((a) => !a.startsWith("--"));

  if (!rawNumero) {
    console.error("Uso: npm run qa:reset-contact -- <numero> [--yes]");
    process.exitCode = 1;
    return;
  }

  const supabase = createServiceClient();
  if (!supabase) {
    console.error("[qa-reset-contact] faltan NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY");
    process.exitCode = 1;
    return;
  }

  const fetchPreview = fetchPreviewFactory(supabase);

  const resolution = await resolveContactNumero(rawNumero, fetchPreview);

  if (resolution.status === "invalid") {
    console.error("[qa-reset-contact] número inválido: ninguna variante sanitizada tiene 10-15 dígitos");
    process.exitCode = 1;
    return;
  }

  const maskedCandidates = resolution.candidates.map(maskPhoneNumber).join(", ");

  if (resolution.status === "empty") {
    console.log(`[qa-reset-contact] variantes probadas: ${maskedCandidates}`);
    console.log("\n[qa-reset-contact] no hay nada que borrar en ninguna variante probada.");
    return;
  }

  if (resolution.status === "ambiguous") {
    console.error(`[qa-reset-contact] variantes probadas: ${maskedCandidates}`);
    console.error(
      `[qa-reset-contact] AMBIGÜEDAD: ${resolution.candidates.length} variantes tienen registros distintos ` +
        `(${resolution.candidates.map(maskPhoneNumber).join(" / ")}). Abortando sin borrar nada.`,
    );
    console.error("  Resuelve manualmente cuál es el contacto real antes de reintentar.");
    process.exitCode = 1;
    return;
  }

  // resolution.status === "resolved": a partir de aquí SIEMPRE se usa
  // resolution.numero (el valor real encontrado), nunca el input crudo.
  const numero = resolution.numero;
  const masked = maskPhoneNumber(numero);
  console.log(`[qa-reset-contact] variantes probadas: ${maskedCandidates}`);
  console.log(`[qa-reset-contact] contacto resuelto: ${masked}`);

  printCounts("registros encontrados (antes de borrar)", { ...resolution.preview });

  if (!yes) {
    console.log("\n[qa-reset-contact] dry-run: no se borró nada. Vuelve a correr con --yes para ejecutar.");
    console.log("[qa-reset-contact] nota: idempotency_keys de notificar_humano no se pueden vincular con certeza a este");
    console.log("  número (la clave es un hash de asunto+cuerpo, sin FK ni columna de teléfono) y no se tocan aquí;");
    console.log("  expiran solas en 1 hora (expires_at por defecto). Las de registrar_requerimiento sí se recomputan");
    console.log("  y se borran porque el contenido origen (tipo + descripcion_original) sigue disponible antes del borrado.");
    return;
  }

  if (process.env.QA_RESET_CONFIRM !== "1") {
    console.error("\n[qa-reset-contact] falta confirmación: define QA_RESET_CONFIRM=1 en el entorno para ejecutar el borrado real.");
    console.error("  Esto es intencional: --yes solo no es suficiente para borrar datos.");
    process.exitCode = 1;
    return;
  }

  // Las keys de registrar_requerimiento se recomputan ANTES del borrado,
  // mientras los requerimientos todavía existen para leer tipo/descripcion_original.
  // Se usa el número resuelto, no el input crudo.
  const { data: requerimientos } = await supabase
    .from("whatsapp_requerimientos")
    .select("tipo,descripcion_original")
    .eq("numero_contacto", numero);

  const idempotencyKeysToDelete = (requerimientos ?? []).map(
    (r: { tipo: string; descripcion_original: string }) =>
      `req_${hashContent(`${numero}:${r.tipo}:${r.descripcion_original}`)}`,
  );

  console.log(`\n[qa-reset-contact] ejecutando borrado para ${masked}...`);
  const { data: deleted, error: deleteError } = await supabase.rpc("qa_reset_contact", {
    p_numero: numero,
  });
  if (deleteError) {
    console.error("[qa-reset-contact] error al borrar:", deleteError.message);
    process.exitCode = 1;
    return;
  }
  printCounts("registros borrados", deleted as Record<string, number>);

  let idempotencyDeleted = 0;
  if (idempotencyKeysToDelete.length > 0) {
    const { error: idempError, count } = await supabase
      .from("idempotency_keys")
      .delete({ count: "exact" })
      .in("key", idempotencyKeysToDelete)
      .eq("tool_name", "registrar_requerimiento");
    if (idempError) {
      console.warn("[qa-reset-contact] no se pudieron borrar idempotency_keys de requerimientos (no bloqueante):", idempError.message);
    } else {
      idempotencyDeleted = count ?? 0;
    }
  }
  console.log(`  idempotency_keys (registrar_requerimiento) ${idempotencyDeleted}`);
  console.log("  idempotency_keys (notificar_humano)         no reconstruibles; expiran solas en <=1h");

  // Verificación posterior: SIEMPRE contra el mismo número resuelto.
  const afterCounts = await fetchPreview(numero);
  printCounts("verificación posterior (debe ser todo 0 / false)", { ...afterCounts });

  if (totalRows(afterCounts) === 0 && afterCounts.lead_found === false) {
    console.log(`\n[qa-reset-contact] OK: ${masked} quedó completamente limpio. Listo para un E2E desde cero.`);
  } else {
    console.error(`\n[qa-reset-contact] ADVERTENCIA: quedaron registros sin borrar para ${masked}. Revisa manualmente.`);
    process.exitCode = 1;
  }
}

void main();
