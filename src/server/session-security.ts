import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { OPERATOR_COOKIE } from "@/lib/participant-session";
export class SessionError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
export const newToken = () => randomBytes(32).toString("base64url");
export const tokenHash = (value: string) => createHash("sha256").update(value).digest("hex");
export function equalSecret(left: string, right: string) {
  const a = Buffer.from(left), b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}
export function operatorKey() {
  const key = process.env.OOB_INSTALLATION_KEY ?? "";
  if (key.length < 32) throw new SessionError(503, "Pairing setup is incomplete. Configure the installation key and Supabase project.");
  return key;
}
export function operatorProof(expiry = Date.now() + 8 * 60 * 60 * 1000) {
  const value = String(expiry);
  return `${value}.${createHmac("sha256", operatorKey()).update(value).digest("base64url")}`;
}
export function authorizedOperator(request: NextRequest) {
  const key = operatorKey();
  if (equalSecret(request.headers.get("authorization") ?? "", `Bearer ${key}`)) return true;
  const proof = request.cookies.get(OPERATOR_COOKIE)?.value ?? "";
  const [expiry] = proof.split(".");
  return /^\d+$/.test(expiry) && +expiry > Date.now() && +expiry <= Date.now() + 8 * 60 * 60 * 1000
    && equalSecret(proof, operatorProof(+expiry));
}
export function requestOrigin(request: NextRequest) {
  const url = new URL(request.url);
  const forwarded = request.headers.get("x-forwarded-proto");
  const protocol = forwarded === "https" || forwarded === "http" ? forwarded + ":" : url.protocol;
  return new URL(protocol + "//" + (request.headers.get("host") || url.host)).origin;
}
export function requireSameOrigin(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (origin && origin !== requestOrigin(request)) throw new SessionError(403, "This request must come from the installation site.");
}
export function credential(request: NextRequest, cookie: string) {
  const value = request.cookies.get(cookie)?.value ?? "";
  const match = /^([0-9a-f-]{36})\.([A-Za-z0-9_-]{43})$/.exec(value);
  if (!match) throw new SessionError(401, "Scan a current installation QR code to connect.");
  return { id: match[1], hash: tokenHash(match[2]) };
}
export function setPrivateCookie(response: NextResponse, request: NextRequest, name: string, value: string, maxAge = 1800) {
  response.cookies.set(name, value, { httpOnly: true, secure: requestOrigin(request).startsWith("https:"), sameSite: "strict", path: "/api/participant", maxAge });
}
export function privateJson(value: unknown, status = 200) {
  return NextResponse.json(value, { status, headers: { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" } });
}
export async function apiAction(action: () => Promise<Response>) {
  try { return await action(); }
  catch (error) {
    if (error instanceof SessionError) return privateJson({ error: error.message }, error.status);
    return privateJson({ error: "The temporary session service is unavailable. Please retry." }, 503);
  }
}
