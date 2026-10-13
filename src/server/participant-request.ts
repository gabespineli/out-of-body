import { NextRequest } from "next/server";
import { MOBILE_COOKIE, SESSION_COOKIE } from "@/lib/participant-session";
import { credential } from "./session-security";
import { authenticatedSession } from "./participant-store";
export async function currentSession(request: NextRequest, role: "owner" | "mobile") {
  const cap = credential(request, role === "owner" ? SESSION_COOKIE : MOBILE_COOKIE);
  return authenticatedSession(cap.id, cap.hash, role);
}
