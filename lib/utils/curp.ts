const CURRENT_YEAR_2D = new Date().getFullYear() % 100;

export function deriveDateFromCurp(curp: unknown): string | null {
  if (typeof curp !== "string" || curp.length !== 18) return null;
  const yy = curp.slice(4, 6);
  const mm = curp.slice(6, 8);
  const dd = curp.slice(8, 10);
  if (!/^\d{2}$/.test(yy) || !/^\d{2}$/.test(mm) || !/^\d{2}$/.test(dd)) return null;
  const yyInt = parseInt(yy);
  const mmInt = parseInt(mm);
  const ddInt = parseInt(dd);
  if (mmInt < 1 || mmInt > 12 || ddInt < 1 || ddInt > 31) return null;
  const century = yyInt <= CURRENT_YEAR_2D ? "20" : "19";
  return `${century}${yy}-${mm}-${dd}`;
}

export function deriveSexFromCurp(curp: unknown): string | null {
  if (typeof curp !== "string" || curp.length !== 18) return null;
  const ch = curp[10];
  return ch === "H" || ch === "M" ? ch : null;
}
