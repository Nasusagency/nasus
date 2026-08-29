export const PRICING_CATEGORIES = [
  "development", "design", "frontend", "backend", "api_integration",
  "configuration", "qa", "infrastructure", "ai_usage", "third_party",
] as const;

export type PricingCategory = (typeof PRICING_CATEGORIES)[number];
export type PricingUnit = "hour" | "fixed" | "month" | "usage";

export type PricingRate = {
  category: PricingCategory;
  label: string;
  unit: PricingUnit;
  unitLabel: string;
  rate: number | null;
  marginPct: number;
  active?: boolean;
};

export type PricingProfile = {
  id: string;
  name: string;
  currency: string;
  contingencyPct: number;
  taxPct: number;
  taxLabel: string;
  fiscalConfig?: Record<string, unknown>;
  rates: PricingRate[];
};

export type QuoteLineInput = {
  id?: string;
  category: PricingCategory;
  description: string;
  unit: PricingUnit;
  quantity: number;
  hours: number;
  unitRate: number;
  directCost: number;
  externalCost: number;
  marginPct: number;
  notes?: string;
  source?: "llm" | "human";
};

export type CalculatedQuoteLine = QuoteLineInput & {
  laborCost: number;
  marginAmount: number;
  lineSubtotal: number;
};

export type QuoteCalculation = {
  lines: CalculatedQuoteLine[];
  directCost: number;
  externalCost: number;
  marginAmount: number;
  contingencyAmount: number;
  subtotal: number;
  taxAmount: number;
  total: number;
};

export class PricingValidationError extends Error {
  constructor(public readonly issues: string[]) {
    super(issues.join("; "));
    this.name = "PricingValidationError";
  }
}

export function money(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function finiteNonNegative(value: number, field: string, issues: string[]): number {
  if (!Number.isFinite(value) || value < 0) issues.push(`${field} debe ser un número no negativo`);
  return value;
}

export function calculateQuote(
  lines: QuoteLineInput[],
  config: Pick<PricingProfile, "contingencyPct" | "taxPct">,
): QuoteCalculation {
  const issues: string[] = [];
  finiteNonNegative(config.contingencyPct, "contingencia", issues);
  finiteNonNegative(config.taxPct, "impuestos", issues);
  if (config.contingencyPct > 100) issues.push("contingencia no puede exceder 100%");
  if (config.taxPct > 100) issues.push("impuestos no pueden exceder 100%");
  if (!lines.length) issues.push("la cotización requiere al menos una partida");

  const calculated = lines.map((line, index): CalculatedQuoteLine => {
    const prefix = `partida ${index + 1}`;
    finiteNonNegative(line.quantity, `${prefix} cantidad`, issues);
    finiteNonNegative(line.hours, `${prefix} horas`, issues);
    finiteNonNegative(line.unitRate, `${prefix} tarifa`, issues);
    finiteNonNegative(line.directCost, `${prefix} costo directo`, issues);
    finiteNonNegative(line.externalCost, `${prefix} costo externo`, issues);
    finiteNonNegative(line.marginPct, `${prefix} margen`, issues);
    if (line.marginPct > 100) issues.push(`${prefix} margen no puede exceder 100%`);
    const billableQuantity = line.unit === "hour" ? line.hours : line.quantity;
    const laborCost = money(billableQuantity * line.unitRate);
    const costBase = money(laborCost + line.directCost + line.externalCost);
    const marginAmount = money(costBase * (line.marginPct / 100));
    return { ...line, laborCost, marginAmount, lineSubtotal: money(costBase + marginAmount) };
  });
  if (issues.length) throw new PricingValidationError(issues);

  const directCost = money(calculated.reduce((sum, line) => sum + line.laborCost + line.directCost, 0));
  const externalCost = money(calculated.reduce((sum, line) => sum + line.externalCost, 0));
  const marginAmount = money(calculated.reduce((sum, line) => sum + line.marginAmount, 0));
  const beforeContingency = money(directCost + externalCost + marginAmount);
  const contingencyAmount = money(beforeContingency * (config.contingencyPct / 100));
  const subtotal = money(beforeContingency + contingencyAmount);
  const taxAmount = money(subtotal * (config.taxPct / 100));
  return { lines: calculated, directCost, externalCost, marginAmount, contingencyAmount, subtotal, taxAmount, total: money(subtotal + taxAmount) };
}

export function lineFromRate(input: {
  category: PricingCategory;
  description: string;
  estimatedHours?: number;
  quantity?: number;
  notes?: string;
}, rate: PricingRate): QuoteLineInput {
  if (rate.rate === null || !Number.isFinite(rate.rate)) {
    throw new PricingValidationError([`La tarifa de ${rate.label} no está configurada`]);
  }
  return {
    category: input.category, description: input.description.trim(), unit: rate.unit,
    quantity: rate.unit === "hour" ? 0 : Math.max(0, input.quantity ?? 1),
    hours: rate.unit === "hour" ? Math.max(0, input.estimatedHours ?? 0) : 0,
    unitRate: rate.rate, directCost: 0, externalCost: 0, marginPct: rate.marginPct,
    notes: input.notes, source: "llm",
  };
}
