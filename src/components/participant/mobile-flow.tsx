"use client";
import { useEffect, useRef, useState } from "react";
import { parsePairing, type ParticipantSession } from "@/lib/participant-session";
import { participantApi, ParticipantApiError } from "@/lib/participant-api";
import { useMobileCamera } from "@/hooks/use-mobile-camera";
import { usePhotoPreview } from "@/hooks/use-photo-preview";
import { MobileCapture, MobileLanding, MobilePreview, MobileSent } from "./mobile-screens";
export function MobileFlow() {
  const camera = useMobileCamera(), photo = usePhotoPreview();
  const [session, setSession] = useState<ParticipantSession | null>(null), [step, setStep] = useState<"landing" | "camera" | "preview" | "sent">("landing");
  const [connecting, setConnecting] = useState(true), [sending, setSending] = useState(false), [error, setError] = useState(""), [ended, setEnded] = useState(false);
  const uploadLock = useRef(false), init = useRef<Promise<ParticipantSession> | null>(null);
  useEffect(() => {
    let live = true;
    if (!init.current) {
      const pair = parsePairing(window.location.hash);
      init.current = pair ? participantApi("pair", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(pair) })
        : window.location.hash ? Promise.reject(new ParticipantApiError(400, "This QR code is invalid. Scan the installation again.")) : participantApi("mobile");
    }
    init.current.then(value => {
      if (!live) return; setSession(value); setConnecting(false);
      if (window.location.hash) window.history.replaceState(null, "", window.location.pathname);
      if (["ready", "received"].includes(value.status)) setStep("sent");
    }).catch(cause => { if (live) { setConnecting(false); setError(cause instanceof Error ? cause.message : "Pairing failed."); } });
    return () => { live = false; };
  }, []);
  useEffect(() => {
    if (!session || ended) return;
    let timer: ReturnType<typeof setTimeout>; const controller = new AbortController();
    const poll = async () => {
      try {
        const value = await participantApi<ParticipantSession>("mobile", { signal: controller.signal });
        if (controller.signal.aborted) return; setSession(value);
        if (["ready", "received"].includes(value.status)) { camera.stop(); setStep("sent"); photo.clear(); setError(""); }
      } catch (cause) {
        if (controller.signal.aborted) return;
        if (cause instanceof ParticipantApiError && [401, 410].includes(cause.status)) { setEnded(true); camera.stop(); photo.clear(); setError("This session has ended. Scan the new installation QR code."); return; }
      }
      if (!controller.signal.aborted) timer = setTimeout(poll, 2000);
    };
    timer = setTimeout(poll, 2000);
    return () => { clearTimeout(timer); controller.abort(); };
  // State updates must not reset the poll timer on every successful response.
  }, [session?.id, ended, camera.stop, photo.clear]);
  const choose = async (file: File) => { camera.stop(); setError(""); if (await photo.open(file)) setStep("preview"); };
  const capture = async () => { try { await choose(await camera.capture()); } catch (cause) { setError(cause instanceof Error ? cause.message : "The photo could not be captured."); } };
  const send = async () => {
    if (uploadLock.current || !session || ended) return;
    uploadLock.current = true; setSending(true); setError("");
    try {
      const blob = await photo.prepared();
      const value = await participantApi<ParticipantSession>("upload", { method: "POST", headers: { "Content-Type": "image/png" }, body: blob });
      setSession(value); setStep("sent"); photo.clear(); camera.stop();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The drawing could not be sent. Retry.");
      if (cause instanceof ParticipantApiError && cause.status === 410) { setEnded(true); photo.clear(); }
    } finally { uploadLock.current = false; setSending(false); }
  };
  return <main className="mobile-participant" data-testid="mobile-flow"><header><h1>Out of Body</h1></header>
    {connecting ? <p role="status">Connecting to installation…</p> : ended ? <section><h2>Session ended</h2><p>Scan the new QR code on the installation.</p></section> : step === "landing" ? <MobileLanding connected={!!session && !ended} onContinue={() => setStep("camera")} />
      : step === "camera" ? <MobileCapture camera={camera} onCapture={() => void capture()} onChoose={file => void choose(file)} busy={photo.busy || ended} />
      : step === "preview" ? <MobilePreview photo={photo} sending={sending || ended} onSend={() => void send()} onRetake={() => { photo.clear(); setError(""); setStep("camera"); }} />
      : <MobileSent received={session?.status === "received"} />}
    {photo.busy && <p role="status">Preparing preview…</p>}
    {(error || photo.error) && <p role="alert" className="error-message">{error || photo.error}</p>}
    {step === "camera" && <button onClick={() => { camera.stop(); photo.clear(); setStep("landing"); }}>Back</button>}
  </main>;
}
