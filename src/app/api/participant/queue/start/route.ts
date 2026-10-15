import { NextRequest } from "next/server";
import { apiAction, privateJson, requireSameOrigin, SessionError } from "@/server/session-security";
import { ownedTicket, queueAction, ticketView } from "@/server/queue-store";
export const runtime = "nodejs";
export async function POST(request: NextRequest) {
  return apiAction(async () => {
    requireSameOrigin(request);
    // Derive the ticket from its private cookie, never a caller-supplied ID.
    const ticket = await ownedTicket(request);
    if (ticket.status !== "called" && ticket.status !== "active") throw new SessionError(409, "Wait until you’re next in line before starting.");
    // The existing atomic queue transition prevents two active participants.
    const result = await queueAction("start", ticket.id);
    return privateJson(await ticketView(result.row));
  });
}
