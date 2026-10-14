"use client";
import type { QueueAction, QueueState } from "@/lib/queue";
export function QueueBar({ queue, busy, onAction }: { queue: QueueState; busy: boolean; onAction: (action: QueueAction, id?: string) => void }) {
  const current = queue.active || queue.called;
  return <section className="queue-bar" aria-label="Participant queue" data-testid="queue-bar">
    <div className="queue-summary"><div><strong>Exhibit queue</strong><span className="queue-capacity" role="status">{queue.waiting}/{queue.capacity} slots reserved{!queue.accepting ? " · Intake paused automatically" : ""}</span></div>
      <p className="queue-current">{current ? `${queue.active ? "Stretching" : "Calling"}: ${current.name || "Participant"} · Ticket ${current.number}` : queue.tickets.some(ticket => ticket.status === "ready") ? "Preparing the next participant…" : "Waiting for a drawing to be uploaded"}</p>
      <div className="button-row">
        {queue.active && <button disabled={busy} onClick={() => onAction("end", queue.active!.id)}>End current session</button>}
      </div>
    </div>
    <ul className="queue-tickets" aria-label="Waiting tickets">{queue.tickets.filter(t => t.status !== "active").map(ticket => <li key={ticket.id} data-status={ticket.status}>
      <span><strong>#{ticket.number}</strong> {ticket.name || "Participant"}<small>{ticket.status === "preparing" ? "Preparing" : ticket.status === "uploading" ? "Uploading" : ticket.status === "called" ? "Called" : "Ready"}</small></span>
      <button disabled={busy || ticket.status === "uploading"} aria-label={`Remove ticket ${ticket.number}`} onClick={() => onAction("remove", ticket.id)}>Remove</button>
    </li>)}</ul>
    {queue.usageWarning && <p role="status" className="queue-warning">Image downloads have reached the 3 GB calendar-month warning budget. Check Supabase and Vercel usage before extending intake.</p>}
  </section>;
}
