import { NextRequest } from "next/server";
import QRCode from "qrcode";
import { pairingUrl, OPERATOR_COOKIE, SESSION_COOKIE } from "@/lib/participant-session";
import { apiAction, authorizedOperator, operatorProof, privateJson, requireSameOrigin, requestOrigin, SessionError, setPrivateCookie } from "@/server/session-security";
import { createSession, endSession, viewSession } from "@/server/participant-store";
import { currentSession } from "@/server/participant-request";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: NextRequest) {
  return apiAction(async () => privateJson(viewSession(await currentSession(request, "owner"))));
}
export async function POST(request: NextRequest) {
  return apiAction(async () => {
    requireSameOrigin(request);
    if (!authorizedOperator(request)) throw new SessionError(401, "Enter the installation key to open pairing.");
    // A fresh session revokes the old participant before showing another QR.
    if (request.cookies.has(SESSION_COOKIE)) {
      try { await endSession(await currentSession(request, "owner"), "closed"); }
      catch (error) { if (!(error instanceof SessionError && [401, 410].includes(error.status))) throw error; }
    }
    const created = await createSession();
    const session = { ...viewSession(created.row), pairToken: created.pairToken, pairExpiresAt: created.pairExpiresAt };
    const origin = process.env.OOB_PUBLIC_URL || requestOrigin(request);
    const url = pairingUrl(origin, session);
    const qr = await QRCode.toDataURL(url, { width: 320, margin: 2, errorCorrectionLevel: "M" });
    const response = privateJson({ ...session, pairingUrl: url, qr });
    setPrivateCookie(response, request, SESSION_COOKIE, `${created.row.id}.${created.owner}`);
    setPrivateCookie(response, request, OPERATOR_COOKIE, operatorProof(), 8 * 3600);
    return response;
  });
}
export async function DELETE(request: NextRequest) {
  return apiAction(async () => {
    requireSameOrigin(request);
    try { await endSession(await currentSession(request, "owner"), "closed"); }
    catch (error) { if (!(error instanceof SessionError && error.status === 410)) throw error; }
    const response = privateJson({ ended: true });
    setPrivateCookie(response, request, SESSION_COOKIE, "", 0);
    return response;
  });
}
