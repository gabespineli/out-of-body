"use client";
import type { useCamera } from "@/hooks/use-camera";
import { GESTURES, REST_LEGS, REST_HIPS, type Gesture, type Motion, type ManualLegs, type ManualHips } from "@/lib/pose";

export type ManualPose = { left: number; right: number; lean: number } & ManualLegs & ManualHips;
export const MANUAL_REST: ManualPose = { left: 0, right: 0, lean: 0, ...REST_LEGS, ...REST_HIPS };
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
      <p className="camera-hint">Step back so hands, knees and feet stay in view.</p>
      <p className="tracking-parts" data-testid="tracking-parts">Left arm: {detected.leftVisible ? "visible" : "missing"} · Right arm: {detected.rightVisible ? "visible" : "missing"} · Hips: {detected.hipsVisible ? "visible" : "missing"}</p>
      <p className="tracking-parts" data-testid="tracking-legs">Left leg: {detected.leftLegVisible ? "visible" : "missing"} · Right leg: {detected.rightLegVisible ? "visible" : "missing"}</p>
    </> : <div className="manual-controls">
      <div className="manual-pose-buttons">
        <button aria-pressed={both} onClick={() => setManual({ ...MANUAL_REST, left: both ? 0 : 1, right: both ? 0 : 1 })}>Raise arms</button>
        <button aria-pressed={manual.lean === -1} onClick={() => setManual({ ...MANUAL_REST, lean: manual.lean === -1 ? 0 : -1 })}>Lean left</button>
        <button aria-pressed={manual.lean === 1} onClick={() => setManual({ ...MANUAL_REST, lean: manual.lean === 1 ? 0 : 1 })}>Lean right</button>
        <button aria-pressed={manual.leftLeg === 1} onClick={() => setManual({ ...MANUAL_REST, leftLeg: manual.leftLeg === 1 ? 0 : 1, leftKnee: manual.leftLeg === 1 ? 0 : .5 })}>Lift left leg</button>
        <button aria-pressed={manual.rightLeg === -1} onClick={() => setManual({ ...MANUAL_REST, rightLeg: manual.rightLeg === -1 ? 0 : -1, rightKnee: manual.rightLeg === -1 ? 0 : .5 })}>Lift right leg</button>
        <button aria-pressed={manual.hipTilt === -1} onClick={() => setManual({ ...manual, hipTilt: manual.hipTilt === -1 ? 0 : -1 })}>Rotate hips left</button>
        <button aria-pressed={manual.hipTilt === 1} onClick={() => setManual({ ...manual, hipTilt: manual.hipTilt === 1 ? 0 : 1 })}>Rotate hips right</button>
      </div>
      <label className="slider-label">Left arm<input type="range" min="0" max="1" step=".01" value={manual.left} aria-label="Manual left arm height" onChange={event => setManual({ ...manual, left: +event.target.value })} /></label>
      <label className="slider-label">Right arm<input type="range" min="0" max="1" step=".01" value={manual.right} aria-label="Manual right arm height" onChange={event => setManual({ ...manual, right: +event.target.value })} /></label>
      <label className="slider-label">Side lean<input type="range" min="-1" max="1" step=".01" value={manual.lean} aria-label="Manual side lean" onChange={event => setManual({ ...manual, lean: +event.target.value })} /></label>
      <label className="slider-label">Hip rotation<input type="range" min="-1" max="1" step=".01" value={manual.hipTilt} aria-label="Manual hip rotation" onChange={event => setManual({ ...manual, hipTilt: +event.target.value })} /></label>
      <label className="slider-label">Left leg swing<input type="range" min="-1" max="1" step=".01" value={manual.leftLeg} aria-label="Manual left leg swing" onChange={event => setManual({ ...manual, leftLeg: +event.target.value })} /></label>
      <label className="slider-label">Right leg swing<input type="range" min="-1" max="1" step=".01" value={manual.rightLeg} aria-label="Manual right leg swing" onChange={event => setManual({ ...manual, rightLeg: +event.target.value })} /></label>
      <label className="slider-label">Left knee bend<input type="range" min="0" max="1" step=".01" value={manual.leftKnee} aria-label="Manual left knee bend" onChange={event => setManual({ ...manual, leftKnee: +event.target.value })} /></label>
      <label className="slider-label">Right knee bend<input type="range" min="0" max="1" step=".01" value={manual.rightKnee} aria-label="Manual right knee bend" onChange={event => setManual({ ...manual, rightKnee: +event.target.value })} /></label>
      <button onClick={() => setManual({ ...MANUAL_REST })}>Return to rest</button>
    </div>}
    <label className="field-label gesture-select">Gesture to hold<select aria-label="Gesture to hold" value={gesture} onChange={event => setGesture(event.target.value as Gesture)}>{GESTURES.map(g => <option key={g.value} value={g.value}>{g.label}</option>)}</select></label>
  </section>;
}
