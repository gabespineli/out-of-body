import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { SESSION_MINUTES, PAIR_MINUTES, type ParticipantSession, type SessionStatus } from "@/lib/participant-session";
import { equalSecret, newToken, SessionError, tokenHash } from "./session-security";
export const ART_BUCKET = "oob-temporary-artwork";
export type StoredSession = { id: string; owner_hash: string; pair_hash: string; mobile_hash: string | null; status: SessionStatus;
  expires_at: string; pair_expires_at: string; object_path: string | null; upload_started_at: string | null };
export function backend() {
  const url = process.env.SUPABASE_URL, key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new SessionError(503, "Pairing setup is incomplete. Configure the dedicated Supabase project.");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
function check(error: unknown) { if (error) throw new SessionError(503, "Temporary storage is unavailable. Please retry."); }
export const viewSession = (row: StoredSession): ParticipantSession => ({ id: row.id, status: row.status, expiresAt: row.expires_at, paired: !!row.mobile_hash });
export async function createSession() {
  const db = backend(), id = randomUUID(), owner = newToken(), pairToken = newToken();
  const expiresAt = new Date(Date.now() + SESSION_MINUTES * 60_000).toISOString();
  const pairExpiresAt = new Date(Date.now() + PAIR_MINUTES * 60_000).toISOString();
  const { data, error } = await db.from("oob_sessions").insert({ id, owner_hash: tokenHash(owner), pair_hash: tokenHash(pairToken),
    expires_at: expiresAt, pair_expires_at: pairExpiresAt }).select().single();
  check(error);
  return { row: data as StoredSession, owner, pairToken, pairExpiresAt };
}
export async function readSession(id: string) {
  const { data, error } = await backend().from("oob_sessions").select("*").eq("id", id).maybeSingle();
  check(error);
  if (!data) throw new SessionError(410, "This session has expired. Scan the new QR code on the installation.");
  return data as StoredSession;
}
export async function authenticatedSession(id: string, hash: string, role: "owner" | "mobile") {
  const row = await readSession(id);
  if (!equalSecret(hash, role === "owner" ? row.owner_hash : row.mobile_hash ?? "")) throw new SessionError(401, "This device is not connected to that session.");
  if (Date.parse(row.expires_at) <= Date.now() || row.status === "closed") throw new SessionError(410, "This session has ended. Scan the new installation QR code.");
  return row;
}
export async function claimSession(id: string, pairToken: string) {
  if (!/^[0-9a-f-]{36}$/.test(id) || !/^[A-Za-z0-9_-]{43}$/.test(pairToken)) throw new SessionError(400, "This QR code is invalid.");
  const db = backend(), now = new Date().toISOString(), mobile = newToken();
  const { data, error } = await db.from("oob_sessions").update({ mobile_hash: tokenHash(mobile) }).eq("id", id)
    .eq("pair_hash", tokenHash(pairToken)).is("mobile_hash", null).eq("status", "waiting")
    .gt("pair_expires_at", now).gt("expires_at", now).select().maybeSingle();
  check(error);
  if (!data) throw new SessionError(410, "This QR code has expired or is already paired. Ask for a new session.");
  return { row: data as StoredSession, mobile };
}
export async function reserveUpload(row: StoredSession) {
  const path = `${row.id}/${randomUUID()}.png`, now = new Date().toISOString();
  const { data, error } = await backend().from("oob_sessions").update({ status: "uploading", object_path: path, upload_started_at: now })
    .eq("id", row.id).eq("status", "waiting").eq("mobile_hash", row.mobile_hash!).gt("expires_at", now).select().maybeSingle();
  check(error);
  if (!data) throw new SessionError(409, "An artwork is already uploading or has been sent for this session.");
  return { row: data as StoredSession, path };
}
export async function storeArtwork(row: StoredSession, bytes: Buffer) {
  const db = backend(), reservation = await reserveUpload(row);
  const upload = await db.storage.from(ART_BUCKET).upload(reservation.path, bytes, { contentType: "image/png", cacheControl: "0", upsert: false });
  if (upload.error) {
    // Keep the reserved path for cleanup if deletion fails; never discard its metadata.
    const removed = await db.storage.from(ART_BUCKET).remove([reservation.path]);
    if (!removed.error) await db.from("oob_sessions").update({ status: "waiting", object_path: null, upload_started_at: null })
      .eq("id", row.id).eq("status", "uploading").eq("object_path", reservation.path);
    throw new SessionError(503, "The photo could not be stored. Please retry the upload.");
  }
  const { data, error } = await db.from("oob_sessions").update({ status: "ready" }).eq("id", row.id)
    .eq("status", "uploading").eq("object_path", reservation.path).gt("expires_at", new Date().toISOString()).select().maybeSingle();
  if (error || !data) {
    await db.storage.from(ART_BUCKET).remove([reservation.path]);
    throw new SessionError(410, "The session ended while uploading. Scan the new QR code.");
  }
  return viewSession(data as StoredSession);
}
export async function retrieveArtwork(row: StoredSession) {
  if (!["ready", "received"].includes(row.status) || !row.object_path) throw new SessionError(409, "The drawing is not ready yet.");
  const { data, error } = await backend().storage.from(ART_BUCKET).download(row.object_path);
  check(error);
  if (!data) throw new SessionError(503, "The drawing could not be retrieved. Please retry.");
  return data;
}
export async function markReceived(row: StoredSession) {
  const { data, error } = await backend().from("oob_sessions").update({ status: "received" }).eq("id", row.id)
    .in("status", ["ready", "received"]).gt("expires_at", new Date().toISOString()).select().maybeSingle();
  check(error);
  if (!data) throw new SessionError(410, "This session is no longer available.");
  return viewSession(data as StoredSession);
}
export async function endSession(row: StoredSession, status: "completed" | "closed") {
  const db = backend();
  const { error } = await db.from("oob_sessions").update({ status, expires_at: new Date().toISOString() }).eq("id", row.id);
  check(error);
  // Leave the path recorded until scheduled cleanup, covering a reset concurrent with upload.
  if (row.object_path) {
    const result = await db.storage.from(ART_BUCKET).remove([row.object_path]);
    if (result.error) throw new SessionError(503, "Session ended. Temporary-file deletion will be retried by cleanup.");
  }
}
export async function cleanupExpired() {
  const db = backend(), cutoff = new Date(Date.now() - 120_000).toISOString();
  const { data, error } = await db.from("oob_sessions").select("*").lt("expires_at", cutoff).limit(100);
  check(error);
  let deleted = 0, failed = 0;
  for (const row of (data ?? []) as StoredSession[]) {
    if (row.object_path) {
      const result = await db.storage.from(ART_BUCKET).remove([row.object_path]);
      if (result.error) { failed++; continue; }
    }
    const result = await db.from("oob_sessions").delete().eq("id", row.id).lt("expires_at", cutoff);
    if (result.error) failed++; else deleted++;
  }
  return { deleted, failed };
}
