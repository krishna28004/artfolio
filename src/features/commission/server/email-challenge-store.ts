import "server-only";
import { Redis } from "@upstash/redis";
import { challengeMatches, commissionChallengeDigest, commissionChallengeKey } from "@/features/commission/server/email-verification";

export function getCommissionEmailRedis(): Redis | null {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  try { return new Redis({ url, token }); } catch { return null; }
}

export async function consumeCommissionChallenge(
  store: Pick<Redis, "getdel">, challengeId: string, email: string, code: string,
): Promise<boolean> {
  const actual = await store.getdel<string>(commissionChallengeKey(challengeId));
  return challengeMatches(actual, commissionChallengeDigest(challengeId, email, code));
}
