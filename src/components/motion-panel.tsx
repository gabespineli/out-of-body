"use client";
import type { useCamera } from "@/hooks/use-camera";
import { GESTURES, type Gesture, type Motion } from "@/lib/pose";

export type ManualPose = { left: number; right: number; lean: number };
type Props = {
  camera: ReturnType<typeof useCamera>;
  mode: "camera" | "manual"; setMode: (mode: "camera" | "manual") => void;
  gesture: Gesture; setGesture: (gesture: Gesture) => void;
  manual: ManualPose; setManual: (pose: ManualPose) => void;
  detected: Motion;
};

export function MotionPanel({ camera, mode, setMode, gesture, setGesture, manual, setManual, detected }: Props) {
  const pending = camera.status === "permission" || camera.status === "loading";
  const both = manual.left === 1 && manual.right === 1;
  return <section className="control-section motion-section" aria-labelledby="motion-title">
    <h2 id="motion-title">Motion</h2>
    <div className="segmented mode-options" aria-label="Motion source"><button aria-pressed={mode === "camera"} onClick={() => setMode("camera")}>Webcam</button><button aria-pressed={mode === "manual"} onClick={() => setMode("manual")}>Manual demo</button></div>
    <div className={`camera-preview ${mode === "manual" ? "manual-preview" : ""}`}>
      <video ref={camera.videoRef} muted playsInline autoPlay aria-label="Mirrored webcam preview" className={camera.status === "live" || camera.status === "loading" ? "video-visible" : ""} />
      {mode === "camera" && camera.status !== "live" && camera.status !== "loading" && <div className="camera-placeholder">{camera.status === "permission" ? "Allow camera access in your browser" : "Camera off"}</div>}
      {camera.status === "live" && mode === "camera" && <span className="preview-status">{camera.tracking ? `Body found · ${camera.fps} fps` : "No body detected"}</span>}
      {camera.status === "loading" && <span className="preview-status">Loading tracker…</span>}
    </div>
    {mode === "camera" ? <>
      {camera.status === "live" ? <button className="full-width" onClick={camera.stop}>Stop camera</button> : <button className="full-width" disabled={pending} onClick={() => void camera.start()}>{camera.status === "permission" ? "Waiting for permission…" : camera.status === "loading" ? "Starting tracking…" : camera.status === "error" ? "Try camera again" : "Enable camera"}</button>}
      {pending && <button className="full-width" onClick={camera.stop}>Cancel camera</button>}
      {camera.error && <p className="error-message" role="alert">{camera.error}</p>}
      <p className="camera-hint">Keep shoulders, hips and hands in view.</p>
      <p className="tracking-parts" data-testid="tracking-parts">Left arm: {detected.leftVisible ? "visible" : "missing"} · Right arm: {detected.rightVisible ? "visible" : "missing"} · Hips: {detected.hipsVisible ? "visible" : "missing"}</p>
    </> : <div className="manual-controls">
      <div className="manual-pose-buttons">
        <button aria-pressed={both} onClick={() => setManual({ left: both ? 0 : 1, right: both ? 0 : 1, lean: 0 })}>Raise arms</button>
        <button aria-pressed={manual.lean === -1} onClick={() => setManual({ left: 0, right: 0, lean: manual.lean === -1 ? 0 : -1 })}>Lean left</button>
        <button aria-pressed={manual.lean === 1} onClick={() => setManual({ left: 0, right: 0, lean: manual.lean === 1 ? 0 : 1 })}>Lean right</button>
      </div>
      <label className="slider-label">Left arm<input type="range" min="0" max="1" step=".01" value={manual.left} aria-label="Manual left arm height" onChange={event => setManual({ ...manual, left: +event.target.value })} /></label>
      <label className="slider-label">Right arm<input type="range" min="0" max="1" step=".01" value={manual.right} aria-label="Manual right arm height" onChange={event => setManual({ ...manual, right: +event.target.value })} /></label>
      <label className="slider-label">Side lean<input type="range" min="-1" max="1" step=".01" value={manual.lean} aria-label="Manual side lean" onChange={event => setManual({ ...manual, lean: +event.target.value })} /></label>
      <button onClick={() => setManual({ left: 0, right: 0, lean: 0 })}>Return to rest</button>
    </div>}
    <label className="field-label gesture-select">Gesture to hold<select aria-label="Gesture to hold" value={gesture} onChange={event => setGesture(event.target.value as Gesture)}>{GESTURES.map(g => <option key={g.value} value={g.value}>{g.label}</option>)}</select></label>
  </section>;
}
