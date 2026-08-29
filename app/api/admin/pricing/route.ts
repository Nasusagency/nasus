import { NextRequest, NextResponse } from "next/server";
import { ADMIN_COOKIE, verifyAdminToken } from "@/lib/admin/auth";
import { getActivePricingProfile, updateActivePricingProfile } from "@/lib/crm/quotes";
import { PRICING_CATEGORIES, type PricingRate, type PricingUnit } from "@/lib/crm/pricing";

async function authorized(request: NextRequest) {
  const token = request.cookies.get(ADMIN_COOKIE)?.value;
  return Boolean(token && await verifyAdminToken(token));
}
const numeric = (value: unknown): number | null | undefined => {
  if (value === "" || value === null) return null;
  const parsed = Number(value); return Number.isFinite(parsed) ? parsed : undefined;
};

export async function GET(request: NextRequest) {
  if (!(await authorized(request))) return NextResponse.json({}, { status: 401 });
  return NextResponse.json(await getActivePricingProfile());
}

export async function PUT(request: NextRequest) {
  if (!(await authorized(request))) return NextResponse.json({}, { status: 401 });
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!body || !Array.isArray(body.rates)) return NextResponse.json({ error: "Configuración inválida" }, { status: 400 });
  const rates: PricingRate[] = [];
  for (const raw of body.rates) {
    if (!raw || typeof raw !== "object") return NextResponse.json({ error: "Tarifa inválida" }, { status: 400 });
    const value = raw as Record<string, unknown>; const category = String(value.category); const unit = String(value.unit) as PricingUnit;
    const rate = numeric(value.rate); const marginPct = numeric(value.marginPct);
    if (!PRICING_CATEGORIES.includes(category as PricingRate["category"]) || !["hour", "fixed", "month", "usage"].includes(unit) || rate === undefined || marginPct === null || marginPct === undefined) return NextResponse.json({ error: "Tarifa inválida" }, { status: 400 });
    rates.push({ category: category as PricingRate["category"], label: String(value.label ?? "").slice(0, 160), unit, unitLabel: String(value.unitLabel ?? "").slice(0, 80), rate, marginPct, active: value.active !== false });
  }
  const fiscalConfig = body.fiscalConfig && typeof body.fiscalConfig === "object" ? body.fiscalConfig as Record<string, unknown> : {};
  const result = await updateActivePricingProfile({ name: String(body.name ?? ""), currency: String(body.currency ?? "").toUpperCase(), contingencyPct: Number(body.contingencyPct), taxPct: Number(body.taxPct), taxLabel: String(body.taxLabel ?? ""), fiscalConfig, rates, actorUserId: process.env.ADMIN_ACTOR || "admin" });
  return NextResponse.json(result, { status: result.ok ? 200 : 400 });
}
