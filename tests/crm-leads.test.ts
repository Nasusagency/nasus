import assert from "node:assert/strict";
import { describe, test } from "node:test";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createManualLead, archiveLead, unarchiveLead, getLeadRelationsSummary } from "../lib/crm/leads";

type Row = Record<string, unknown>;

/**
 * Fake Supabase client mínimo, suficiente para las operaciones que usa
 * lib/crm/leads.ts: select/in/eq/is/not, insert, update, upsert (con
 * dedup por idempotency_key, igual que tests/crm-payments.test.ts), y
 * select(..., { count: "exact", head: true }) para los conteos de relaciones.
 */
function makeFakeClient(tables: Record<string, Row[]> = {}) {
  let nextId = 1;

  function builder(table: string) {
    const rows = tables[table] || (tables[table] = []);
    let mode: "select" | "insert" | "update" = "select";
    let payload: Row | null = null;
    let countMode = false;
    const filters: Array<(r: Row) => boolean> = [];

    async function execute(): Promise<{ data: Row[] | null; error: null; count?: number }> {
      if (mode === "insert" && payload) {
        const row: Row = { id: payload.id ?? `lead-${nextId++}`, ...payload };
        rows.push(row);
        return { data: [row], error: null };
      }
      const matched = rows.filter((r) => filters.every((f) => f(r)));
      if (mode === "update" && payload) {
        matched.forEach((r) => Object.assign(r, payload));
      }
      if (countMode) return { data: null, error: null, count: matched.length };
      return { data: matched, error: null };
    }

    const b: any = {
      select(_cols?: string, opts?: { count?: string; head?: boolean }) {
        if (opts?.count) countMode = true;
        return b;
      },
      insert(row: Row) {
        mode = "insert";
        payload = row;
        return b;
      },
      update(patch: Row) {
        mode = "update";
        payload = patch;
        return b;
      },
      eq(col: string, val: unknown) {
        filters.push((r) => r[col] === val);
        return b;
      },
      in(col: string, vals: unknown[]) {
        filters.push((r) => vals.includes(r[col]));
        return b;
      },
      is(col: string, val: null) {
        filters.push((r) => (r[col] ?? null) === val);
        return b;
      },
      not(col: string, op: string, val: unknown) {
        if (op === "is") filters.push((r) => (r[col] ?? null) !== val);
        return b;
      },
      async upsert(row: Row) {
        if (row.idempotency_key && rows.some((r) => r.idempotency_key === row.idempotency_key)) {
          return { data: null, error: null };
        }
        const saved = { id: row.id ?? `activity-${nextId++}`, ...row };
        rows.push(saved);
        return { data: saved, error: null };
      },
      async maybeSingle() {
        const result = await execute();
        return { data: (result.data ?? [])[0] ?? null, error: result.error };
      },
      async single() {
        const result = await execute();
        const data = (result.data ?? [])[0] ?? null;
        return { data, error: data ? result.error : { message: "no_rows" } };
      },
      then(resolve: (v: unknown) => unknown, reject: (e: unknown) => unknown) {
        return execute().then(resolve, reject);
      },
    };
    return b;
  }

  return { from: builder } as unknown as SupabaseClient;
}

describe("CRUD manual de leads — creación", () => {
  test("crea un lead manual con source=admin y lo registra en crm_activities", async () => {
    const client = makeFakeClient();
    const result = await createManualLead(
      { numero: "5213331002790", nombreContacto: "Ana", nombreEmpresa: "Café Norte", necesidad: "Automatizar pedidos", actorUserId: "admin" },
      client
    );
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.lead.numero, "523331002790", "normaliza 521 -> 52 igual que el resto del sistema");
    assert.equal(result.lead.lifecycle, "lead");

    const activities = await (client.from("crm_activities") as any).select();
    const created = (activities.data as Row[]).find((a) => a.event_type === "manual_contact_created");
    assert.ok(created, "debe quedar una actividad manual_contact_created");
    assert.equal(created!.source, "admin");
    assert.equal(created!.actor_user_id, "admin");
  });

  test("rechaza un teléfono con formato inválido sin tocar la base", async () => {
    const client = makeFakeClient();
    const result = await createManualLead({ numero: "abc", actorUserId: "admin" }, client);
    assert.deepEqual(result, { ok: false, error: "invalid_phone" });
  });

  test("rechaza duplicado por número (misma identidad canónica que WhatsApp)", async () => {
    const client = makeFakeClient({ whatsapp_leads: [{ id: "lead-1", numero: "523331002790", archived_at: null }] });
    const result = await createManualLead({ numero: "523331002790", actorUserId: "admin" }, client);
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal(result.error, "duplicate");
  });

  test("detecta duplicado incluso con la variante histórica 521 del mismo número", async () => {
    const client = makeFakeClient({ whatsapp_leads: [{ id: "lead-1", numero: "5213331002790", archived_at: null }] });
    const result = await createManualLead({ numero: "523331002790", actorUserId: "admin" }, client);
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal(result.error, "duplicate");
  });

  test("distingue un duplicado archivado, para sugerir restaurar en vez de crear otro", async () => {
    const client = makeFakeClient({ whatsapp_leads: [{ id: "lead-1", numero: "523331002790", archived_at: "2026-01-01T00:00:00Z" }] });
    const result = await createManualLead({ numero: "523331002790", actorUserId: "admin" }, client);
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal(result.error, "duplicate_archived");
  });
});

describe("CRUD manual de leads — archivar / restaurar (soft-delete)", () => {
  test("archiva un lead existente y registra la actividad", async () => {
    const client = makeFakeClient({ whatsapp_leads: [{ id: "lead-1", archived_at: null }] });
    const result = await archiveLead({ contactId: "lead-1", actorUserId: "admin" }, client);
    assert.deepEqual(result, { ok: true, alreadyArchived: false });

    const lead = await (client.from("whatsapp_leads") as any).select().eq("id", "lead-1").maybeSingle();
    assert.ok(lead.data.archived_at, "archived_at debe quedar poblado");
    assert.equal(lead.data.archived_by, "admin");

    const activities = await (client.from("crm_activities") as any).select();
    assert.ok((activities.data as Row[]).some((a) => a.event_type === "contact_archived"));
  });

  test("archivar un contacto inexistente no crea nada", async () => {
    const client = makeFakeClient();
    const result = await archiveLead({ contactId: "no-existe", actorUserId: "admin" }, client);
    assert.deepEqual(result, { ok: false, error: "contact_not_found" });
  });

  test("archivar dos veces es idempotente (no falla, no duplica actividad)", async () => {
    const client = makeFakeClient({ whatsapp_leads: [{ id: "lead-1", archived_at: null }] });
    await archiveLead({ contactId: "lead-1", actorUserId: "admin" }, client);
    const second = await archiveLead({ contactId: "lead-1", actorUserId: "admin" }, client);
    assert.deepEqual(second, { ok: true, alreadyArchived: true });
    const activities = await (client.from("crm_activities") as any).select();
    const archivedEvents = (activities.data as Row[]).filter((a) => a.event_type === "contact_archived");
    assert.equal(archivedEvents.length, 1, "no debe duplicar la actividad de archivado");
  });

  test("restaura un lead archivado", async () => {
    const client = makeFakeClient({ whatsapp_leads: [{ id: "lead-1", archived_at: "2026-01-01T00:00:00Z", archived_by: "admin" }] });
    const result = await unarchiveLead({ contactId: "lead-1", actorUserId: "admin" }, client);
    assert.deepEqual(result, { ok: true });
    const lead = await (client.from("whatsapp_leads") as any).select().eq("id", "lead-1").maybeSingle();
    assert.equal(lead.data.archived_at, null);
  });

  test("restaurar un lead que no está archivado no hace nada (evita falsos positivos de éxito)", async () => {
    const client = makeFakeClient({ whatsapp_leads: [{ id: "lead-1", archived_at: null }] });
    const result = await unarchiveLead({ contactId: "lead-1", actorUserId: "admin" }, client);
    assert.deepEqual(result, { ok: false, error: "contact_not_found_or_not_archived" });
  });
});

describe("CRUD manual de leads — advertencia antes de archivar con relaciones", () => {
  test("getLeadRelationsSummary cuenta cotizaciones, propuestas y pagos del contacto, ninguno de otro contacto", async () => {
    const client = makeFakeClient({
      crm_quotes: [{ id: "q1", contact_id: "lead-1" }, { id: "q2", contact_id: "lead-2" }],
      crm_proposals: [{ id: "p1", contact_id: "lead-1" }],
      crm_payments: [{ id: "pay1", contact_id: "lead-1" }, { id: "pay2", contact_id: "lead-1" }],
    });
    const summary = await getLeadRelationsSummary("lead-1", client);
    assert.deepEqual(summary, { quotes: 1, proposals: 1, payments: 2 });
  });

  test("un contacto sin relaciones no bloquea nada: archivar es siempre no destructivo", async () => {
    const client = makeFakeClient({ whatsapp_leads: [{ id: "lead-1", archived_at: null }] });
    const summary = await getLeadRelationsSummary("lead-1", client);
    assert.deepEqual(summary, { quotes: 0, proposals: 0, payments: 0 });
    // No hay ruta de hard-delete en el sistema: archivar nunca borra crm_quotes/crm_proposals/crm_payments.
    const result = await archiveLead({ contactId: "lead-1", actorUserId: "admin" }, client);
    assert.equal(result.ok, true);
  });
});
