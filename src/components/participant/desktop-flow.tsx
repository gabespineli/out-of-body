"use client";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { Installation, type InstallationResult } from "@/components/installation";
import type { ParticipantSession } from "@/lib/participant-session";
import { participantApi, ParticipantApiError } from "@/lib/participant-api";
import { CompletionScreen } from "./completion-screen";
import { PairingScreen, type PairingResponse } from "./pairing-screen";
const CACHE_KEY = "oob-pairing-display";
export function DesktopFlow() {
  const [session, setSession] = useState<ParticipantSession | null>(null), [pairing, setPairing] = useState<PairingResponse | null>(null);
  const [file, setFile] = useState<File | null>(null), [result, setResult] = useState<InstallationResult | null>(null);
  const [key, setKey] = useState(""), [busy, setBusy] = useState(false), [error, setError] = useState(""), [initialized, setInitialized] = useState(false);
  const generation = useRef(0), requested = useRef(false), acknowledged = useRef<string | null>(null);
  useEffect(() => {
    let active = true;
    participantApi<ParticipantSession>("session").then(value => {
      if (!active) return; setSession(value);
      const raw = sessionStorage.getItem(CACHE_KEY);
      if (raw) { try { const cached = JSON.parse(raw) as PairingResponse; if (cached.id === value.id) setPairing({ ...cached, ...value }); } catch { sessionStorage.removeItem(CACHE_KEY); } }
    }).catch(cause => { if (active && cause instanceof ParticipantApiError && cause.status === 503) setError(cause.message); })
      .finally(() => { if (active) setInitialized(true); });
    return () => { active = false; };
  }, []);
  const create = async () => {
    if (busy) return;
    const turn = ++generation.current; setBusy(true); setError(""); setFile(null); setResult(null);
    const suppliedKey = key; setKey("");
    acknowledged.current = null; requested.current = false;
    try {
      const value = await participantApi<PairingResponse>("session", { method: "POST", headers: suppliedKey ? { Authorization: `Bearer ${suppliedKey}` } : {} });
      if (turn !== generation.current) return;
      setSession(value); setPairing(value); sessionStorage.setItem(CACHE_KEY, JSON.stringify(value)); setKey("");
    } catch (cause) { if (turn === generation.current) { setSession(null); setPairing(null); sessionStorage.removeItem(CACHE_KEY); setError(cause instanceof Error ? cause.message : "Session creation failed."); } }
    finally { if (turn === generation.current) setBusy(false); }
  };
  useEffect(() => {
    if (!session || result || busy) return;
    const turn = generation.current, controller = new AbortController(); let timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      try {
        const value = await participantApi<ParticipantSession>("session", { signal: controller.signal });
        if (controller.signal.aborted || turn !== generation.current) return;
        if (value.id !== session.id) return;
        setSession(value); setPairing(previous => previous ? { ...previous, ...value } : previous); setError("");
        if (value.paired) sessionStorage.removeItem(CACHE_KEY);
        if (["ready", "received"].includes(value.status) && !requested.current) {
          requested.current = true;
          try {
            const response = await fetch("/api/participant/artwork", { cache: "no-store", signal: controller.signal });
            if (!response.ok) throw new Error("The drawing could not be retrieved. Retrying…");
            const blob = await response.blob();
            if (!controller.signal.aborted && turn === generation.current) setFile(new File([blob], "participant-drawing.png", { type: "image/png" }));
          } catch (cause) { requested.current = false; throw cause; }
        }
      } catch (cause) {
        if (controller.signal.aborted || turn !== generation.current) return;
        if (cause instanceof ParticipantApiError && [401, 410].includes(cause.status)) {
          setFile(null); setSession(null); setPairing(null); sessionStorage.removeItem(CACHE_KEY);
        }
        setError(cause instanceof Error ? cause.message : "The session connection failed. Retrying…");
      }
      if (!controller.signal.aborted) timer = setTimeout(poll, 1500);
    };
    void poll();
    return () => { clearTimeout(timer); controller.abort(); };
  }, [session?.id, result, busy]);
  const received = useCallback(() => {
    if (!session || acknowledged.current === session.id) return;
    acknowledged.current = session.id;
    void participantApi("received", { method: "POST" }).catch(cause => {
      acknowledged.current = null; setError(cause instanceof Error ? cause.message : "The drawing receipt could not be confirmed.");
    });
  }, [session?.id]);
  const complete = useCallback((value: InstallationResult) => {
    setResult(value); setFile(null); sessionStorage.removeItem(CACHE_KEY);
    void participantApi("complete", { method: "POST" }).catch(cause => setError(cause instanceof Error ? cause.message : "The temporary copy could not be deleted yet."));
  }, []);
  return <div className="participant-desktop" data-testid="desktop-flow">
    {!initialized ? <p role="status">Preparing installation…</p>
      : result ? <CompletionScreen result={result} onNext={() => void create()} busy={busy} />
      : file ? <><div className="participant-session-bar"><span>Drawing received from phone</span><button disabled={busy} onClick={() => void create()}>Next participant / reset session</button></div>
        <Installation initialArtwork={file} onArtworkReady={received} onComplete={complete} onParticipantReset={() => void create()} /></>
      : <main className="participant-entry"><PairingScreen session={pairing ? { ...pairing, ...session } : null} onNew={() => void create()} busy={busy} />
        {!session && <label className="field-label">Installation key<input type="password" autoComplete="off" value={key} onChange={event => setKey(event.target.value)} aria-label="Installation key" /></label>}
        <p><Link href="/">Local upload / Manual demo</Link></p></main>}
    {error && <p role="alert" className="error-message participant-error">{error}</p>}
  </div>;
}
