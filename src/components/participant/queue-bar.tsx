"use client";
import type { QueueAction, QueueState } from "@/lib/queue";
export function QueueBar({ queue, busy, onAction }: { queue: QueueState; busy: boolean; onAction: (action: QueueAction, id?: string) => void }) {
  const current = queue.active || queue.called;
  return <section className="queue-bar" aria-label="Participant queue" data-testid="queue-bar">
    <div className="queue-summary"><div><strong>Exhibit queue</strong><span className="queue-capacity" role="status">{queue.waiting}/{queue.capacity} slots reserved{!queue.accepting ? " · Intake paused automatically" : ""}</span></div>
      <p className="queue-current">{current ? `${queue.active ? "Stretching" : "Calling"}: ${current.name || "Participant"} · Ticket ${current.number}` : "Ready to call the next participant"}</p>
      <div className="button-row"><button disabled={busy || !!current || !queue.tickets.some(t => t.status === "ready")} onClick={() => onAction("call")}>Call next</button>
        {queue.called && <button disabled={busy} onClick={() => onAction("start", queue.called!.id)}>Start participant</button>}
        {queue.active && <button disabled={busy} onClick={() => onAction("end", queue.active!.id)}>End current session</button>}
        <details className="permanent-qr"><summary>Permanent QR</summary><div><img src={queue.qr} width="200" height="200" alt="Permanent QR to upload a drawing" data-testid="session-qr" />
          <a href={queue.mobileUrl} data-testid="pairing-link">Open mobile upload</a><a href={queue.qr} download="out-of-body-permanent-qr.png">Save QR for printing</a></div></details></div>
    </div>
    <ul className="queue-tickets" aria-label="Waiting tickets">{queue.tickets.filter(t => t.status !== "active").map(ticket => <li key={ticket.id} data-status={ticket.status}>
      <span><strong>#{ticket.number}</strong> {ticket.name || "Participant"}<small>{ticket.status === "preparing" ? "Preparing" : ticket.status === "uploading" ? "Uploading" : ticket.status === "called" ? "Called" : "Ready"}</small></span>
      {["called", "ready"].includes(ticket.status) && <button disabled={busy} aria-label={`Call ticket ${ticket.number} later`} onClick={() => onAction("later", ticket.id)}>Call later</button>}
      <button disabled={busy || ticket.status === "uploading"} aria-label={`Remove ticket ${ticket.number}`} onClick={() => onAction("remove", ticket.id)}>Remove</button>
    </li>)}</ul>
    {queue.usageWarning && <p role="status" className="queue-warning">Image downloads have reached the 3 GB calendar-month warning budget. Check Supabase and Vercel usage before extending intake.</p>}
    <details className="queue-usage"><summary>Usage</summary><span>{queue.uploads} uploads · {queue.downloads} image downloads · {(queue.downloadBytes / 1_000_000).toFixed(1)} MB this calendar month. Provider dashboards include other traffic.</span></details>
  </section>;
}
