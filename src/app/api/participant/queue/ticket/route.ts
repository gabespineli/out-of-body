import { NextRequest } from "next/server";
import { QUEUE_CLIENT_COOKIE, QUEUE_COOKIE, terminalTicket } from "@/lib/queue";
import { apiAction, newToken, privateJson, requireSameOrigin, SessionError, setPrivateCookie } from "@/server/session-security";
import { joinQueue, ownedTicket, queueAction, ticketView } from "@/server/queue-store";
export const runtime = "nodejs";
export async function GET(request: NextRequest) { return apiAction(async () => privateJson(await ticketView(await ownedTicket(request, true)))); }
export async function POST(request: NextRequest) {
  return apiAction(async () => {
    requireSameOrigin(request);
    if (request.cookies.has(QUEUE_COOKIE)) {
      try { const row = await ownedTicket(request, true); if (!terminalTicket(row.status)) return privateJson(await ticketView(row)); }
      catch (error) { if (!(error instanceof SessionError && [401, 410].includes(error.status))) throw error; }
    }
    const old = request.cookies.get(QUEUE_CLIENT_COOKIE)?.value;
    const client = old && /^[A-Za-z0-9_-]{43}$/.test(old) ? old : newToken();
    const created = await joinQueue(client), response = privateJson(await ticketView(created.row));
    setPrivateCookie(response, request, QUEUE_COOKIE, `${created.row.id}.${created.mobile}`, 2 * 3600);
    setPrivateCookie(response, request, QUEUE_CLIENT_COOKIE, client, 24 * 3600); return response;
  });
}
export async function DELETE(request: NextRequest) {
  return apiAction(async () => {
    requireSameOrigin(request); const row = await ownedTicket(request, true);
    const result = await queueAction("cancel", row.id), response = privateJson(await ticketView(result.row));
    setPrivateCookie(response, request, QUEUE_COOKIE, "", 0); return response;
  });
}
