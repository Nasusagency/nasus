/**
 * Endpoint de prueba para diagnosticar guardar_actualizar_lead
 *
 * SOLO para desarrollo. Limpia los datos al terminar.
 *
 * POST /api/test-groq-lead → ejecuta prueba completa
 */

import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { executeToolCall } from "@/lib/whatsapp/agent-handlers";
import type { GuardarActualizarLeadInput } from "@/lib/llm/tools";

export const maxDuration = 30;

async function deleteTestLead(numero: string) {
  const supabase = createServiceClient();
  if (!supabase) return;

  try {
    await supabase.from("whatsapp_leads").delete().eq("numero", numero);
    console.log(`[TEST] Deleted test lead ${numero}`);
  } catch (err) {
    console.error("[TEST] Error deleting:", err);
  }
}

export async function POST(req: Request) {
  const testNumber = "5599999999"; // Número de prueba
  const results = [];

  try {
    console.log("\n=== TEST: guardar_actualizar_lead ===\n");

    // Limpiar antes
    await deleteTestLead(testNumber);

    // Paso 1: Crear lead
    console.log(`\n[PASO 1] Crear lead ${testNumber} como exploring`);
    const createInput: GuardarActualizarLeadInput = {
      numero: testNumber,
      nombre_empresa: "Test Company",
      sector: "retail",
      stage: "exploring",
      problema_descrito: "Quiero automatizar WhatsApp",
      servicio_probable: "automatizacion",
      resumen: "Prospecto inicial interesado en automatización",
    };

    const createResult = await executeToolCall("guardar_actualizar_lead", createInput as unknown as Record<string, unknown>);
    results.push({
      paso: "crear",
      resultado: createResult,
      esperado: (createResult as any).exito && (createResult as any).operacion === "creado",
    });
    console.log(`[PASO 1 RESULTADO]`, JSON.stringify(createResult).slice(0, 150));

    // Paso 2: Verificar que existe en BD
    console.log(`\n[PASO 2] Verificar que existe en BD`);
    const supabase = createServiceClient();
    const { data: verificacion } = await supabase
      ?.from("whatsapp_leads")
      .select("*")
      .eq("numero", testNumber)
      .single() || { data: null };

    results.push({
      paso: "verificar_existe",
      resultado: !!verificacion,
      data: verificacion ? {
        numero: verificacion.numero,
        stage: verificacion.stage,
        nombre_empresa: verificacion.nombre_empresa,
        problema_descrito: verificacion.problema_descrito,
      } : null,
    });
    console.log(`[PASO 2 RESULTADO] Encontrado:`, !!verificacion);
    if (verificacion) {
      console.log(`  → numero=${verificacion.numero}, stage=${verificacion.stage}, empresa=${verificacion.nombre_empresa}`);
    }

    // Paso 3: Actualizar lead
    console.log(`\n[PASO 3] Actualizar lead a opportunity`);
    const updateInput: GuardarActualizarLeadInput = {
      numero: testNumber,
      nombre_empresa: "Test Company - Actualizado",
      sector: "retail",
      stage: "opportunity",
      problema_descrito: "Clínica dental con 80 mensajes diarios",
      servicio_probable: "automatizacion",
      resumen: "Cliente potencial: clínica dental, alto volumen",
    };

    const updateResult = await executeToolCall("guardar_actualizar_lead", updateInput as unknown as Record<string, unknown>);
    results.push({
      paso: "actualizar",
      resultado: updateResult,
      esperado: (updateResult as any).exito && (updateResult as any).operacion === "actualizado",
    });
    console.log(`[PASO 3 RESULTADO]`, JSON.stringify(updateResult).slice(0, 150));

    // Paso 4: Verificar que se actualizó
    console.log(`\n[PASO 4] Verificar que se actualizó`);
    const { data: verificacion2 } = await supabase
      ?.from("whatsapp_leads")
      .select("*")
      .eq("numero", testNumber)
      .single() || { data: null };

    results.push({
      paso: "verificar_actualizado",
      resultado: !!verificacion2 && verificacion2.stage === "opportunity",
      data: verificacion2 ? {
        numero: verificacion2.numero,
        stage: verificacion2.stage,
        nombre_empresa: verificacion2.nombre_empresa,
      } : null,
    });
    console.log(`[PASO 4 RESULTADO] Actualizado correctamente:`, verificacion2?.stage === "opportunity");
    if (verificacion2) {
      console.log(`  → numero=${verificacion2.numero}, stage=${verificacion2.stage}, empresa=${verificacion2.nombre_empresa}`);
    }

    // Limpiar después
    console.log(`\n[LIMPIEZA] Eliminando lead de prueba`);
    await deleteTestLead(testNumber);

    const allPassed = results.every((r) => r.resultado === true || r.esperado === true);
    console.log(`\n=== TEST ${allPassed ? "EXITOSO ✓" : "FALLIDO ✗"} ===\n`);

    return NextResponse.json({
      exito: allPassed,
      pasos: results,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error("[TEST] Exception:", err);
    return NextResponse.json(
      {
        exito: false,
        error: err instanceof Error ? err.message : String(err),
        results,
      },
      { status: 500 }
    );
  }
}
