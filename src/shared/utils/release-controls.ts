import "server-only";
import { getSupabaseAdmin } from "@/shared/services/supabase-admin";

/** The deployment flag is a kill switch; persisted owner availability can only further restrict intake. */
export const isCommissionReleaseEnabled = () => process.env.ARTFOLIO_COMMISSIONS_ENABLED === "true";
export async function isCommissionIntakeEnabled(): Promise<boolean> {
  if (!isCommissionReleaseEnabled()) return false;
  try {
    const { data, error } = await getSupabaseAdmin().from("commission_intake_settings")
      .select("accepting_requests").eq("id", 1).maybeSingle();
    return !error && data?.accepting_requests === true;
  } catch {
    return false;
  }
}
export const isPaymentCheckoutEnabled = () => process.env.ARTFOLIO_PAYMENTS_ENABLED === "true";
