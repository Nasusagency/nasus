import { NextRequest, NextResponse } from "next/server";
import { ADMIN_COOKIE, verifyAdminToken } from "@/lib/admin/auth";
import { createServiceClient } from "@/lib/supabase/service";

async function authorized(request: NextRequest) {
  const token = request.cookies.get(ADMIN_COOKIE)?.value;
  return Boolean(token && await verifyAdminToken(token));
}
const text = (value: unknown, max: number) => typeof value === "string" ? value.trim().slice(0, max) : "";
const nullableNumber = (value: unknown): number | null | undefined => {
  if (value === "" || value === null || value === undefined) return null;
  const number = Number(value); return Number.isFinite(number) && number >= 0 ? number : undefined;
};

export async function POST(request: NextRequest) {
  if (!(await authorized(request))) return NextResponse.json({}, { status: 401 });
  let body: Record<string, unknown>; try { body = await request.json(); } catch { return NextResponse.json({ error: "JSON inválido" }, { status: 400 }); }
  const platform = text(body.platform, 80).toLowerCase(); const campaign = text(body.campaign, 160); const metricDate = text(body.metricDate, 10);
  const currency = (text(body.currency, 3) || "MXN").toUpperCase(); const sourceType = text(body.sourceType, 10) || "manual";
  const numeric = { impressions: nullableNumber(body.impressions), ad_clicks: nullableNumber(body.adClicks), spend: nullableNumber(body.spend), daily_budget: nullableNumber(body.dailyBudget), total_budget: nullableNumber(body.totalBudget) };
  if (!platform || !campaign || !/^\d{4}-\d{2}-\d{2}$/.test(metricDate) || !/^[A-Z]{3}$/.test(currency) || !["manual", "synced"].includes(sourceType) || Object.values(numeric).some(v => v === undefined)) return NextResponse.json({ error: "Datos de campaña inválidos" }, { status: 400 });
  const supabase = createServiceClient(); if (!supabase) return NextResponse.json({ error: "Base no configurada" }, { status: 503 });
  const { data, error } = await supabase.from("acquisition_campaign_metrics").upsert({ platform, campaign, metric_date: metricDate, currency, source_type: sourceType, ...numeric, updated_at: new Date().toISOString() }, { onConflict: "platform,campaign,metric_date,source_type" }).select("id").single();
  if (error) return NextResponse.json({ error: "No se pudo guardar" }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}

export async function DELETE(request: NextRequest) {
  if (!(await authorized(request))) return NextResponse.json({}, { status: 401 });
  const id = request.nextUrl.searchParams.get("id"); if (!id || !/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: "ID inválido" }, { status: 400 });
  const supabase = createServiceClient(); if (!supabase) return NextResponse.json({ error: "Base no configurada" }, { status: 503 });
  const { error } = await supabase.from("acquisition_campaign_metrics").delete().eq("id", id).eq("source_type", "manual");
  return error ? NextResponse.json({ error: "No se pudo eliminar" }, { status: 500 }) : new NextResponse(null, { status: 204 });
}
