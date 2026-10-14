import { NextRequest } from "next/server";
import { apiAction, authorizedOperator, privateJson, requireSameOrigin, SessionError } from "@/server/session-security";
import { queueAction } from "@/server/queue-store";
export const runtime = "nodejs";
export const maxDuration = 30;
export async function POST(request: NextRequest) {
  return apiAction(async () => {
    requireSameOrigin(request);
    if (!authorizedOperator(request)) throw new SessionError(401, "Operator authorization is required.");
    const input = await request.json().catch(() => null);
    if (!input || !["call", "start", "later", "remove", "end", "complete"].includes(input.action)
      || input.action !== "call" && (typeof input.id !== "string" || !/^[0-9a-f-]{36}$/.test(input.id))) throw new SessionError(400, "Choose a valid queue action and ticket.");
    const result = await queueAction(input.action, input.id); return privateJson({ cleanupPending: result.cleanupPending });
  });
}
