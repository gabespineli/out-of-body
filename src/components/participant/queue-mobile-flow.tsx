"use client";
import { useCallback, useRef, useState } from "react";
import { participantApi, ParticipantApiError } from "@/lib/participant-api";
import { participantName, terminalTicket, type QueuePublic, type QueueTicket } from "@/lib/queue";
import { useMobileCamera } from "@/hooks/use-mobile-camera";
import { usePhotoPreview } from "@/hooks/use-photo-preview";
import { useVisiblePoll } from "@/hooks/use-visible-poll";
import { MobileCapture, MobilePreview } from "./mobile-screens";
import { BrandLogo, DesignIcon } from "../design-brand";
import { TicketCancelDialog } from "./ticket-cancel-dialog";
export function QueueMobileFlow({ notice }: { notice: string }) {
  const camera = useMobileCamera(), photo = usePhotoPreview();
  const [ticket, setTicket] = useState<QueueTicket | null>(null), [queue, setQueue] = useState<QueuePublic | null>(null);
  const [step, setStep] = useState<"landing" | "camera" | "preview" | "waiting" | "about">("landing");
  const [name, setName] = useState(""), [busy, setBusy] = useState(false), [error, setError] = useState(""), [initialized, setInitialized] = useState(false);
  const [connectionError, setConnectionError] = useState("");
  const [cancelRequest, setCancelRequest] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const locked = useRef(false), current = useRef(ticket), generation = useRef(0);
  const accept = useCallback((value: QueueTicket) => {
    const previous = current.current;
    if (terminalTicket(value.status) || previous?.id !== value.id) setCancelRequest(null);
    current.current = value;
    setTicket(value);
    if (value.status === "called" && previous?.status !== "called") setStep("waiting");
    if (value.status === "completed" && previous?.status !== "completed") setStep("waiting");
    if (value.status !== "preparing" && value.status !== "uploading") { camera.stop(); photo.clear();
      if (!previous || ["preparing", "uploading"].includes(previous.status)) setStep("waiting"); }
    if (!previous || previous.id !== value.id || terminalTicket(value.status) ||
      ["preparing", "uploading"].includes(previous.status) && !["preparing", "uploading"].includes(value.status)) setError("");
  }, [camera.stop, photo.clear]);
  useVisiblePoll(async signal => {
    if (locked.current) return;
    const version = generation.current;
    // A response started before a reservation, upload or cancellation cannot replace its result.
    const relevant = () => !signal.aborted && !locked.current && version === generation.current;
    try {
      if (!current.current || terminalTicket(current.current.status)) {
        const value = await participantApi<QueuePublic>("queue", { signal });
        if (relevant()) setQueue(value);
      }
      if (relevant() && (!current.current || !terminalTicket(current.current.status))) {
        try { const value = await participantApi<QueueTicket>("queue/ticket", { signal }); if (relevant()) accept(value); }
        catch (cause) { if (!(cause instanceof ParticipantApiError && [401, 410].includes(cause.status))) throw cause;
          if (current.current && relevant()) accept({ ...current.current, status: "expired", name: "" }); }
      }
      if (relevant()) { setInitialized(true); setConnectionError(""); }
    } catch (cause) { if (relevant()) { setInitialized(true); setConnectionError(cause instanceof Error ? cause.message : "Connection lost. Retrying…"); throw cause; } }
  }, ticket?.status === "called" || ticket?.status === "active" ? 5000 : 15000,
  !ticket || !terminalTicket(ticket.status) || step === "landing");
  const join = async () => {
    if (locked.current) return; locked.current = true; generation.current++; setBusy(true); setError("");
    try { const value = await participantApi<QueueTicket>("queue/ticket", { method: "POST" }); accept(value);
      if (value.status === "preparing") { setName(""); setStep("camera"); }
      else setStep("waiting");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not reserve a slot."); }
    finally { locked.current = false; setBusy(false); }
  };
  const choose = async (file: File) => { camera.stop(); if (await photo.open(file)) setStep("preview"); };
  const capture = async () => { try { await choose(await camera.capture()); } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not capture the photo."); } };
  const send = async () => {
    if (locked.current || !ticket) return; locked.current = true; generation.current++; setBusy(true); setError("");
    try { const cleanName = participantName(name), blob = await photo.prepared();
      accept(await participantApi<QueueTicket>("queue/upload", { method: "POST", headers: { "Content-Type": "image/png", "X-Participant-Name": encodeURIComponent(cleanName) }, body: blob }));
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Upload failed. Your preview is kept; retry when connected."); }
    finally { locked.current = false; setBusy(false); }
  };
  const cancel = async () => {
    if (locked.current) return; locked.current = true; generation.current++; setBusy(true); setError("");
    try { accept(await participantApi<QueueTicket>("queue/ticket", { method: "DELETE" })); setStep("landing");
      // Retain the ended ticket locally so home does not restore it from the browser cookie.
      try { setQueue(await participantApi<QueuePublic>("queue")); setConnectionError(""); }
      catch { setQueue(null); setConnectionError("Could not check available slots. Retrying…"); }
    }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Could not cancel. Please retry."); }
    finally { locked.current = false; setBusy(false); }
  };
  const ended = ticket && terminalTicket(ticket.status);
  const start = async () => {
    if (locked.current || current.current?.status !== "called") return;
    locked.current = true; generation.current++; setBusy(true); setError("");
    try { accept(await participantApi<QueueTicket>("queue/start", { method: "POST" })); }
    catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not start. Please retry.");
      try { accept(await participantApi<QueueTicket>("queue/ticket")); } catch { /* Keep the current ticket so a temporary failure can retry. */ }
    } finally { locked.current = false; setBusy(false); }
  };
  const saveDrawing = async () => {
    if (saving) return;
    setSaving(true); setError("");
    try {
      const response = await fetch("/api/participant/queue/result", { cache: "no-store" });
      if (!response.ok) { const message = await response.json().catch(() => null); throw new Error(message?.error || "Could not download your drawing. Please retry."); }
      const url = URL.createObjectURL(await response.blob()), link = document.createElement("a");
      link.href = url; link.download = "out-of-body-completed.png"; document.body.appendChild(link); link.click(); link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not download your drawing. Please retry."); }
    finally { setSaving(false); }
  };
  return <main className="mobile-participant" data-testid="mobile-flow" data-step={step} data-terminal={!!ended}><header className="mobile-brand"><h1><BrandLogo /></h1></header>
    {notice && <p className="participant-note">{notice}</p>}
    {!initialized ? <p className="mobile-loading" role="status">Checking the installation…</p> : step === "about" ? <section className="mobile-about"><h2 className="visually-hidden">About Out of Body</h2>
      <button className="primary-action about-home" aria-label="Back to home" onClick={() => setStep("landing")}><DesignIcon name="home" /></button>
      <p>Out of Body revolves around an artistic release of the self. Participants have the chance to release sensations and emotions that their body and mind are going through. This design bridges a digital interface real-time feedback together with tangible tactile expression, where users are encouraged to regain their dynamic body movement.</p>
      <p>By reflecting on how your body has been feeling lately, this interactive, experiential space provides a process that anyone can use to reconnect with their body in a few minutes, without equipment, and move freely!</p>
      <p>This project gives an avenue for people who either sit too long from studying or those who work out a lot to release any tensions that may be building up in their bodies because people tend to ignore what their body is actually telling them. When they put their discomfort into color, they can actually see it, instead of just pushing through. As they move according to the colors, they feel that doing so makes them feel better. That&apos;s what makes them want to check in with their body and move again next time until it turns into a habit.</p></section>
      : step === "landing" ? <section className="mobile-landing"><h2 className="visually-hidden">Your drawing, in motion</h2><p className="visually-hidden">Prepare your drawing while another participant stretches.</p>
        <div className="mobile-primary-actions"><button className="primary-action" onClick={() => ticket && !terminalTicket(ticket.status) ? setStep(ticket.status === "preparing" ? "camera" : "waiting") : void join()} disabled={busy || (!ticket || terminalTicket(ticket.status)) && !queue?.accepting}><DesignIcon name="camera" />{busy ? "Loading…" : ticket && !terminalTicket(ticket.status) ? ticket.status === "preparing" ? "Continue my drawing" : "View my ticket" : "Upload drawing"}</button>
        <button className="about-action" onClick={() => setStep("about")}>About <em>Out of Body</em></button></div>
        <p className="intake-status" role="status">{!queue ? "Checking available slots…" : !queue.online ? "The installation is not accepting participants yet." : !queue.accepting ? "The queue is currently full. Please try again shortly." : `${queue.waiting} of ${queue.capacity} waiting slots reserved.`}</p></section>
      : ended ? <section className="mobile-ended"><h2>{ticket.status === "completed" ? "Thank you for moving!" : ticket.status === "expired" ? "Your ticket expired" : "Ticket cancelled"}</h2>
        <p>{ticket.status === "completed" ? "Please take home a care card and remember to look after your body." : "Your temporary drawing is scheduled for deletion."}</p>
        {ticket.status === "completed" && ticket.downloadAvailable && <>
          <button className="primary-action" disabled={saving} onClick={() => void saveDrawing()}>{saving ? "Saving…" : "Save your drawing"}</button>
          <p className="participant-note">Available for one hour after your session.</p>
        </>}
        <button className="primary-action home-action" onClick={() => setStep("landing")}><DesignIcon name="home" />Back to home</button></section>
      : step === "camera" ? <MobileCapture camera={camera} onCapture={() => void capture()} onChoose={file => void choose(file)} busy={busy || photo.busy} />
      : step === "preview" ? <MobilePreview photo={photo} name={name} onName={setName} sending={busy} onSend={() => void send()} onRetake={() => { photo.clear(); setStep("camera"); }} />
      : ticket && <section className="mobile-ticket" data-testid="queue-ticket" data-status={ticket.status}><div className="ticket-content"><h2>{ticket.status === "active" ? "Drawing on screen" : ticket.status === "called" ? "It’s your turn" : "Drawing uploaded"}</h2>
        <p className="ticket-message" role="status" aria-live="polite" aria-atomic="true">{ticket.status === "active" ? "Please move to the screen and let’s start stretching!" : ticket.status === "called" ? "Head to the exhibit screen. Start your session when you’re ready." : `You’re #${ticket.ahead + 1} in line. Please wait for your turn.`}</p>
        {ticket.status === "called" && <button className="primary-action phone-start-action" disabled={busy} onClick={() => void start()}>{busy ? "Starting…" : "Start my session"}</button>}
        </div><button className={`${ticket.status === "called" ? "secondary-action" : "primary-action"} home-action`} onClick={() => setStep("landing")}><DesignIcon name="home" />Back to home</button></section>}
    {ticket && !ended && <div className="ticket-footer">
      <button className="secondary-action ticket-cancel-action" disabled={busy} onClick={() => setCancelRequest(ticket.id)}>Cancel my ticket</button></div>}
    <TicketCancelDialog open={!!cancelRequest && ticket?.id === cancelRequest && !ended && !busy} onClose={() => setCancelRequest(null)}
      onConfirm={() => { const id = cancelRequest; setCancelRequest(null); if (current.current?.id === id && !terminalTicket(current.current.status)) void cancel(); }} />
    {photo.busy && <p role="status">Preparing preview…</p>}{(error || connectionError || photo.error) && <p role="alert" className="error-message">{error || connectionError || photo.error}</p>}
  </main>;
}
