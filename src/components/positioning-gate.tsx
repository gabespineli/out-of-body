"use client";
import { useEffect, useRef, useState } from "react";
import type { useCamera } from "@/hooks/use-camera";
import { SEGMENTS } from "@/lib/rig";

type Props = { camera: ReturnType<typeof useCamera>; visible: boolean; ready: boolean; valid: boolean; message: string; hasColor: boolean; onStart: () => void; onBack: () => void };
// Keep one live video mounted as the setup preview becomes the background tracker.
export function PositioningGate({ camera, visible, ready, valid, message, hasColor, onStart, onBack }: Props) {
  const heading = useRef<HTMLHeadingElement>(null), [aspect, setAspect] = useState(4 / 3);
  useEffect(() => { if (visible) heading.current?.focus(); }, [visible]);
  const live = camera.status === "live", pending = camera.status === "loading" || camera.status === "permission";
  return <section className={visible ? "positioning-gate" : "background-tracker"} aria-hidden={!visible} data-testid="positioning-gate" data-ready={ready}>
    {visible && <><p className="eyebrow">Before you begin</p><h2 ref={heading} tabIndex={-1}>Get into position</h2><p>Face the camera. Leave room for your arms and legs to move.</p></>}
    <div className="positioning-preview" data-valid={valid} style={{ aspectRatio: aspect }}>
      <video ref={camera.videoRef} autoPlay playsInline muted aria-label="Positioning camera preview" onLoadedMetadata={event => { const video = event.currentTarget; if (video.videoWidth && video.videoHeight) setAspect(video.videoWidth / video.videoHeight); }} />
      {visible && <><div className="positioning-boundary" /><svg className="positioning-outline" viewBox="0 0 600 900" aria-hidden="true">{Object.values(SEGMENTS).map((path, index) => <path key={index} d={path} />)}</svg>
        {!live && <span className="positioning-placeholder">{pending ? "Opening camera…" : "Your camera preview appears here"}</span>}</>}
    </div>
    {visible && <><p role="status" className="positioning-message">{!hasColor ? "No colored regions detected. Check the drawing alignment or add colored marks." : ready ? "You’re in position. Ready when you are." : live ? message : "Enable the camera to check your position."}</p>
      {camera.error && <p role="alert" className="error-message">{camera.error}</p>}
      {live ? <button className="primary-action" onClick={onStart} disabled={!ready || !hasColor}>Start stretching</button>
        : <button className="primary-action" onClick={() => void camera.start()} disabled={pending}>{pending ? "Opening camera…" : camera.status === "error" ? "Try camera again" : "Enable camera"}</button>}
      {pending ? <button className="quiet-action" onClick={camera.stop}>Cancel camera</button> : <button className="quiet-action" onClick={onBack}>Back to setup</button>}</>}
  </section>;
}
