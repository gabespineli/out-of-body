"use client";
import type { useCamera } from "@/hooks/use-camera";
import { REST_LEGS, REST_HIPS, REST_HEAD, REST_FEET, REST_ELBOWS, type Motion, type ManualLegs, type ManualHips, type ManualHead, type ManualFeet, type ManualElbows } from "@/lib/pose";
import type { GuideStep } from "@/lib/guided";
import { areaConfig, areaSide, isLegArea, type BodyArea } from "@/lib/body-areas";

export type ManualPose = { left: number; right: number; lean: number } & ManualLegs & ManualHips & ManualHead & ManualFeet & ManualElbows;
export const MANUAL_REST: ManualPose = { left: 0, right: 0, lean: 0, ...REST_LEGS, ...REST_HIPS, ...REST_HEAD, ...REST_FEET, ...REST_ELBOWS };
type Props = {
  area: BodyArea; step: GuideStep; compact: boolean; camera: ReturnType<typeof useCamera>; preview?: boolean;
  mode: "camera" | "manual"; setMode: (mode: "camera" | "manual") => void;
  manual: ManualPose; setManual: (pose: ManualPose) => void; detected: Motion;
};
const controls: { key: keyof ManualPose; label: string; name: string; min: number; max: number }[] = [
  { key: "headTilt", label: "Head tilt", name: "Manual head tilt", min: -1, max: 1 },
  { key: "left", label: "Left reach", name: "Manual left arm height", min: 0, max: 1 },
  { key: "right", label: "Right reach", name: "Manual right arm height", min: 0, max: 1 },
  { key: "leftElbow", label: "Left elbow bend", name: "Manual left elbow bend", min: 0, max: 1 },
  { key: "rightElbow", label: "Right elbow bend", name: "Manual right elbow bend", min: 0, max: 1 },
  { key: "lean", label: "Side lean", name: "Manual side lean", min: -1, max: 1 },
  { key: "hipTilt", label: "Hip rotation", name: "Manual hip rotation", min: -1, max: 1 },
  { key: "leftLeg", label: "Left leg", name: "Manual left leg swing", min: 0, max: 1 },
  { key: "rightLeg", label: "Right leg", name: "Manual right leg swing", min: -1, max: 0 },
  { key: "leftKnee", label: "Left knee bend", name: "Manual left knee bend", min: 0, max: 1 },
  { key: "rightKnee", label: "Right knee bend", name: "Manual right knee bend", min: 0, max: 1 },
  { key: "heelRaise", label: "Heel raise", name: "Manual heel raise", min: 0, max: 1 },
];
export function MotionPanel({ area, step, compact, camera, mode, setMode, manual, setManual, detected, preview = true }: Props) {
  const pending = camera.status === "permission" || camera.status === "loading", side = areaSide(area);
  const selected: keyof ManualPose = area === "neck-head" ? "headTilt" : area === "torso" ? "lean"
    : area.endsWith("forearm") ? `${side}Elbow` : area.endsWith("upper-arm") ? side : step === "heel-raise" ? "heelRaise" : `${side}Leg`;
  const preset = (values: Partial<ManualPose>) => setManual({ ...MANUAL_REST, ...values });
  return <section className="control-section motion-section" aria-labelledby="motion-title">
    <h2 id="motion-title">Motion</h2>
    <select aria-label="Motion source" value={mode} onChange={event => setMode(event.target.value as "camera" | "manual")}><option value="camera">Webcam</option><option value="manual">Manual demo</option></select>
    {preview && <div className={`camera-preview ${mode === "manual" ? "manual-preview" : ""}`}>
      <video ref={camera.videoRef} muted playsInline autoPlay aria-label="Mirrored webcam preview" className={camera.status === "live" || camera.status === "loading" ? "video-visible" : ""} />
      {mode === "camera" && camera.status !== "live" && camera.status !== "loading" && <div className="camera-placeholder">{camera.status === "permission" ? "Allow camera access in your browser" : "Camera off"}</div>}
    </div>}
    {mode === "camera" ? <>
      {(camera.status === "live" || camera.status === "loading") && <p className="camera-status" role="status">{camera.status === "loading" ? "Loading tracker…" : camera.tracking ? "Body found" : "No body detected"}</p>}
      {camera.status === "live" ? <button className="full-width" onClick={camera.stop}>Stop camera</button> : <button className="full-width" disabled={pending} onClick={() => void camera.start()}>{camera.status === "permission" ? "Waiting for permission…" : camera.status === "loading" ? "Starting tracking…" : camera.status === "error" ? "Try camera again" : "Enable camera"}</button>}
      {pending && <button className="full-width" onClick={camera.stop}>Cancel camera</button>}
      {camera.error && <p className="error-message" role="alert">{camera.error}</p>}
      <p className="camera-hint">{areaConfig(area).framing}</p>
      <details className="tracking-details"><summary>Tracking details</summary>
        <p className="tracking-parts" data-testid="tracking-parts">Left arm: {detected.leftVisible ? "visible" : "missing"} · Right arm: {detected.rightVisible ? "visible" : "missing"} · Hips: {detected.hipsVisible ? "visible" : "missing"}</p>
        <p className="tracking-parts" data-testid="tracking-head">Head: {detected.headVisible ? "visible" : "missing"}</p>
        <p className="tracking-parts" data-testid="tracking-legs">Left leg: {detected.leftLegVisible ? "visible" : "missing"} · Right leg: {detected.rightLegVisible ? "visible" : "missing"}</p>
      </details>
    </> : <div className="manual-controls">
      <p className="camera-hint">Simulated movement{isLegArea(area) ? ` · ${side} leg` : ""}</p>
      {!compact && <div className="manual-pose-buttons">
        <button onClick={() => preset({ headTilt: manual.headTilt === -1 ? 0 : -1 })}>Tilt head left</button>
        <button onClick={() => preset({ headTilt: manual.headTilt === 1 ? 0 : 1 })}>Tilt head right</button>
        <button aria-pressed={manual.left === 1 && manual.right === 1} onClick={() => preset({ left: manual.left === 1 && manual.right === 1 ? 0 : 1, right: manual.left === 1 && manual.right === 1 ? 0 : 1 })}>Raise arms</button>
        <button onClick={() => preset({ lean: manual.lean === -1 ? 0 : -1 })}>Lean left</button>
        <button onClick={() => preset({ lean: manual.lean === 1 ? 0 : 1 })}>Lean right</button>
        <button onClick={() => preset({ leftLeg: manual.leftLeg === 1 ? 0 : 1, leftKnee: manual.leftLeg === 1 ? 0 : .5 })}>Lift left leg</button>
        <button onClick={() => preset({ rightLeg: manual.rightLeg === -1 ? 0 : -1, rightKnee: manual.rightLeg === -1 ? 0 : .5 })}>Lift right leg</button>
        <button onClick={() => preset({ leftElbow: manual.leftElbow === 1 ? 0 : 1 })}>Bend left elbow</button>
        <button onClick={() => preset({ rightElbow: manual.rightElbow === 1 ? 0 : 1 })}>Bend right elbow</button>
        <button onClick={() => setManual({ ...manual, hipTilt: manual.hipTilt === -1 ? 0 : -1 })}>Rotate hips left</button>
        <button onClick={() => setManual({ ...manual, hipTilt: manual.hipTilt === 1 ? 0 : 1 })}>Rotate hips right</button>
      </div>}
      {controls.filter(control => !compact || control.key === selected).map(control => <label className="slider-label" key={control.key}>{control.label}<input type="range" min={control.min} max={control.max} step=".01" value={manual[control.key]} aria-label={control.name} onChange={event => setManual({ ...manual, [control.key]: +event.target.value })} /></label>)}
      <button onClick={() => setManual({ ...MANUAL_REST })}>Return to rest</button>
    </div>}
  </section>;
}
