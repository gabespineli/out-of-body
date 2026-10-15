import { NextRequest } from "next/server";
import { apiAction, authorizedOperator, privateJson, requireSameOrigin, SessionError } from "@/server/session-security";
import { completedDrawing, finishWithDrawing, ownedTicket } from "@/server/queue-store";
import { readArtwork } from "@/server/upload-validation";
import { STAGE_WIDTH } from "@/lib/rig";
export const runtime = "nodejs";
export const maxDuration = 30;
export async function POST(request: NextRequest) {
  return apiAction(async () => {
    requireSameOrigin(request);
    if (!authorizedOperator(request)) throw new SessionError(401, "Operator authorization is required.");
    const id = request.nextUrl.searchParams.get("id");
    if (!id || !/^[0-9a-f-]{36}$/.test(id)) throw new SessionError(400, "Choose the active ticket.");
    return privateJson(await finishWithDrawing(id, () => readArtwork(request, STAGE_WIDTH)));
  });
}
export async function GET(request: NextRequest) {
  return apiAction(async () => new Response(await completedDrawing(await ownedTicket(request, true)), {
    headers: { "Content-Type": "image/png", "Content-Disposition": 'attachment; filename="out-of-body-completed.png"',
      "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff", "Referrer-Policy": "no-referrer" },
  }));
}
