"use client";
import { useCallback, useRef, useState } from "react";
import { participantApi, ParticipantApiError } from "@/lib/participant-api";
import { participantName, terminalTicket, type QueuePublic, type QueueTicket } from "@/lib/queue";
import { useMobileCamera } from "@/hooks/use-mobile-camera";
import { usePhotoPreview } from "@/hooks/use-photo-preview";
import { useVisiblePoll } from "@/hooks/use-visible-poll";
import { MobileCapture, MobilePreview } from "./mobile-screens";
export function QueueMobileFlow({ notice }: { notice: string }) {
  const camera = useMobileCamera(), photo = usePhotoPreview();
  const [ticket, setTicket] = useState<QueueTicket | null>(null), [queue, setQueue] = useState<QueuePublic | null>(null);
  const [step, setStep] = useState<"landing" | "camera" | "preview" | "waiting" | "about">("landing");
  const [name, setName] = useState(""), [busy, setBusy] = useState(false), [error, setError] = useState(""), [initialized, setInitialized] = useState(false);
  const [connectionError, setConnectionError] = useState("");
  const locked = useRef(false), current = useRef(ticket), generation = useRef(0);
  const accept = useCallback((value: QueueTicket) => {
    const previous = current.current;
    current.current = value;
    setTicket(value);
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
  return <main className="mobile-participant" data-testid="mobile-flow" data-step={step}><header><h1>Out of Body</h1></header>
    {notice && <p className="participant-note">{notice}</p>}
    {!initialized ? <p role="status">Checking the installation…</p> : step === "about" ? <section><h2>About Out of Body</h2>
      <p>Draw how your body feels, then bring that drawing to life through gentle movement. Follow the guide as the colored marks gradually fade.</p>
      <p>Take your time, stay comfortable, and skip any activity. The changing colors represent symbolic progress.</p><button onClick={() => setStep("landing")}>Back to home</button></section>
      : step === "landing" ? <section><h2 className="visually-hidden">Your drawing, in motion</h2><p>Prepare your drawing while another participant stretches.</p>
        <p role="status">{!queue ? "Checking available slots…" : !queue.online ? "The installation is not accepting participants yet." : !queue.accepting ? "The queue is currently full. Please try again shortly." : `${queue.waiting} of ${queue.capacity} waiting slots reserved.`}</p>
        <div className="mobile-primary-actions"><button className="primary-action" onClick={() => ticket && !terminalTicket(ticket.status) ? setStep(ticket.status === "preparing" ? "camera" : "waiting") : void join()} disabled={busy || (!ticket || terminalTicket(ticket.status)) && !queue?.accepting}>{busy ? "Reserving your slot…" : ticket && !terminalTicket(ticket.status) ? ticket.status === "preparing" ? "Continue my drawing" : "View my ticket" : "Upload drawing"}</button>
        <button className="quiet-action" onClick={() => setStep("about")}>About Out of Body</button></div></section>
      : ended ? <section><h2>{ticket.status === "completed" ? "Thank you for moving!" : ticket.status === "expired" ? "Your ticket expired" : "Ticket cancelled"}</h2>
        <p>{ticket.status === "completed" ? "Please take home a care card and remember to look after your body." : "Your temporary drawing is scheduled for deletion."}</p>
        <button onClick={() => setStep("landing")}>Back to home</button></section>
      : step === "camera" ? <MobileCapture camera={camera} onCapture={() => void capture()} onChoose={file => void choose(file)} busy={busy || photo.busy} />
      : step === "preview" ? <MobilePreview photo={photo} name={name} onName={setName} sending={busy} onSend={() => void send()} onRetake={() => { photo.clear(); setStep("camera"); }} />
      : ticket && <section className="mobile-ticket" data-testid="queue-ticket"><h2>{ticket.status === "called" ? "It’s your turn" : ticket.status === "active" ? "Your drawing is on screen" : "Drawing uploaded"}</h2>
        <p className="ticket-number">Ticket {ticket.number}</p>{ticket.name && <p>{ticket.name}</p>}
        <p role="status">{ticket.status === "called" ? "Please move to the stretching screen. Staff will start your session." : ticket.status === "active" ? "Follow the guide on the installation." : `${ticket.ahead} ${ticket.ahead === 1 ? "person" : "people"} ahead of you. Listen for your ticket or name.`}</p>
        <p className="participant-note">Keep this page open to see when you are called. Tickets expire after 90 minutes of waiting.</p><button className="quiet-action" onClick={() => setStep("landing")}>Back to home</button></section>}
    {ticket && !ended && <div className="ticket-footer"><span>Ticket {ticket.number}{ticket.status === "preparing" ? " · 10 minutes to prepare" : ""}</span>
      <details><summary>Ticket options</summary><button className="quiet-action" disabled={busy} onClick={() => void cancel()}>Cancel my ticket</button></details></div>}
    {photo.busy && <p role="status">Preparing preview…</p>}{(error || connectionError || photo.error) && <p role="alert" className="error-message">{error || connectionError || photo.error}</p>}
  </main>;
}
