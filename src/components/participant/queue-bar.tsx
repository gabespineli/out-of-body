"use client";
import type { QueueAction, QueueState } from "@/lib/queue";
import { useEffect, useId, useRef, useState } from "react";
export function QueueBar({ queue, busy, onAction, onInteractionChange }: { queue: QueueState; busy: boolean; onAction: (action: QueueAction, id?: string) => void; onInteractionChange?: (blocked: boolean) => void }) {
  const [pending, setPending] = useState<{ action: "end" | "remove"; id: string } | null>(null);
  const dialog = useRef<HTMLDialogElement>(null), title = useId();
  useEffect(() => { onInteractionChange?.(!!pending); }, [pending, onInteractionChange]);
  useEffect(() => () => onInteractionChange?.(false), [onInteractionChange]);
  useEffect(() => {
    if (pending && !queue.tickets.some(ticket => ticket.id === pending.id)) setPending(null);
  }, [queue.tickets, pending]);
  useEffect(() => { const node = dialog.current; if (pending && node && !node.open) node.showModal(); else if (!pending && node?.open) node.close(); }, [pending]);
  const current = queue.active || queue.called;
  return <section className="queue-bar" aria-label="Participant queue" data-testid="queue-bar">
    <div className="queue-summary"><div><strong>Exhibit queue</strong><span className="queue-capacity" role="status">{queue.waiting}/{queue.capacity} slots reserved{!queue.accepting ? " · Intake paused automatically" : ""}</span></div>
      <p className="queue-current">{current ? `${queue.active ? "Current participant" : "Calling"}: ${current.name || "Participant"} · Ticket ${current.number}` : queue.tickets.some(ticket => ticket.status === "ready") ? "Preparing the next participant…" : "Waiting for a drawing to be uploaded"}</p>
      <div className="button-row">
        {queue.active && <button disabled={busy} onClick={() => setPending({ action: "end", id: queue.active!.id })}>Skip participant</button>}
      </div>
    </div>
    <ul className="queue-tickets" aria-label="Waiting tickets">{queue.tickets.filter(t => t.status !== "active").map(ticket => <li key={ticket.id} data-status={ticket.status}>
      <span><strong>#{ticket.number}</strong> {ticket.name || "Participant"}<small>{ticket.status === "preparing" ? "Preparing" : ticket.status === "uploading" ? "Uploading" : ticket.status === "called" ? "Called" : "Ready"}</small></span>
      <button disabled={busy || ticket.status === "uploading"} aria-label={`Remove ticket ${ticket.number}`} onClick={() => setPending({ action: "remove", id: ticket.id })}>Remove</button>
    </li>)}</ul>
    {queue.usageWarning && <p role="status" className="queue-warning">Image downloads have reached the 3 GB calendar-month warning budget. Check Supabase and Vercel usage before extending intake.</p>}
    <dialog ref={dialog} className="ticket-cancel-dialog" aria-labelledby={title} onCancel={event => { event.preventDefault(); setPending(null); }}>
      <h2 id={title}>{pending?.action === "end" ? "Skip this participant?" : "Remove this participant?"}</h2>
      <p>{pending?.action === "end" ? "This ends their turn without saving a finished drawing. The next ready participant will be called." : "They’ll lose their place and drawing. They can join again from their phone."}</p>
      <div className="mobile-primary-actions"><button className="secondary-action" autoFocus onClick={() => setPending(null)}>Keep participant</button>
        <button className="primary-action" disabled={busy} onClick={() => { if (pending) { onAction(pending.action, pending.id); setPending(null); } }}>{pending?.action === "end" ? "Yes, skip participant" : "Yes, remove participant"}</button></div>
    </dialog>
  </section>;
}
