import { NextRequest } from "next/server";
import { apiAction, privateJson, requireSameOrigin } from "@/server/session-security";
import { currentSession } from "@/server/participant-request";
import { storeArtwork } from "@/server/participant-store";
import { readArtwork } from "@/server/upload-validation";
export const runtime = "nodejs";
export const maxDuration = 30;
export async function POST(request: NextRequest) {
  return apiAction(async () => {
    requireSameOrigin(request);
    const row = await currentSession(request, "mobile");
    return privateJson(await storeArtwork(row, await readArtwork(request)));
  });
}
