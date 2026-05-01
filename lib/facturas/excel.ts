import * as XLSX from "xlsx";
import type { FacturaExtraccion } from "./types";

function mxn(n: number) {
  return `$${n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",")}`;
}

function safeStr(v: string | null | undefined) {
  return v ?? "";
}

export function downloadExcel(data: FacturaExtraccion) {
  const wb = XLSX.utils.book_new();

  // ── Hoja 1: Resumen ─────────────────────────────────────────────
  const resumenRows: (string | number)[][] = [
    ["NASUS FACTURAS — RESUMEN"],
    [],
    ["Tipo", data.tipo === "google" ? "Google Ads" : "Meta Ads"],
    ["Número de documento", safeStr(data.numero_documento)],
    ["Fecha", safeStr(data.fecha)],
    ["Período", safeStr(data.periodo)],
    ["RFC Emisor", safeStr(data.rfc_emisor)],
    ["RFC Receptor", safeStr(data.rfc_receptor)],
    [],
    ["Subtotal", data.subtotal],
    ["IVA 16%", data.iva],
    ["Total", data.total],
    [],
    ["─── RESUMEN POR CUENTA ───"],
    ["Cuenta", "ID Cuenta", "Campañas", "Total MXN"],
  ];

  for (const c of data.cuentas) {
    resumenRows.push([
      c.nombre,
      safeStr(c.id_cuenta),
      c.campanas.length,
      c.total,
    ]);
  }

  const ws1 = XLSX.utils.aoa_to_sheet(resumenRows);

  ws1["!cols"] = [
    { wch: 28 },
    { wch: 20 },
    { wch: 12 },
    { wch: 16 },
  ];

  // Format numeric cells in column B for currency rows
  const currencyRows = [10, 11, 12]; // subtotal, iva, total (1-indexed in sheet rows 10-12)
  for (const r of currencyRows) {
    const cellAddr = XLSX.utils.encode_cell({ c: 1, r: r - 1 });
    if (ws1[cellAddr]) ws1[cellAddr].z = '"$"#,##0.00';
  }

  XLSX.utils.book_append_sheet(wb, ws1, "Resumen");

  // ── Hoja 2: Detalle de Campañas ─────────────────────────────────
  const detalleRows: (string | number | null)[][] = [
    ["Cuenta", "ID Cuenta", "Campaña", "Cantidad", "Unidades", "Importe MXN"],
  ];

  for (const cuenta of data.cuentas) {
    for (const camp of cuenta.campanas) {
      detalleRows.push([
        cuenta.nombre,
        cuenta.id_cuenta ?? "",
        camp.nombre,
        camp.cantidad ?? "",
        camp.unidades ?? "",
        camp.importe,
      ]);
    }
    // Subtotal row per account
    detalleRows.push([
      `SUBTOTAL — ${cuenta.nombre}`,
      "",
      "",
      "",
      "",
      cuenta.subtotal,
    ]);
  }

  // Grand total row
  detalleRows.push(["", "", "", "", "IVA 16%", data.iva]);
  detalleRows.push(["", "", "", "", "TOTAL GENERAL", data.total]);

  const ws2 = XLSX.utils.aoa_to_sheet(detalleRows);

  ws2["!cols"] = [
    { wch: 30 },
    { wch: 18 },
    { wch: 40 },
    { wch: 12 },
    { wch: 14 },
    { wch: 16 },
  ];

  // Format importe column (col index 5) for currency
  const range = XLSX.utils.decode_range(ws2["!ref"] ?? "A1");
  for (let row = 1; row <= range.e.r; row++) {
    const cellAddr = XLSX.utils.encode_cell({ c: 5, r: row });
    if (ws2[cellAddr] && typeof ws2[cellAddr].v === "number") {
      ws2[cellAddr].z = '"$"#,##0.00';
    }
  }

  XLSX.utils.book_append_sheet(wb, ws2, "Detalle de Campañas");

  // ── Hoja 3: Para Contabilidad ────────────────────────────────────
  const contabRows: (string | number)[][] = [
    ["Período", "RFC Emisor", "RFC Receptor", "Subtotal", "IVA 16%", "Total"],
    [
      safeStr(data.periodo),
      safeStr(data.rfc_emisor),
      safeStr(data.rfc_receptor),
      data.subtotal,
      data.iva,
      data.total,
    ],
  ];

  const ws3 = XLSX.utils.aoa_to_sheet(contabRows);

  ws3["!cols"] = [
    { wch: 24 },
    { wch: 18 },
    { wch: 18 },
    { wch: 16 },
    { wch: 16 },
    { wch: 16 },
  ];

  // Format currency cells in row 2 (cols 3-5)
  for (let c = 3; c <= 5; c++) {
    const cellAddr = XLSX.utils.encode_cell({ c, r: 1 });
    if (ws3[cellAddr]) ws3[cellAddr].z = '"$"#,##0.00';
  }

  XLSX.utils.book_append_sheet(wb, ws3, "Para Contabilidad");

  // ── Download ─────────────────────────────────────────────────────
  const periodo = (data.periodo ?? "sin-periodo")
    .replace(/\s+/g, "-")
    .replace(/[/\\]/g, "-")
    .replace(/[^a-zA-Z0-9-_áéíóúÁÉÍÓÚ]/g, "");
  const rfc = (data.rfc_receptor ?? "sin-rfc").replace(/[^A-Z0-9]/gi, "");
  const filename = `Nasus_Facturas_${periodo}_${rfc}.xlsx`;

  const buf = XLSX.write(wb, { type: "array", bookType: "xlsx" });
  const blob = new Blob([buf], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function formatMXN(n: number) {
  return mxn(n);
}
