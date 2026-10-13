export const SESSION_MINUTES = 30;
export const PAIR_MINUTES = 10;
export const MAX_UPLOAD_BYTES = 2_500_000;
export const SESSION_COOKIE = "oob_desktop";
export const MOBILE_COOKIE = "oob_mobile";
export const OPERATOR_COOKIE = "oob_operator";
export type SessionStatus = "waiting" | "uploading" | "ready" | "received" | "completed" | "closed";
export type ParticipantSession = { id: string; status: SessionStatus; expiresAt: string; paired: boolean };
export type PairingSession = ParticipantSession & { pairToken: string; pairExpiresAt: string };
export function pairingUrl(origin: string, session: Pick<PairingSession, "id" | "pairToken">) {
  return `${origin.replace(/\/$/, "")}/mobile#pair=${session.id}.${session.pairToken}`;
}
export function parsePairing(value: string) {
  const match = /^#pair=([0-9a-f-]{36})\.([A-Za-z0-9_-]{43})$/.exec(value);
  return match ? { id: match[1], token: match[2] } : null;
}
