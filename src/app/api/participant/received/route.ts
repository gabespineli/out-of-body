import { NextRequest } from "next/server";
import { apiAction, privateJson, requireSameOrigin } from "@/server/session-security";
import { currentSession } from "@/server/participant-request";
import { markReceived } from "@/server/participant-store";
export const runtime = "nodejs";
export async function POST(request: NextRequest) {
  return apiAction(async () => {
    requireSameOrigin(request);
    return privateJson(await markReceived(await currentSession(request, "owner")));
  });
}
