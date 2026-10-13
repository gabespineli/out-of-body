export class ParticipantApiError extends Error { constructor(public status: number, message: string) { super(message); } }
export async function participantApi<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`/api/participant/${path}`, { ...init, credentials: "same-origin", cache: "no-store" });
  const body = await response.json().catch(() => null);
  if (!response.ok) throw new ParticipantApiError(response.status, body?.error || "The connection failed. Please retry.");
  return body as T;
}
