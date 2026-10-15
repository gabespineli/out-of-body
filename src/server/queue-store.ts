import { createHmac, randomUUID } from "node:crypto";
import QRCode from "qrcode";
import { NextRequest } from "next/server";
import { backend, ART_BUCKET } from "./participant-store";
import { credential, equalSecret, operatorKey, SessionError, tokenHash } from "./session-security";
import { IMAGE_WARNING_BYTES, QUEUE_CAPACITY, QUEUE_COOKIE, permanentMobileUrl, terminalTicket, type QueuePublic, type QueueState, type QueueTicket, type TicketStatus } from "@/lib/queue";
export type StoredTicket = { id: string; number: number; mobile_hash: string; client_hash: string; participant_name: string;
  status: TicketStatus; created_at: string; order_at: string | null; expires_at: string; object_path: string | null; image_bytes: number;
  result_path: string | null; result_bytes: number };
const messages: Record<string, [number, string]> = {
  QUEUE_FULL: [409, "The queue is full. Please try again shortly."], QUEUE_OFFLINE: [409, "The installation is not accepting participants yet."],
  QUEUE_EXISTING: [409, "This browser already has a ticket. Reopen it here, or wait for its reservation to expire."],
  QUEUE_RATE: [429, "Too many tickets requested. Please try again later."], QUEUE_EXPIRED: [410, "This ticket has ended or expired."],
  QUEUE_BUSY: [409, "The queue changed. Refresh and check the current participant."], QUEUE_EMPTY: [409, "No uploaded drawings are ready yet."],
};
function check(error: { message?: string } | null) {
  if (!error) return;
  const known = Object.keys(messages).find(key => error.message?.includes(key));
  if (known) throw new SessionError(...messages[known]);
  throw new SessionError(503, "Queue storage is unavailable. Apply the queue migration and check the dedicated Supabase project.");
}
export async function expireTickets() { const { error } = await backend().rpc("oob_queue_expire"); check(error); }
const view = (row: StoredTicket, ahead = 0): QueueTicket => ({ id: row.id, number: row.number, name: row.participant_name,
  status: row.status, expiresAt: row.expires_at, createdAt: row.created_at, ahead,
  downloadAvailable: row.status === "completed" && !!row.result_path && Date.parse(row.expires_at) > Date.now() });
export async function queueRows() {
  await expireTickets();
  const { data, error } = await backend().from("oob_queue_tickets").select("*").in("status", ["preparing", "uploading", "ready", "called", "active"])
    .order("order_at", { ascending: true, nullsFirst: false }).order("number").limit(QUEUE_CAPACITY + 1);
  check(error); return (data ?? []) as StoredTicket[];
}
async function control(heartbeat: boolean) {
  const db = backend();
  if (heartbeat) { const { error } = await db.from("oob_queue_control").update({ online_until: new Date(Date.now() + 120_000).toISOString() }).eq("id", true); check(error); }
  const { data, error } = await db.from("oob_queue_control").select("online_until").eq("id", true).single();
  check(error); if (!data) throw new SessionError(503, "Apply the queue migration first."); return Date.parse(data.online_until) > Date.now();
}
export async function publicQueue(): Promise<QueuePublic> {
  const [rows, online] = await Promise.all([queueRows(), control(false)]);
  const waiting = rows.filter(row => row.status !== "active").length;
  return { waiting, capacity: QUEUE_CAPACITY, online, accepting: online && waiting < QUEUE_CAPACITY };
}
let qrCache: { url: string; qr: string } | undefined;
export async function operatorQueue(origin: string): Promise<QueueState> {
  const [rows, online] = await Promise.all([queueRows(), control(true)]);
  const waiting = rows.filter(row => row.status !== "active").length;
  const mobileUrl = permanentMobileUrl(origin);
  if (qrCache?.url !== mobileUrl) qrCache = { url: mobileUrl, qr: await QRCode.toDataURL(mobileUrl, { width: 256, margin: 2, errorCorrectionLevel: "M" }) };
  const month = new Date().toISOString().slice(0, 7) + "-01";
  const { data, error } = await backend().from("oob_queue_usage").select("download_bytes,downloads,uploads").eq("month", month).maybeSingle(); check(error);
  const tickets = rows.map(row => view(row));
  return { waiting, capacity: QUEUE_CAPACITY, online, accepting: online && waiting < QUEUE_CAPACITY, tickets,
    active: tickets.find(t => t.status === "active") ?? null, called: tickets.find(t => t.status === "called") ?? null,
    mobileUrl, qr: qrCache.qr, downloadBytes: data?.download_bytes ?? 0, downloads: data?.downloads ?? 0, uploads: data?.uploads ?? 0,
    usageWarning: (data?.download_bytes ?? 0) >= IMAGE_WARNING_BYTES };
}
export async function ownedTicket(request: NextRequest, allowTerminal = false) {
  const cap = credential(request, QUEUE_COOKIE);
  const { data, error } = await backend().from("oob_queue_tickets").select("*").eq("id", cap.id).maybeSingle(); check(error);
  if (!data) throw new SessionError(410, "This ticket has ended or expired.");
  const row = data as StoredTicket;
  if (!equalSecret(cap.hash, row.mobile_hash)) throw new SessionError(401, "This browser does not own that ticket.");
  if (Date.parse(row.expires_at) <= Date.now() && !terminalTicket(row.status)) {
    await expireTickets(); row.status = "expired"; row.participant_name = "";
  }
  if (!allowTerminal && terminalTicket(row.status)) throw new SessionError(410, "This ticket has ended or expired.");
  return row;
}
export async function ticketView(row: StoredTicket) {
  if (terminalTicket(row.status)) return view(row);
  const rows = await queueRows();
  const ahead = row.order_at ? rows.filter(t => t.id !== row.id && (t.status === "active" || t.status === "called" || t.status === "ready" &&
    (t.order_at! < row.order_at! || t.order_at === row.order_at && t.number < row.number))).length : 0;
  // Only return this participant's name and position; never another person's identity.
  return view(row, ahead);
}
export async function joinQueue(clientToken: string) {
  const id = randomUUID();
  const proof = (ticketId: string) => createHmac("sha256", operatorKey()).update(`queue:${clientToken}:${ticketId}`).digest("base64url");
  const mobile = proof(id);
  const { data, error } = await backend().rpc("oob_queue_join", { p_id: id, p_mobile_hash: tokenHash(mobile), p_client_hash: tokenHash(clientToken) }); check(error);
  const row = data as StoredTicket;
  return { row, mobile: proof(row.id) };
}
export async function queueAction(action: string, id?: string) {
  const { data, error } = await backend().rpc("oob_queue_action", { p_action: action, p_id: id ?? null }); check(error);
  const row = data as StoredTicket;
  if (terminalTicket(row.status) && row.object_path) {
    // Keep the path until scheduled cleanup; a cancelled in-flight upload may finish late.
    const result = await backend().storage.from(ART_BUCKET).remove([row.object_path]);
    if (result.error) return { row, cleanupPending: true };
  }
  return { row, cleanupPending: false };
}
export async function uploadAttempt(id: string) {
  const { data, error } = await backend().rpc("oob_queue_upload_attempt", { p_id: id }); check(error);
  if (!data) throw new SessionError(429, "Too many upload attempts. Wait a minute, then retry.");
}
export async function uploadTicket(row: StoredTicket, bytes: Buffer, name: string) {
  const db = backend(), path = `queue/${row.id}/${randomUUID()}.png`;
  const { data, error } = await db.from("oob_queue_tickets").update({ status: "uploading", object_path: path })
    .eq("id", row.id).eq("status", "preparing").gt("expires_at", new Date().toISOString()).select().maybeSingle(); check(error);
  if (!data) throw new SessionError(409, "This ticket already has an upload, or its reservation expired.");
  const result = await db.storage.from(ART_BUCKET).upload(path, bytes, { contentType: "image/png", cacheControl: "0", upsert: false });
  if (result.error) {
    const removed = await db.storage.from(ART_BUCKET).remove([path]);
    if (!removed.error) await db.from("oob_queue_tickets").update({ status: "preparing", object_path: null }).eq("id", row.id).eq("status", "uploading").eq("object_path", path);
    throw new SessionError(503, "The drawing could not be stored. Please retry.");
  }
  const published = await db.rpc("oob_queue_publish", { p_id: row.id, p_path: path, p_name: name, p_bytes: bytes.length });
  if (published.error) { await db.storage.from(ART_BUCKET).remove([path]); check(published.error); }
  return ticketView(published.data as StoredTicket);
}
export async function activeArtwork(id: string) {
  await expireTickets();
  const db = backend(), found = await db.from("oob_queue_tickets").select("*").eq("id", id).eq("status", "active").gt("expires_at", new Date().toISOString()).maybeSingle(); check(found.error);
  const row = found.data as StoredTicket | null;
  if (!row?.object_path) throw new SessionError(409, "That participant is not active.");
  const counted = await db.rpc("oob_queue_record_download", { p_id: id }); check(counted.error);
  const result = await db.storage.from(ART_BUCKET).download(row.object_path); check(result.error);
  if (!result.data) throw new SessionError(503, "The artwork could not be retrieved.");
  return result.data;
}
export async function cleanupQueue() {
  await expireTickets(); const db = backend();
  const cutoff = new Date(Date.now() - 120_000).toISOString();
  const { data, error } = await db.from("oob_queue_tickets").select("id,object_path").in("status", ["completed", "cancelled", "expired"]).lt("expires_at", cutoff).limit(100); check(error);
  let deleted = 0, failed = 0;
  for (const row of data ?? []) {
    // The deterministic result path also covers an interrupted upload before SQL publication.
    if ((await db.storage.from(ART_BUCKET).remove([...(row.object_path ? [row.object_path] : []), `queue/${row.id}/completed.png`])).error) { failed++; continue; }
    const removed = await db.from("oob_queue_tickets").delete().eq("id", row.id).lt("expires_at", cutoff);
    if (removed.error) failed++; else deleted++;
  }
  const rates = await db.from("oob_queue_rate_limits").delete().lt("window_start", new Date(Date.now() - 86_400_000).toISOString()); check(rates.error);
  return { deleted, failed };
}

export async function finishWithDrawing(id: string, read: () => Promise<Buffer>) {
  const db = backend();
  await expireTickets();
  const found = await db.from("oob_queue_tickets").select("*").eq("id", id).maybeSingle(); check(found.error);
  const row = found.data as StoredTicket | null;
  if (row?.status === "completed" && row.result_path) {
    const removed = row.object_path ? await db.storage.from(ART_BUCKET).remove([row.object_path]) : null;
    return { cleanupPending: !!removed?.error };
  }
  if (!row || row.status !== "active") throw new SessionError(409, "That participant is not active.");
  await uploadAttempt(id);
  const bytes = await read(), path = `queue/${id}/completed.png`;
  const stored = await db.storage.from(ART_BUCKET).upload(path, bytes, { contentType: "image/png", cacheControl: "0", upsert: false });
  // A retry or second operator keeps the first saved frame, instead of overwriting it.
  let size = bytes.length;
  if (stored.error) {
    if (String((stored.error as { statusCode?: string }).statusCode) !== "409" && !stored.error.message.includes("already exists")) check(stored.error);
    const saved = await db.storage.from(ART_BUCKET).download(path); check(saved.error);
    if (!saved.data) throw new SessionError(503, "The finished drawing could not be saved. Retry finishing the ticket.");
    size = saved.data.size;
  }
  const finished = await db.rpc("oob_queue_finish", { p_id: id, p_bytes: size }); check(finished.error);
  const removed = row.object_path ? await db.storage.from(ART_BUCKET).remove([row.object_path]) : null;
  return { cleanupPending: !!removed?.error };
}

export async function completedDrawing(row: StoredTicket) {
  if (row.status !== "completed" || !row.result_path || Date.parse(row.expires_at) <= Date.now()) throw new SessionError(410, "This finished drawing is no longer available.");
  const counted = await backend().rpc("oob_queue_result_download", { p_id: row.id }); check(counted.error);
  const result = await backend().storage.from(ART_BUCKET).download(row.result_path); check(result.error);
  if (!result.data) throw new SessionError(503, "The finished drawing could not be retrieved. Please retry.");
  return result.data;
}
