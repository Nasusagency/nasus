export type PhotoType = "pasaporte-mx" | "visa-usa" | "escolar";
export type PhotoVerdict = "APTA" | "NO_APTA" | "REVISAR";
export type PhotoTolerance = "strict" | "medium" | "flexible";

export interface PhotoRule {
  id: string;
  label: string;
  description: string;
  required: boolean;
}

export interface RuleResult {
  pass: boolean;
  note?: string;
}

export interface PhotoAnalysisResult {
  photoType: PhotoType;
  verdict: PhotoVerdict;
  issues: string[];
  suggestions: string[];
  ruleResults: Record<string, RuleResult>;
}

export interface PhotoConfig {
  id: PhotoType;
  name: string;
  description: string;
  institution?: string;
  tolerance: PhotoTolerance;
  rules: PhotoRule[];
  systemPrompt: string;
}

export function buildSystemPromptFromRules(config: PhotoConfig): string {
  const rulesJson = config.rules
    .map((r) => `    "${r.id}": { "pass": boolean, "note": string }`)
    .join(",\n");

  const ruleDescriptions = config.rules
    .map(
      (r) =>
        `- ${r.id} (${r.required ? "REQUERIDO" : "opcional"}): ${r.description}`
    )
    .join("\n");

  return `Eres un experto en validación de fotografías oficiales para documentos.

Analiza la fotografía proporcionada y evalúa si cumple los requisitos para: ${config.name}.
${config.institution ? `Institución: ${config.institution}` : ""}

REGLAS A EVALUAR:
${ruleDescriptions}

Responde ÚNICAMENTE con un objeto JSON válido con este esquema exacto:
{
  "photoType": "${config.id}",
  "apt": boolean,
  "rules": {
${rulesJson}
  },
  "issues": string[],
  "suggestions": string[]
}

Instrucciones:
- "apt": true solo si TODAS las reglas REQUERIDAS tienen "pass": true.
- "issues": lista de problemas encontrados en lenguaje natural (ej. "El fondo no es blanco").
- "suggestions": sugerencias específicas de corrección (ej. "Usa un fondo blanco liso sin sombras").
- "note" en cada regla: descripción breve de lo que observas (vacío "" si pasa sin observaciones).
- Sé preciso. No inventes problemas que no existen. Si un aspecto no es evaluable, márcalo como pass: true con nota "no evaluable visualmente".`;
}
