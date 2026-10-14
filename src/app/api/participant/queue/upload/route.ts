import { NextRequest } from "next/server";
import { participantName } from "@/lib/queue";
import { apiAction, privateJson, requireSameOrigin, SessionError } from "@/server/session-security";
import { ownedTicket, ticketView, uploadAttempt, uploadTicket } from "@/server/queue-store";
import { readArtwork } from "@/server/upload-validation";
export const runtime = "nodejs";
export const maxDuration = 30;
export async function POST(request: NextRequest) {
  return apiAction(async () => {
    requireSameOrigin(request); const row = await ownedTicket(request);
    // A lost response can be retried without storing or replacing a second image.
    if (["ready", "called", "active"].includes(row.status)) return privateJson(await ticketView(row));
    await uploadAttempt(row.id);
    let name: string;
    try { name = participantName(decodeURIComponent(request.headers.get("x-participant-name") || "")); }
    catch { throw new SessionError(400, "Use a first name or nickname of 40 characters or fewer."); }
    return privateJson(await uploadTicket(row, await readArtwork(request), name));
  });
}
