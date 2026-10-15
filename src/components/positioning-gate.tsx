"use client";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import type { useCamera } from "@/hooks/use-camera";
import { SEGMENTS } from "@/lib/rig";
import { BrandLogo } from "./design-brand";
import { CameraSelect } from "./camera-select";
import { useAutoCamera } from "@/hooks/use-camera-devices";

type Props = { camera: ReturnType<typeof useCamera>; visible: boolean; countdown: number | null; valid: boolean; message: string; hasColor: boolean; onStart: () => void; onBack: () => void };
// Keep one live video mounted as the setup preview becomes the background tracker.
export function PositioningGate({ camera, visible, countdown, valid, message, hasColor, onStart, onBack }: Props) {
  const heading = useRef<HTMLHeadingElement>(null), [aspect, setAspect] = useState(4 / 3);
  useAutoCamera(visible, camera.startAllowed);
  useEffect(() => { if (visible) heading.current?.focus(); }, [visible]);
  const live = camera.status === "live", pending = camera.status === "loading" || camera.status === "permission";
  useEffect(() => { if (visible && live && valid && hasColor && countdown === 0 && !document.hidden) onStart(); }, [visible, live, valid, hasColor, countdown, onStart]);
  return <section className={visible ? "positioning-gate" : "background-tracker"} aria-hidden={!visible} data-testid="positioning-gate" data-ready={countdown === 0}>
    {visible && <><BrandLogo /><p className="eyebrow">Before you begin</p><h2 ref={heading} tabIndex={-1}>Get into position</h2><p>Face the camera. Leave room for your arms and legs to move.</p></>}
    <div className="positioning-content"><div className="positioning-camera"><div className="positioning-preview" data-valid={valid} style={{ aspectRatio: aspect, "--camera-aspect": aspect } as CSSProperties}>
      <video ref={camera.videoRef} autoPlay playsInline muted aria-label="Positioning camera preview" onLoadedMetadata={event => { const video = event.currentTarget; if (video.videoWidth && video.videoHeight) setAspect(video.videoWidth / video.videoHeight); }} />
      {visible && <><div className="positioning-boundary" /><svg className="positioning-outline" viewBox="0 0 600 900" aria-hidden="true">{Object.values(SEGMENTS).map((path, index) => <path key={index} d={path} />)}</svg>
        {!live && <span className="positioning-placeholder">{pending ? "Opening camera…" : "Your camera preview appears here"}</span>}
        {live && hasColor && valid && countdown !== null && <div className="positioning-countdown" role="status" aria-live="polite" aria-atomic="true" data-testid="positioning-countdown">
          <span aria-hidden="true">In position</span><span className="visually-hidden">Your position is stable. Stretching starts in </span>
          <strong>{Math.max(1, countdown)}</strong><span className="visually-hidden"> seconds.</span><span aria-hidden="true">Hold steady</span>
        </div>}</>}
    </div>
    {visible && <CameraSelect devices={camera.devices} deviceId={camera.deviceId} disabled={pending} onChange={camera.selectCamera} />}
    </div>{visible && <div className="positioning-help"><p role="status" className="positioning-message">{!hasColor ? "No colored regions detected. Check the drawing alignment or add colored marks." : live && valid ? "Hold steady. Stretching will begin automatically." : live ? message : "Enable the camera to check your position."}</p>
      {camera.error && <p role="alert" className="error-message">{camera.error}</p>}
      {!live && <button className="primary-action" onClick={() => void camera.start()} disabled={pending}>{pending ? "Opening camera…" : camera.status === "error" ? "Try camera again" : "Enable camera"}</button>}
      {pending ? <button className="quiet-action" onClick={camera.stop}>Cancel camera</button> : <button className="quiet-action" onClick={onBack}>Back to setup</button>}</div>}</div>
  </section>;
}
