"use client";
import type { useCamera } from "@/hooks/use-camera";
import { REST_LEGS, REST_HIPS, REST_HEAD, REST_FEET, type Motion, type ManualLegs, type ManualHips, type ManualHead, type ManualFeet } from "@/lib/pose";

import type { GuideStep } from "@/lib/guided";
import { areaConfig, type BodyArea } from "@/lib/body-areas";
export type ManualPose = { left: number; right: number; lean: number } & ManualLegs & ManualHips & ManualHead & ManualFeet;
export const MANUAL_REST: ManualPose = { left: 0, right: 0, lean: 0, ...REST_LEGS, ...REST_HIPS, ...REST_HEAD, ...REST_FEET };
type Props = {
  area: BodyArea; step: GuideStep; compact: boolean;
  camera: ReturnType<typeof useCamera>;
  mode: "camera" | "manual"; setMode: (mode: "camera" | "manual") => void;
  manual: ManualPose; setManual: (pose: ManualPose) => void;
  detected: Motion;
};

export function MotionPanel({ area, step, compact, camera, mode, setMode, manual, setManual, detected }: Props) {
  const pending = camera.status === "permission" || camera.status === "loading";
  const both = manual.left === 1 && manual.right === 1;
  return <section className="control-section motion-section" aria-labelledby="motion-title">
    <h2 id="motion-title">Motion</h2>
    <select aria-label="Motion source" value={mode} onChange={event => setMode(event.target.value as "camera" | "manual")}><option value="camera">Webcam</option><option value="manual">Manual demo</option></select>
    <div className={`camera-preview ${mode === "manual" ? "manual-preview" : ""}`}>
      <video ref={camera.videoRef} muted playsInline autoPlay aria-label="Mirrored webcam preview" className={camera.status === "live" || camera.status === "loading" ? "video-visible" : ""} />
      {mode === "camera" && camera.status !== "live" && camera.status !== "loading" && <div className="camera-placeholder">{camera.status === "permission" ? "Allow camera access in your browser" : "Camera off"}</div>}
    </div>
    {mode === "camera" ? <>
      {(camera.status === "live" || camera.status === "loading") && <p className="camera-status" role="status">{camera.status === "loading" ? "Loading tracker…" : camera.tracking ? "Body found" : "No body detected"}</p>}
      {camera.status === "live" ? <button className="full-width" onClick={camera.stop}>Stop camera</button> : <button className="full-width" disabled={pending} onClick={() => void camera.start()}>{camera.status === "permission" ? "Waiting for permission…" : camera.status === "loading" ? "Starting tracking…" : camera.status === "error" ? "Try camera again" : "Enable camera"}</button>}
      {pending && <button className="full-width" onClick={camera.stop}>Cancel camera</button>}
      {camera.error && <p className="error-message" role="alert">{camera.error}</p>}
      <p className="camera-hint">{area === "neck-head" ? "Keep your head and shoulders in view." : area === "arms-back" ? "Keep hands and hips in view." : "Step back so both feet are in view."}</p>
      <details className="tracking-details"><summary>Tracking details</summary>
      <p className="tracking-parts" data-testid="tracking-parts">Left arm: {detected.leftVisible ? "visible" : "missing"} · Right arm: {detected.rightVisible ? "visible" : "missing"} · Hips: {detected.hipsVisible ? "visible" : "missing"}</p>
      <p className="tracking-parts" data-testid="tracking-head">Head: {detected.headVisible ? "visible" : "missing"}</p>
      <p className="tracking-parts" data-testid="tracking-legs">Left leg: {detected.leftLegVisible ? "visible" : "missing"} · Right leg: {detected.rightLegVisible ? "visible" : "missing"}</p>
      </details>
    </> : compact ? <div className="manual-controls">
      <p className="camera-hint">Simulated movement</p>
      {area === "neck-head" && <label className="slider-label">Head tilt<input type="range" min="-1" max="1" step=".01" value={manual.headTilt} aria-label="Manual head tilt" onChange={event => setManual({ ...manual, headTilt: +event.target.value })} /></label>}
      {area === "arms-back" && <>
        <label className="slider-label">Left reach<input type="range" min="0" max="1" step=".01" value={manual.left} aria-label="Manual left arm height" onChange={event => setManual({ ...manual, left: +event.target.value })} /></label>
        <label className="slider-label">Right reach<input type="range" min="0" max="1" step=".01" value={manual.right} aria-label="Manual right arm height" onChange={event => setManual({ ...manual, right: +event.target.value })} /></label>
        {step === "side-stretch" && <label className="slider-label">Side lean<input type="range" min="-1" max="1" step=".01" value={manual.lean} aria-label="Manual side lean" onChange={event => setManual({ ...manual, lean: +event.target.value })} /></label>}
      </>}
      {area === "legs-feet" && (step === "heel-raise" ? <label className="slider-label">Heel raise<input type="range" min="0" max="1" step=".01" value={manual.heelRaise} aria-label="Manual heel raise" onChange={event => setManual({ ...manual, heelRaise: +event.target.value })} /></label> : <>
        <label className="slider-label">Left step<input type="range" min="0" max="1" step=".01" value={manual.leftLeg} aria-label="Manual left leg swing" onChange={event => setManual({ ...manual, leftLeg: +event.target.value })} /></label>
        <label className="slider-label">Right step<input type="range" min="-1" max="0" step=".01" value={manual.rightLeg} aria-label="Manual right leg swing" onChange={event => setManual({ ...manual, rightLeg: +event.target.value })} /></label>
      </>)}
      <button onClick={() => setManual({ ...MANUAL_REST })}>Return to rest</button>
    </div> : <div className="manual-controls">
      <div className="manual-pose-buttons">
        <button aria-pressed={manual.headTilt === -1} onClick={() => setManual({ ...MANUAL_REST, headTilt: manual.headTilt === -1 ? 0 : -1 })}>Tilt head left</button>
        <button aria-pressed={manual.headTilt === 1} onClick={() => setManual({ ...MANUAL_REST, headTilt: manual.headTilt === 1 ? 0 : 1 })}>Tilt head right</button>
        <button aria-pressed={both} onClick={() => setManual({ ...MANUAL_REST, left: both ? 0 : 1, right: both ? 0 : 1 })}>Raise arms</button>
        <button aria-pressed={manual.lean === -1} onClick={() => setManual({ ...MANUAL_REST, lean: manual.lean === -1 ? 0 : -1 })}>Lean left</button>
        <button aria-pressed={manual.lean === 1} onClick={() => setManual({ ...MANUAL_REST, lean: manual.lean === 1 ? 0 : 1 })}>Lean right</button>
        <button aria-pressed={manual.leftLeg === 1} onClick={() => setManual({ ...MANUAL_REST, leftLeg: manual.leftLeg === 1 ? 0 : 1, leftKnee: manual.leftLeg === 1 ? 0 : .5 })}>Lift left leg</button>
        <button aria-pressed={manual.rightLeg === -1} onClick={() => setManual({ ...MANUAL_REST, rightLeg: manual.rightLeg === -1 ? 0 : -1, rightKnee: manual.rightLeg === -1 ? 0 : .5 })}>Lift right leg</button>
        <button aria-pressed={manual.hipTilt === -1} onClick={() => setManual({ ...manual, hipTilt: manual.hipTilt === -1 ? 0 : -1 })}>Rotate hips left</button>
        <button aria-pressed={manual.hipTilt === 1} onClick={() => setManual({ ...manual, hipTilt: manual.hipTilt === 1 ? 0 : 1 })}>Rotate hips right</button>
      </div>
      <label className="slider-label">Head tilt<input type="range" min="-1" max="1" step=".01" value={manual.headTilt} aria-label="Manual head tilt" onChange={event => setManual({ ...manual, headTilt: +event.target.value })} /></label>
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
  </section>;
}
