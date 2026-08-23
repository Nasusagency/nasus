import "server-only";
import { createServiceClient } from "@/lib/supabase/service";
import type { AdsPlatform, AdsSyncState } from "@/lib/acquisition/sync-status";

export async function writeAdsSyncStatus(platform: AdsPlatform, values: {
  status: AdsSyncState;
  lastSuccessAt?: string;
  lastAttemptAt?: string;
  lastErrorCode?: string | null;
}): Promise<boolean> {
  const supabase = createServiceClient();
  if (!supabase) return false;
  const row: Record<string, string | null> = { platform, status: values.status, updated_at: new Date().toISOString() };
  if (values.lastSuccessAt !== undefined) row.last_success_at = values.lastSuccessAt;
  if (values.lastAttemptAt !== undefined) row.last_attempt_at = values.lastAttemptAt;
  if (values.lastErrorCode !== undefined) row.last_error_code = values.lastErrorCode;
  const { error } = await supabase.from("acquisition_ads_sync_status").upsert(row, { onConflict: "platform" });
  return !error;
}
