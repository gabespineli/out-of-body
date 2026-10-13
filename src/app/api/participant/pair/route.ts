import { NextRequest } from "next/server";
import { MOBILE_COOKIE } from "@/lib/participant-session";
import { apiAction, privateJson, requireSameOrigin, SessionError, setPrivateCookie } from "@/server/session-security";
import { claimSession, viewSession } from "@/server/participant-store";
export const runtime = "nodejs";
export async function POST(request: NextRequest) {
  return apiAction(async () => {
    requireSameOrigin(request);
    const input = await request.json().catch(() => null);
    if (!input || typeof input.id !== "string" || typeof input.token !== "string") throw new SessionError(400, "Scan a valid installation QR code.");
    const { row, mobile } = await claimSession(input.id, input.token);
    const response = privateJson(viewSession(row));
    setPrivateCookie(response, request, MOBILE_COOKIE, `${row.id}.${mobile}`);
    return response;
  });
}
