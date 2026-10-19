import "server-only";
import { cookies } from "next/headers";
import { COMMISSION_VERIFICATION_COOKIE, readCommissionVerification } from "@/features/commission/server/email-verification";

export type CommissionCustomer = { email: string };

let customerForTesting: CommissionCustomer | null | undefined;

/** Isolated route-test seam; application requests always verify the signed email cookie. */
export function _setCommissionCustomerForTesting(customer: CommissionCustomer | null | undefined) {
  customerForTesting = customer;
}

export async function getVerifiedCommissionCustomer(): Promise<CommissionCustomer | null> {
  if (customerForTesting !== undefined) return customerForTesting;
  try {
    const marker = (await cookies()).get(COMMISSION_VERIFICATION_COOKIE)?.value;
    const email = readCommissionVerification(marker);
    return email ? { email } : null;
  } catch {
    return null;
  }
}
