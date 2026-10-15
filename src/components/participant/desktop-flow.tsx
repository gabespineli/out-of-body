"use client";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { Installation, type InstallationResult } from "@/components/installation";
import { participantApi, ParticipantApiError } from "@/lib/participant-api";
import { useVisiblePoll } from "@/hooks/use-visible-poll";
import type { QueueAction, QueueState } from "@/lib/queue";
import { QueueBar } from "./queue-bar";
import { CompletionScreen } from "./completion-screen";
import { BrandLogo } from "../design-brand";
export function DesktopFlow() {
  const [queue, setQueue] = useState<QueueState | null>(null), [authorized, setAuthorized] = useState(false), [initialized, setInitialized] = useState(false);
  const [key, setKey] = useState(""), [busy, setBusy] = useState(false), [error, setError] = useState("");
  const [connectionError, setConnectionError] = useState(""), [artworkError, setArtworkError] = useState("");
  const [automaticError, setAutomaticError] = useState("");
  const [file, setFile] = useState<File | null>(null), [result, setResult] = useState<InstallationResult | null>(null), [finishing, setFinishing] = useState<string | null>(null);
  const root = useRef<HTMLDivElement>(null), loaded = useRef<string | null>(null), lock = useRef(false), generation = useRef(0), queueGeneration = useRef(0);
  const completedResult = useRef<InstallationResult | null>(null);
  const refresh = useCallback(async (signal?: AbortSignal) => {
    const version = queueGeneration.current;
    const relevant = () => !signal?.aborted && version === queueGeneration.current && (!signal || !lock.current);
    try { const value = await participantApi<QueueState>("queue?view=operator", { signal });
      if (relevant()) { setQueue(value); setAuthorized(true); setInitialized(true); setConnectionError(""); } return value;
    } catch (cause) {
      if (relevant()) { setInitialized(true); if (cause instanceof ParticipantApiError && cause.status === 401) { setAuthorized(false); setQueue(null); setConnectionError(""); }
        else setConnectionError(cause instanceof Error ? cause.message : "Could not refresh the queue."); throw cause; }
    }
  }, []);
  useVisiblePoll(async signal => { if (!lock.current) await refresh(signal); }, 5000, authorized || !initialized);
  const unlock = async () => {
    if (lock.current) return; lock.current = true; queueGeneration.current++; setBusy(true); setError(""); const supplied = key; setKey("");
    try { setQueue(await participantApi<QueueState>("queue", { method: "POST", headers: { Authorization: `Bearer ${supplied}` } })); setAuthorized(true); setConnectionError(""); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Could not unlock the installation."); }
    finally { lock.current = false; setBusy(false); setInitialized(true); }
  };
  const action = useCallback(async (what: QueueAction, id?: string, automatic = false) => {
    if (lock.current) return; lock.current = true; queueGeneration.current++; setBusy(true); if (automatic) setAutomaticError(""); else setError("");
    try {
      let value: { cleanupPending: boolean };
      if (what === "complete") {
        if (!completedResult.current) throw new Error("The finished drawing is unavailable. Please retry the session.");
        const image = await fetch(completedResult.current.snapshot).then(response => response.blob());
        value = await participantApi("queue/result?id=" + id, { method: "POST", headers: { "Content-Type": "image/png" }, body: image });
      } else value = await participantApi("queue/action", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: what, id }) });
      await refresh();
      if (what === "start" || what === "call" || what === "end") { completedResult.current = null; setResult(null); setFinishing(null); }
      if (what === "complete") setFinishing(null);
      if (value.cleanupPending) setError("Ticket ended. Temporary-file deletion will be retried by scheduled cleanup.");
    } catch (cause) { const message = cause instanceof Error ? cause.message : "Queue action failed. Retry."; if (automatic) setAutomaticError(message); else setError(message); }
    finally { lock.current = false; setBusy(false); }
  }, [refresh]);
  useEffect(() => {
    if (queue?.called || queue?.active) { setAutomaticError(""); return; }
    // A fresh snapshot retries failures; busy changes alone must never cause a retry loop.
    if (!queue || result || finishing || lock.current || !queue.tickets.some(ticket => ticket.status === "ready")) return;
    void action("call", undefined, true);
  }, [queue, result, finishing, action]);
  useEffect(() => {
    // A fresh queue snapshot can confirm completion even when its POST response was lost.
    if (finishing && !busy && queue && !queue.tickets.some(ticket => ticket.id === finishing)) {
      setFinishing(null); setError("");
    }
  }, [finishing, busy, queue]);
  useEffect(() => {
    const id = queue?.active?.id;
    if (!id) { generation.current++; loaded.current = null; setFile(null); setArtworkError(""); return; }
    if (loaded.current === id) return;
    const turn = ++generation.current, controller = new AbortController(); let timer: ReturnType<typeof setTimeout>;
    const retrieve = async () => {
      try {
        const response = await fetch(`/api/participant/queue/artwork?id=${id}`, { cache: "no-store", signal: controller.signal });
        if (!response.ok) throw new Error("Could not retrieve the active drawing. Retrying…");
        const blob = await response.blob();
        if (!controller.signal.aborted && turn === generation.current) { loaded.current = id; setFile(new File([blob], "participant-drawing.png", { type: "image/png" })); setArtworkError(""); }
      } catch (cause) { if (!controller.signal.aborted) { setArtworkError(cause instanceof Error ? cause.message : "Could not retrieve artwork."); timer = setTimeout(retrieve, 15000); } }
    };
    setFile(null); setArtworkError(""); void retrieve(); return () => { controller.abort(); clearTimeout(timer); };
  }, [queue?.active?.id]);
  const complete = useCallback((value: InstallationResult) => {
    const id = loaded.current; if (!id) return;
    completedResult.current = value; setResult(value); setFinishing(id); void action("complete", id);
  }, [action]);
  return <div className="participant-desktop" ref={root} data-testid="desktop-flow">
    {!initialized ? <p role="status">Preparing installation…</p> : !authorized || !queue ? <main className="participant-entry"><BrandLogo /><h1>Open the exhibit queue</h1>
      <p>Unlock once to display the permanent QR and manage participants here.</p><form onSubmit={event => { event.preventDefault(); void unlock(); }}>
        <label className="field-label">Installation key<input type="password" autoComplete="off" value={key} onChange={event => setKey(event.target.value)} /></label>
        <button className="primary-action" disabled={busy}>{busy ? "Opening…" : "Open installation"}</button></form><p><Link href="/test">Local upload / Manual demo</Link></p></main>
      : <>{!queue.active && !result && queue.tickets.length > 0 && <QueueBar queue={queue} busy={busy} onAction={(what, id) => void action(what, id)} />}
        {!queue.active && !result && <main className="installation-welcome" data-testid="installation-welcome" data-called={!!queue.called}><BrandLogo />
          <h1>{queue.called ? `${queue.called.name || "Participant"}, it’s your turn` : "Your drawing, in motion"}</h1>
          <p className="welcome-instruction" role="status">{queue.called ? `Ticket ${queue.called.number}: please come to the stretching screen.` : "Scan the permanent QR to upload. Staff will call your ticket when it’s your turn."}</p>
          {queue.called && <button className="primary-action start-participant-action" disabled={busy} onClick={() => void action("start", queue.called!.id)}>Start participant</button>}
          <div className="installation-qr"><img src={queue.qr} width="260" height="260" alt="Permanent QR to upload a drawing" data-testid="session-qr" /></div>
          <div className="welcome-links"><a href={queue.mobileUrl} data-testid="pairing-link">Open mobile upload</a><a href={queue.qr} download="out-of-body-permanent-qr.png">Save QR for printing</a></div>
          {!queue.tickets.length && <p className="welcome-capacity">{queue.waiting}/{queue.capacity} slots reserved{!queue.accepting ? " · Intake paused automatically" : " · Ready for your drawing"}</p>}
        </main>}
        {result ? <><CompletionScreen result={result} busy={busy || !!finishing} onNext={() => { setResult(null); }} />
          {finishing && !busy && <button className="retry-completion" onClick={() => void action("complete", finishing)}>Retry finishing ticket</button>}</>
          : queue.active ? file ? <Installation key={queue.active.id} initialArtwork={file} participantMode participantName={queue.active.name || `Ticket ${queue.active.number}`} fullscreenRoot={root}
            onComplete={complete} onParticipantReset={() => { if (queue.active) void action("end", queue.active.id); }} /> : <p role="status" className="installation-waiting">Preparing your drawing…</p> : null}</>}
    {(error || automaticError || connectionError || artworkError) && <p role="alert" className="error-message participant-error">{error || automaticError || connectionError || artworkError}</p>}
  </div>;
}
