import "server-only";
/** Log a fixed event name and provider code only; never messages, payloads, URLs or tokens. */
export function logSecurityFailure(label: string, ...causes: unknown[]) {
  const event = label.match(/^\[([A-Z0-9_]{1,60})\]/)?.[1] || "SECURITY_FAILURE";
  const cause = causes.find((value) => typeof value === "object" && value !== null && "code" in value);
  const raw = cause && typeof cause === "object" && "code" in cause ? cause.code : null;
  const code = typeof raw === "string" && /^[A-Z0-9_]{1,40}$/.test(raw) ? raw : "UNAVAILABLE";
  console.error(event, { code });
}