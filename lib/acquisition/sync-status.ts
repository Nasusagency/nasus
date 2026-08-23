export type AdsPlatform = "google" | "chatgpt";
export type AdsSyncState = "synced" | "error" | "pending";

export type AdsSyncStatus = {
  platform: AdsPlatform;
  status: AdsSyncState;
  lastSuccessAt: string | null;
  lastAttemptAt: string | null;
  lastErrorCode: string | null;
};

export const ADS_SYNC_LABELS: Record<AdsSyncState, string> = {
  synced: "Sincronizado",
  error: "Error",
  pending: "Pendiente",
};

export function formatMexicoCityTimestamp(value: string | null): string {
  if (!value) return "Sin sincronización exitosa";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Sin sincronización exitosa";
  return new Intl.DateTimeFormat("es-MX", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "America/Mexico_City",
  }).format(date);
}

export function defaultAdsSyncStatuses(): AdsSyncStatus[] {
  return (["google", "chatgpt"] as const).map(platform => ({
    platform, status: "pending", lastSuccessAt: null, lastAttemptAt: null, lastErrorCode: null,
  }));
}
