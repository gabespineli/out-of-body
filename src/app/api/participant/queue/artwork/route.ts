import { NextRequest } from "next/server";
import { apiAction, authorizedOperator, SessionError } from "@/server/session-security";
import { activeArtwork } from "@/server/queue-store";
export const runtime = "nodejs";
export async function GET(request: NextRequest) {
  return apiAction(async () => {
    if (!authorizedOperator(request)) throw new SessionError(401, "Operator authorization is required.");
    const id = request.nextUrl.searchParams.get("id");
    if (!id || !/^[0-9a-f-]{36}$/.test(id)) throw new SessionError(400, "Choose the active ticket.");
    return new Response(await activeArtwork(id), { headers: { "Content-Type": "image/png", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } });
  });
}
