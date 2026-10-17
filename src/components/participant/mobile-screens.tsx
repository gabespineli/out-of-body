"use client";
import { useEffect, useRef, useState } from "react";
import { SEGMENTS } from "@/lib/rig";
import { drawAlignedPhoto } from "@/lib/artwork";
import { cleanDrawingCanvas } from "@/lib/drawing-cleanup";
import { usePhotoGestures } from "@/hooks/use-photo-gestures";
import type { usePhotoPreview } from "@/hooks/use-photo-preview";
import type { useMobileCamera } from "@/hooks/use-mobile-camera";
import { DesignIcon } from "../design-brand";
import { useAutoCamera } from "@/hooks/use-camera-devices";
import { PhotoGestureHint } from "./photo-gesture-hint";
export function TemplateGuide() {
  return <svg className="photo-template" viewBox="0 0 600 900" aria-hidden="true">{Object.values(SEGMENTS).map((path, index) =>
    <path key={index} d={path} fill="none" stroke="#fa4278" strokeWidth="2" strokeDasharray="9 7" />)}</svg>;
}
export function MobileLanding({ connected, onContinue }: { connected: boolean; onContinue: () => void }) {
  return <section aria-labelledby="mobile-landing-title"><h2 id="mobile-landing-title">Your drawing, in motion</h2>
    <p>{connected ? "Photograph your drawing, then move to the installation." : "Scan the QR code on the installation to connect your phone."}</p>
    <button disabled={!connected} onClick={onContinue}>Upload drawing</button>
    <details><summary>About Out of Body</summary><p>Draw how your body feels, then follow gentle movement. Fading colors represent symbolic progress.</p></details>
  </section>;
}
export function MobileCapture({ camera, onCapture, onChoose, busy }: { camera: ReturnType<typeof useMobileCamera>; onCapture: () => void; onChoose: (file: File) => void; busy: boolean }) {
  useAutoCamera(true, camera.startAllowed);
  return <section className="mobile-capture" aria-labelledby="mobile-camera-title"><h2 className="visually-hidden" id="mobile-camera-title">Photograph your drawing</h2>
    <p className="mobile-alignment-heading">Align your drawing to the outline below.</p>
    <div className="mobile-editor-stage"><div className="phone-camera" data-live={camera.status === "live"}><video ref={camera.video} autoPlay playsInline muted aria-label="Drawing camera preview" />
      {camera.status === "live" ? <TemplateGuide /> : <img className="capture-template" src="/design/body-template.webp" alt="Drawing sheet outline" />}</div></div>
    <div className="mobile-primary-actions">{camera.status === "live" ? <button className="primary-action" onClick={onCapture} disabled={busy}><DesignIcon name="camera" />Take photo</button>
      : <button className="primary-action" onClick={() => void camera.start()} disabled={busy || camera.status === "requesting"}><DesignIcon name="camera" />{camera.status === "requesting" ? "Opening camera…" : "Open camera"}</button>}
      {camera.status === "requesting" && <button className="quiet-action" onClick={camera.stop}>Cancel camera</button>}</div>
    <label className="field-label">Or choose a photo<input data-testid="mobile-photo" type="file" accept="image/jpeg,image/png,image/webp" disabled={busy}
      onChange={event => { const file = event.target.files?.[0]; if (file) onChoose(file); event.target.value = ""; }} /></label>
    {camera.error && <p role="alert" className="error-message">{camera.error}</p>}
  </section>;
}
export function MobilePreview({ photo, onRetake, onSend, sending, name, onName }: { photo: ReturnType<typeof usePhotoPreview>; onRetake: () => void; onSend: () => void; sending: boolean; name?: string; onName?: (value: string) => void }) {
  const preview = useRef<HTMLCanvasElement>(null);
  const [dismissedPhoto, setDismissedPhoto] = useState<HTMLImageElement | null>(null);
  const showOnboarding = !!photo.image && dismissedPhoto !== photo.image && !sending;
  const gestures = usePhotoGestures(photo.alignment, photo.setAlignment, sending || showOnboarding, photo.image);
  const dismissOnboarding = () => {
    setDismissedPhoto(photo.image);
    requestAnimationFrame(() => gestures.surface.current?.focus({ preventScroll: true }));
  };
  useEffect(() => {
    if (!photo.image || !preview.current) return;
    const frame = requestAnimationFrame(() => {
      if (photo.image && preview.current) {
        drawAlignedPhoto(preview.current.getContext("2d")!, photo.image, photo.alignment);
        if (!photo.showOriginal) cleanDrawingCanvas(preview.current, photo.cleanupStrength);
      }
    });
    return () => cancelAnimationFrame(frame);
  }, [photo.image, photo.alignment, photo.cleanupStrength, photo.showOriginal]);
  return <section className="mobile-preview-screen" aria-labelledby="mobile-preview-title"><h2 className="visually-hidden" id="mobile-preview-title">Preview your drawing</h2>
    <p className="mobile-alignment-heading">Align your drawing to the outline below.</p>
    <span className="visually-hidden" id="photo-gesture-hint">Use two fingers together to move the photo, or pinch to zoom. Match the outline.</span>
    <div className="mobile-editor-stage"><div className={`phone-photo touch-align${gestures.active ? " is-aligning" : ""}`} ref={gestures.surface} {...gestures.handlers}
      tabIndex={sending ? -1 : 0} role="group" aria-label="Align your drawing" aria-disabled={sending} aria-describedby="photo-gesture-hint photo-keyboard-hint"
      data-testid="photo-alignment" data-scale={photo.alignment.scale} data-x={photo.alignment.x} data-y={photo.alignment.y} data-rotation={photo.alignment.rotation}>
      <canvas ref={preview} width="600" height="900" data-testid="mobile-preview" aria-label="Prepared drawing preview" /><TemplateGuide />
      {showOnboarding && <PhotoGestureHint onDismiss={dismissOnboarding} />}
    </div></div>
    <span className="visually-hidden" id="photo-keyboard-hint">Arrow keys move the photo. Plus and minus zoom.</span>
    {onName && <div className="participant-name-slot"><label className="field-label participant-name">Name<input type="text" autoComplete="off" enterKeyHint="done" maxLength={40} value={name || ""} disabled={sending}
      onKeyDown={event => { if (event.key === "Enter") { event.preventDefault(); event.currentTarget.blur(); } }}
      onChange={event => onName(event.target.value)} /></label></div>}
    <div className="mobile-primary-actions editor-actions"><button className="secondary-action" aria-label="Retake / choose again" onClick={onRetake} disabled={sending}>Retake</button><button className="primary-action" aria-label={sending ? "Sending drawing…" : "Send to installation"} onClick={onSend} disabled={sending}><DesignIcon name="camera" />{sending ? "Sending…" : "Send drawing"}</button></div>
  </section>;
}
export function MobileSent({ received }: { received: boolean }) {
  return <section aria-labelledby="mobile-sent-title"><h2 id="mobile-sent-title">Drawing uploaded</h2>
    <p role="status">{received ? "Your drawing is on the installation." : "The installation is retrieving your drawing."}</p>
    <p>Move to the screen and start stretching.</p><p className="participant-note">The temporary copy is deleted when the session ends or expires.</p>
  </section>;
}
