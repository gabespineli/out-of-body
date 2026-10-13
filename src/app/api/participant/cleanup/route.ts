import { NextRequest } from "next/server";
import { apiAction, equalSecret, privateJson, SessionError } from "@/server/session-security";
import { cleanupExpired } from "@/server/participant-store";
export const runtime = "nodejs";
export const maxDuration = 30;
export async function POST(request: NextRequest) {
  return apiAction(async () => {
    const key = process.env.OOB_CLEANUP_SECRET ?? "";
    if (key.length < 32) throw new SessionError(503, "Cleanup is not configured.");
    if (!equalSecret(request.headers.get("authorization") ?? "", `Bearer ${key}`)) throw new SessionError(401, "Cleanup authorization is required.");
    return privateJson(await cleanupExpired());
  });
}
