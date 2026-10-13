"use client";
import type { PairingSession } from "@/lib/participant-session";
export type PairingResponse = PairingSession & { pairingUrl: string; qr: string };
export function PairingScreen({ session, onNew, busy }: { session: PairingResponse | null; onNew: () => void; busy: boolean }) {
  return <section className="participant-pairing" aria-labelledby="pair-title"><h1 id="pair-title">{session?.paired ? "Phone connected" : "Pair your phone"}</h1>
    {session && !session.paired ? <>
      <p>Scan the QR code, photograph your drawing, then return to this screen.</p>
      <img src={session.qr} width="320" height="320" alt="QR code to connect a phone to this installation" data-testid="session-qr" />
      <p className="participant-note">This QR works once and expires after 10 minutes.</p>
      <details><summary>Open the pairing link</summary><a href={session.pairingUrl} data-testid="pairing-link">Open mobile upload</a></details>
    </> : <p role="status">{session?.status === "uploading" ? "Receiving drawing…" : session?.paired ? "Waiting for your phone to send the drawing…" : "Create a session to show the QR code."}</p>}
    <button disabled={busy} onClick={onNew}>{busy ? "Preparing session…" : session ? "New QR / reset session" : "Create session"}</button>
  </section>;
}
