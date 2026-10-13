import { NextRequest } from "next/server";
import { apiAction, privateJson } from "@/server/session-security";
import { currentSession } from "@/server/participant-request";
import { viewSession } from "@/server/participant-store";
export const runtime = "nodejs";
export async function GET(request: NextRequest) {
  return apiAction(async () => privateJson(viewSession(await currentSession(request, "mobile"))));
}
