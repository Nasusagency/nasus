import { ADMIN_COOKIE, verifyAdminToken } from "@/lib/admin/auth";

export async function authorizeGoogleAdsSync(input: { adminCookie?: string; authorization?: string | null }, cronSecret = process.env.CRON_SECRET): Promise<"admin" | "cron" | null> {
  if (input.adminCookie && await verifyAdminToken(input.adminCookie)) return "admin";
  if (cronSecret && input.authorization === `Bearer ${cronSecret}`) return "cron";
  return null;
}

export { ADMIN_COOKIE };
