"use client";
import { useEffect, useRef } from "react";

export function TicketCancelDialog({ open, onClose, onConfirm }: { open: boolean; onClose: () => void; onConfirm: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const node = dialog.current;
    if (open && node && !node.open) node.showModal();
    else if (!open && node?.open) node.close();
  }, [open]);
  return <dialog ref={dialog} className="ticket-cancel-dialog" aria-labelledby="ticket-cancel-title" aria-describedby="ticket-cancel-description"
    onCancel={event => { event.preventDefault(); onClose(); }}>
    <h2 id="ticket-cancel-title">Cancel your ticket?</h2>
    <p id="ticket-cancel-description">You’ll leave the queue and lose this drawing. You can join again with a new ticket.</p>
    <div className="mobile-primary-actions"><button className="secondary-action" autoFocus onClick={onClose}>Keep my ticket</button>
      <button className="primary-action" onClick={onConfirm}>Yes, cancel ticket</button></div>
  </dialog>;
}
