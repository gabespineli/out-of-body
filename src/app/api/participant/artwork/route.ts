import { NextRequest } from "next/server";
import { apiAction } from "@/server/session-security";
import { currentSession } from "@/server/participant-request";
import { retrieveArtwork } from "@/server/participant-store";
export const runtime = "nodejs";
export async function GET(request: NextRequest) {
  return apiAction(async () => new Response(await retrieveArtwork(await currentSession(request, "owner")), {
    headers: { "Content-Type": "image/png", "Cache-Control": "no-store", "Referrer-Policy": "no-referrer", "X-Content-Type-Options": "nosniff" },
  }));
}
