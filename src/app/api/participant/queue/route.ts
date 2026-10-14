import { NextRequest } from "next/server";
import { apiAction, authorizedOperator, newToken, operatorProof, privateJson, requireSameOrigin, requestOrigin, SessionError, setPrivateCookie } from "@/server/session-security";
import { operatorQueue, publicQueue } from "@/server/queue-store";
import { OPERATOR_COOKIE } from "@/lib/participant-session";
import { QUEUE_CLIENT_COOKIE } from "@/lib/queue";
export const runtime = "nodejs";
function operator(request: NextRequest) { if (!authorizedOperator(request)) throw new SessionError(401, "Enter the installation key to manage the queue."); }
function origin(request: NextRequest) {
  const value = process.env.OOB_PUBLIC_URL || requestOrigin(request);
  const url = new URL(value);
  if (url.protocol !== "https:" && !(url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname))) throw new SessionError(503, "Set OOB_PUBLIC_URL to the stable HTTPS application origin.");
  return url.origin;
}
export async function GET(request: NextRequest) {
  return apiAction(async () => {
    if (request.nextUrl.searchParams.get("view") !== "operator") {
      const response = privateJson(await publicQueue());
      if (!/^[A-Za-z0-9_-]{43}$/.test(request.cookies.get(QUEUE_CLIENT_COOKIE)?.value || ""))
        setPrivateCookie(response, request, QUEUE_CLIENT_COOKIE, newToken(), 24 * 3600);
      return response;
    }
    operator(request); return privateJson(await operatorQueue(origin(request)));
  });
}
export async function POST(request: NextRequest) {
  return apiAction(async () => {
    requireSameOrigin(request); operator(request);
    const response = privateJson(await operatorQueue(origin(request)));
    setPrivateCookie(response, request, OPERATOR_COOKIE, operatorProof(), 8 * 3600); return response;
  });
}
