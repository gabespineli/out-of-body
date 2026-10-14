"use client";
import { useEffect, useRef } from "react";
import { SEGMENTS } from "@/lib/rig";
import { drawAlignedPhoto } from "@/lib/artwork";
import { cleanDrawingCanvas } from "@/lib/drawing-cleanup";
import { usePhotoGestures } from "@/hooks/use-photo-gestures";
import type { usePhotoPreview } from "@/hooks/use-photo-preview";
import type { useMobileCamera } from "@/hooks/use-mobile-camera";
export function TemplateGuide() {
  return <svg className="photo-template" viewBox="0 0 600 900" aria-hidden="true">{Object.values(SEGMENTS).map((path, index) =>
    <path key={index} d={path} fill="none" stroke="#ad3156" strokeWidth="2" strokeDasharray="9 7" />)}</svg>;
}
export function MobileLanding({ connected, onContinue }: { connected: boolean; onContinue: () => void }) {
  return <section aria-labelledby="mobile-landing-title"><h2 id="mobile-landing-title">Your drawing, in motion</h2>
    <p>{connected ? "Photograph your drawing, then move to the installation." : "Scan the QR code on the installation to connect your phone."}</p>
    <button disabled={!connected} onClick={onContinue}>Upload drawing</button>
    <details><summary>About Out of Body</summary><p>Draw how your body feels, then follow gentle movement. Fading colors represent symbolic progress.</p></details>
  </section>;
}
export function MobileCapture({ camera, onCapture, onChoose, busy }: { camera: ReturnType<typeof useMobileCamera>; onCapture: () => void; onChoose: (file: File) => void; busy: boolean }) {
  return <section aria-labelledby="mobile-camera-title"><h2 id="mobile-camera-title">Photograph your drawing</h2>
    <p>Keep the whole page upright. Match the outline.</p>
    <div className="phone-camera"><video ref={camera.video} autoPlay playsInline muted aria-label="Drawing camera preview" /><TemplateGuide /></div>
    <div className="button-row">{camera.status === "live" ? <button onClick={onCapture} disabled={busy}>Take photo</button>
      : <button onClick={() => void camera.start()} disabled={busy || camera.status === "requesting"}>{camera.status === "requesting" ? "Opening camera…" : "Open camera"}</button>}
      {camera.status === "requesting" && <button onClick={camera.stop}>Cancel camera</button>}</div>
    <label className="field-label">Or choose a photo<input data-testid="mobile-photo" type="file" accept="image/jpeg,image/png,image/webp" disabled={busy}
      onChange={event => { const file = event.target.files?.[0]; if (file) onChoose(file); event.target.value = ""; }} /></label>
    {camera.error && <p role="alert" className="error-message">{camera.error}</p>}
  </section>;
}
export function MobilePreview({ photo, onRetake, onSend, sending, name, onName }: { photo: ReturnType<typeof usePhotoPreview>; onRetake: () => void; onSend: () => void; sending: boolean; name?: string; onName?: (value: string) => void }) {
  const preview = useRef<HTMLCanvasElement>(null);
  const gestures = usePhotoGestures(photo.alignment, photo.setAlignment, sending, photo.image);
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
  return <section aria-labelledby="mobile-preview-title"><h2 id="mobile-preview-title">Preview your drawing</h2>
    <p id="photo-gesture-hint">Drag to move. Pinch to zoom. Match the outline.</p>
    <div className={`phone-photo touch-align${gestures.active ? " is-aligning" : ""}`} ref={gestures.surface} {...gestures.handlers}
      tabIndex={sending ? -1 : 0} role="group" aria-label="Align your drawing" aria-disabled={sending} aria-describedby="photo-gesture-hint photo-keyboard-hint"
      data-testid="photo-alignment" data-scale={photo.alignment.scale} data-x={photo.alignment.x} data-y={photo.alignment.y} data-rotation={photo.alignment.rotation}>
      <canvas ref={preview} width="600" height="900" data-testid="mobile-preview" aria-label="Prepared drawing preview" /><TemplateGuide />
    </div>
    <span className="visually-hidden" id="photo-keyboard-hint">Arrow keys move the photo. Plus and minus zoom. Fine adjustment includes rotation.</span>
    <details className="photo-adjustments"><summary>Adjust photo</summary>
    <div className="button-row photo-quick-controls" aria-label="Photo alignment controls">
      <button type="button" aria-label="Zoom out" disabled={sending || photo.alignment.scale <= .5} onClick={() => gestures.zoom(1 / 1.2)}>−</button>
      <output aria-label="Photo zoom" aria-live="off">{Math.round(photo.alignment.scale * 100)}%</output>
      <button type="button" aria-label="Zoom in" disabled={sending || photo.alignment.scale >= 3} onClick={() => gestures.zoom(1.2)}>+</button>
      <button type="button" disabled={sending} onClick={gestures.reset}>Reset alignment</button>
    </div>
    <details><summary>Fine adjustment</summary>{([
      ["scale", "Zoom", .5, 3, .01], ["x", "Horizontal", -250, 250, 1], ["y", "Vertical", -400, 400, 1], ["rotation", "Rotation", -30, 30, 1],
    ] as const).map(([key, label, min, max, step]) => <label key={key} className="slider-label">{label}<input type="range" aria-label={`Mobile photo ${label.toLowerCase()}`}
      value={photo.alignment[key]} min={min} max={max} step={step} disabled={sending} onChange={event => photo.setAlignment({ ...photo.alignment, [key]: +event.target.value })} /></label>)}</details>
    <fieldset className="drawing-cleanup"><legend>Drawing cleanup</legend>
      <label className="field-label">Compare preview<select aria-label="Preview version" disabled={sending} value={photo.showOriginal ? "original" : "cleaned"} onChange={event => photo.setShowOriginal(event.target.value === "original")}><option value="cleaned">Cleaned</option><option value="original">Original</option></select></label>
      <label className="slider-label">Cleanup amount<input type="range" aria-label="Cleanup amount" min="0" max="1" step=".05" disabled={sending} value={photo.cleanupStrength}
        onChange={event => { photo.setCleanupStrength(+event.target.value); photo.setShowOriginal(false); }} /></label>
      <p className="participant-note">Check faint marks and shadows. Only the cleaned version is sent; set the amount to zero to send the original alignment.</p>
    </fieldset></details>
    {onName && <label className="field-label participant-name">Name we can call at the exhibit<input type="text" autoComplete="off" maxLength={40} value={name || ""} disabled={sending}
      onChange={event => onName(event.target.value)} /><span>First name or nickname — optional. Exhibit staff use it to call your ticket.</span></label>}
    {photo.showOriginal && <p role="status">Comparing the original. Select Cleaned to check the version that will be sent.</p>}
    <div className="mobile-primary-actions"><button className="primary-action" onClick={onSend} disabled={sending}>{sending ? "Sending drawing…" : "Send to installation"}</button><button className="quiet-action" onClick={onRetake} disabled={sending}>Retake / choose again</button></div>
  </section>;
}
export function MobileSent({ received }: { received: boolean }) {
  return <section aria-labelledby="mobile-sent-title"><h2 id="mobile-sent-title">Drawing uploaded</h2>
    <p role="status">{received ? "Your drawing is on the installation." : "The installation is retrieving your drawing."}</p>
    <p>Move to the screen and start stretching.</p><p className="participant-note">The temporary copy is deleted when the session ends or expires.</p>
  </section>;
}
