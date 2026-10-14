export const QUEUE_CAPACITY = 20;
export const PREPARATION_MINUTES = 10;
export const WAITING_MINUTES = 90;
export const IMAGE_WARNING_BYTES = 3_000_000_000;
export const QUEUE_COOKIE = "oob_queue_ticket";
export const QUEUE_CLIENT_COOKIE = "oob_queue_client";
export type TicketStatus = "preparing" | "uploading" | "ready" | "called" | "active" | "completed" | "cancelled" | "expired";
export type QueueTicket = { id: string; number: number; name: string; status: TicketStatus; expiresAt: string; createdAt: string; ahead: number };
export type QueuePublic = { waiting: number; capacity: number; accepting: boolean; online: boolean };
export type QueueState = QueuePublic & { tickets: QueueTicket[]; active: QueueTicket | null; called: QueueTicket | null;
  mobileUrl: string; qr: string; downloadBytes: number; downloads: number; uploads: number; usageWarning: boolean };
export type QueueAction = "call" | "start" | "later" | "remove" | "end" | "complete";
export const terminalTicket = (status: TicketStatus) => ["completed", "cancelled", "expired"].includes(status);
export function participantName(value: unknown): string {
  if (typeof value !== "string") throw new Error("Enter a first name or nickname.");
  const clean = value.normalize("NFC").replace(/[\p{Cc}\p{Cf}]/gu, "").trim().replace(/\s+/g, " ");
  if ([...clean].length > 40) throw new Error("Use a name of 40 characters or fewer.");
  return clean;
}
export function permanentMobileUrl(origin: string) { return new URL("/mobile", origin).toString(); }
