export const CRM_LIFECYCLES = ["lead", "client", "former_client"] as const;
export const CRM_STAGES = ["exploring", "opportunity", "qualified", "proposal", "won", "lost"] as const;
export const CRM_PROPOSAL_STATUSES = ["draft", "sent", "accepted", "rejected", "expired"] as const;

export type CrmLifecycle = (typeof CRM_LIFECYCLES)[number];
export type CrmStage = (typeof CRM_STAGES)[number];
export type CrmProposalStatus = (typeof CRM_PROPOSAL_STATUSES)[number];
export type CrmActor = "groq" | "human" | "system";

export interface ContactCommercialState {
  lifecycle: CrmLifecycle;
  stage: CrmStage;
  highIntent: boolean;
  convertedAt?: string | null;
  convertedBy?: string | null;
}

const AUTOMATIC_STAGE_ORDER: Record<Extract<CrmStage, "exploring" | "opportunity" | "qualified">, number> = {
  exploring: 0,
  opportunity: 1,
  qualified: 2,
};

/** Converts the former pipeline value without losing its business meaning. */
export function normalizeLegacyStage(stage: string | null | undefined): CrmStage {
  if (stage === "high_intent") return "qualified";
  return CRM_STAGES.includes(stage as CrmStage) ? stage as CrmStage : "exploring";
}

/** Groq may advance discovery, but never close, lose, or reopen a protected stage. */
export function resolveGroqStage(current: string | null | undefined, requested: string, lifecycle: CrmLifecycle = "lead"): CrmStage {
  const normalizedCurrent = normalizeLegacyStage(current);
  const normalizedRequested = normalizeLegacyStage(requested);
  if (!(normalizedRequested in AUTOMATIC_STAGE_ORDER)) return normalizedCurrent;
  if (!(normalizedCurrent in AUTOMATIC_STAGE_ORDER)) {
    return lifecycle === "client" && (normalizedCurrent === "won" || normalizedCurrent === "lost")
      ? normalizedRequested
      : normalizedCurrent;
  }
  return AUTOMATIC_STAGE_ORDER[normalizedRequested as keyof typeof AUTOMATIC_STAGE_ORDER]
    >= AUTOMATIC_STAGE_ORDER[normalizedCurrent as keyof typeof AUTOMATIC_STAGE_ORDER]
    ? normalizedRequested
    : normalizedCurrent;
}

export function isHighIntentRequest(stage: string, requiresHuman = false): boolean {
  return stage === "high_intent" || requiresHuman;
}

export function convertToClient(
  state: ContactCommercialState,
  actorUserId: string,
  at = new Date().toISOString(),
): ContactCommercialState {
  return { ...state, lifecycle: "client", stage: "won", convertedAt: at, convertedBy: actorUserId };
}

export function openClientOpportunity(state: ContactCommercialState): ContactCommercialState {
  return { ...state, stage: "opportunity" };
}

export function stageForProposalCreated(current: string | null | undefined, lifecycle: CrmLifecycle = "lead"): CrmStage {
  const stage = normalizeLegacyStage(current);
  return lifecycle !== "client" && (stage === "won" || stage === "lost") ? stage : "proposal";
}

export function proposalExternalKey(contactId: string, slug: string): string {
  return `${contactId}:${slug.trim().toLowerCase()}`;
}

export function shouldCreateAcceptanceSuggestion(existingOpenSuggestion: boolean): boolean {
  return !existingOpenSuggestion;
}

export function preserveFirstTouch<T>(existing: T | null | undefined, incoming: T | null | undefined): T | null {
  return existing ?? incoming ?? null;
}
