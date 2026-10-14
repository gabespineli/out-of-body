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
  const [file, setFile] = useState<File | null>(null), [result, setResult] = useState<InstallationResult | null>(null), [finishing, setFinishing] = useState<string | null>(null);
  const root = useRef<HTMLDivElement>(null), loaded = useRef<string | null>(null), lock = useRef(false), generation = useRef(0), queueGeneration = useRef(0);
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
  const action = useCallback(async (what: QueueAction, id?: string) => {
    if (lock.current) return; lock.current = true; queueGeneration.current++; setBusy(true); setError("");
    try {
      const value = await participantApi<{ cleanupPending: boolean }>("queue/action", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: what, id }) });
      await refresh();
      if (what === "start" || what === "call" || what === "end") { setResult(null); setFinishing(null); }
      if (what === "complete") setFinishing(null);
      if (value.cleanupPending) setError("Ticket ended. Temporary-file deletion will be retried by scheduled cleanup.");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Queue action failed. Retry."); }
    finally { lock.current = false; setBusy(false); }
  }, [refresh]);
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
    setResult(value); setFinishing(id); void action("complete", id);
  }, [action]);
  return <div className="participant-desktop" ref={root} data-testid="desktop-flow">
    {!initialized ? <p role="status">Preparing installation…</p> : !authorized || !queue ? <main className="participant-entry"><BrandLogo /><h1>Open the exhibit queue</h1>
      <p>Unlock once to display the permanent QR and manage participants here.</p><form onSubmit={event => { event.preventDefault(); void unlock(); }}>
        <label className="field-label">Installation key<input type="password" autoComplete="off" value={key} onChange={event => setKey(event.target.value)} /></label>
        <button className="primary-action" disabled={busy}>{busy ? "Opening…" : "Open installation"}</button></form><p><Link href="/">Local upload / Manual demo</Link></p></main>
      : <>{!queue.active && !result && <QueueBar queue={queue} busy={busy} onAction={(what, id) => void action(what, id)} />}
        {!queue.active && !result && <div className="installation-waiting" role="status">{queue.called ? `${queue.called.name || "Participant"}, ticket ${queue.called.number}: please come to the screen.` : "Scan the permanent QR to upload. Staff will call your ticket when it’s your turn."}</div>}
        {result ? <><CompletionScreen result={result} busy={busy || !!finishing} onNext={() => { setResult(null); }} />
          {finishing && !busy && <button className="retry-completion" onClick={() => void action("complete", finishing)}>Retry finishing ticket</button>}</>
          : queue.active ? file ? <Installation key={queue.active.id} initialArtwork={file} participantMode participantName={queue.active.name || `Ticket ${queue.active.number}`} fullscreenRoot={root}
            onComplete={complete} onParticipantReset={() => { if (queue.active) void action("end", queue.active.id); }} /> : <p role="status" className="installation-waiting">Preparing your drawing…</p> : null}</>}
    {(error || connectionError || artworkError) && <p role="alert" className="error-message participant-error">{error || connectionError || artworkError}</p>}
  </div>;
}
