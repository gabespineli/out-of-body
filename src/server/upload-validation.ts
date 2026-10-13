import sharp from "sharp";
import { MAX_UPLOAD_BYTES } from "@/lib/participant-session";
import { SessionError } from "./session-security";
export async function readArtwork(request: Request) {
  if (request.headers.get("content-type")?.split(";")[0] !== "image/png") throw new SessionError(415, "Upload the prepared PNG preview.");
  const declared = request.headers.get("content-length");
  if (declared && +declared > MAX_UPLOAD_BYTES) throw new SessionError(413, "The prepared photo is too large.");
  const reader = request.body?.getReader();
  if (!reader) throw new SessionError(400, "Choose a drawing before uploading.");
  const pieces: Uint8Array[] = []; let length = 0;
  while (true) {
    const { done, value } = await reader.read(); if (done) break;
    length += value.byteLength;
    if (length > MAX_UPLOAD_BYTES) { await reader.cancel(); throw new SessionError(413, "The prepared photo is too large."); }
    pieces.push(value);
  }
  const bytes = Buffer.concat(pieces);
  try {
    const image = sharp(bytes, { limitInputPixels: 600 * 900 });
    const info = await image.metadata();
    if (info.format !== "png" || info.width !== 600 || info.height !== 900 || (info.pages ?? 1) !== 1) throw new Error("Invalid prepared image");
    return await image.flatten({ background: "#faf8f3" }).png().toBuffer();
  } catch { throw new SessionError(400, "The photo preview could not be read. Retake or choose another drawing."); }
}
