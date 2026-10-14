"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useArtwork } from "@/hooks/use-artwork";
import { useWebMcp } from "@/hooks/use-webmcp";
import { useCamera, type MotionSource } from "@/hooks/use-camera";
import { ArtworkPanel } from "./artwork-panel";
import { MotionPanel, MANUAL_REST, type ManualPose } from "./motion-panel";
import { DEFAULT_TIMING, manualMotion, matchesBodyStretch, REST, smoothMotion, type Timing } from "@/lib/pose";
import { renderAvatar } from "@/lib/render";
import { saveAvatarPng } from "@/lib/export";
import { STAGE_WIDTH, HEIGHT } from "@/lib/rig";
import { AREA_IDS, BODY_AREAS, areaConfig, emptyFades, type BodyArea } from "@/lib/body-areas";
import { createAreaHolds, resetUnfinished, advanceAreaHolds } from "@/lib/area-holds";
import { GUIDED_ACTIVITIES, STEP_INSTRUCTIONS, createGuide, advanceGuide, guideSnapshot, skipGuide } from "@/lib/guided";
import { VisualInstructor } from "./visual-instructor";

const EMPTY_PROGRESS = { hold: 0, fade: 0, complete: false, active: false };

export type InstallationResult = { snapshot: string; skipped: BodyArea[] };
type InstallationProps = { initialArtwork?: File; onArtworkReady?: () => void; onComplete?: (result: InstallationResult) => void; onParticipantReset?: () => void;
  participantMode?: boolean; fullscreenRoot?: React.RefObject<HTMLDivElement | null> };
export function Installation({ initialArtwork, onArtworkReady, onComplete, onParticipantReset, participantMode, fullscreenRoot }: InstallationProps = {}) {
  const artwork = useArtwork();
  const uploadedExternal = useRef<File | null>(null), notifiedArtwork = useRef<File | null>(null), notifiedComplete = useRef(false);
  useEffect(() => {
    if (initialArtwork && uploadedExternal.current !== initialArtwork) { uploadedExternal.current = initialArtwork; artwork.upload(initialArtwork); }
  }, [initialArtwork, artwork.upload]);
  useEffect(() => {
    if (initialArtwork && artwork.art && notifiedArtwork.current !== initialArtwork) { notifiedArtwork.current = initialArtwork; onArtworkReady?.(); }
  }, [initialArtwork, artwork.art, onArtworkReady]);
  const source = useRef<MotionSource>({ motion: { ...REST }, time: 0 });
  const camera = useCamera(source);
  const canvas = useRef<HTMLCanvasElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const holds = useRef(createAreaHolds());
  const displayed = useRef({ ...REST });
  const [mode, setMode] = useState<"camera" | "manual">("camera");
  const [area, setArea] = useState<BodyArea>("arms-back");
  const [experience, setExperience] = useState<"guided" | "practice">("guided");
  const guide = useRef(createGuide());
  const [journey, setJourney] = useState(() => guideSnapshot(guide.current));
  const [guidedRunning, setGuidedRunning] = useState(false);
  const [resetKey, setResetKey] = useState(0);
  const activeArea = experience === "guided" ? GUIDED_ACTIVITIES[journey.index].area : area;
  const [fades, setFades] = useState(emptyFades());
  const preset = areaConfig(activeArea);
  const [manual, setManual] = useState<ManualPose>({ ...MANUAL_REST });
  const [timing, setTiming] = useState<Timing>({ ...DEFAULT_TIMING });
  const [strength, setStrength] = useState(.97);
  const [paused, setPaused] = useState(false);
  const [progress, setProgress] = useState({ ...EMPTY_PROGRESS });
  const [detected, setDetected] = useState({ ...REST });
  const [fullscreenError, setFullscreenError] = useState("");
  const [full, setFull] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  useEffect(() => {
    if (!journey.done) { notifiedComplete.current = false; return; }
    if (guidedRunning && onComplete && !notifiedComplete.current && canvas.current) {
      notifiedComplete.current = true;
      onComplete({ snapshot: canvas.current.toDataURL("image/png"), skipped: [...journey.skipped] });
    }
  }, [journey.done, journey.skipped, guidedRunning, onComplete]);

  const restore = useCallback(() => {
    holds.current = createAreaHolds();
    guide.current = createGuide(); setJourney(guideSnapshot(guide.current));
    setResetKey(key => key + 1);
    setFades(emptyFades());
    setProgress({ ...EMPTY_PROGRESS });
  }, []);
  useEffect(restore, [artwork.art, mode, timing, strength, restore]);

  useEffect(() => {
    const ctx = canvas.current?.getContext("2d");
    if (!ctx) return;
    let frame = 0, last = performance.now(), uiTime = 0;
    const tick = (now: number) => {
      const dt = Math.min(100, now - last); last = now;
      const target = mode === "manual" ? manualMotion(manual.left, manual.lean, manual.right, manual, manual, manual, manual)
        : now - source.current.time < 300 ? source.current.motion : { ...REST };
      if (!paused) displayed.current = smoothMotion(displayed.current, target, dt);
      const active = !paused && !document.hidden && !!artwork.art && artwork.art.areas[area].coloredPixels >= 40 && matchesBodyStretch(target, area);
      if (experience === "guided") guide.current = advanceGuide(guide.current, target, now, guidedRunning && !!artwork.art, paused || document.hidden);
      else holds.current = advanceAreaHolds(holds.current, area, active, now, timing, paused || document.hidden);
      const current = holds.current[area], snapshot = guideSnapshot(guide.current);
      const areaFades = experience === "guided" ? snapshot.fades : Object.fromEntries(AREA_IDS.map(id => [id, holds.current[id].fade])) as ReturnType<typeof emptyFades>;
      renderAvatar(ctx, artwork.art, displayed.current, areaFades, strength);
      if (now - uiTime > 80) {
        setProgress({ hold: current.elapsed / timing.holdMs, fade: current.fade, complete: current.complete, active });
        setFades(areaFades); setJourney(snapshot);
        setDetected(target); uiTime = now;
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [artwork.art, area, mode, manual, timing, strength, paused, experience, guidedRunning]);

  useEffect(() => {
    const change = () => setFull(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", change);
    const hide = () => { if (document.hidden) holds.current = resetUnfinished(holds.current); };
    document.addEventListener("visibilitychange", hide);
    return () => { document.removeEventListener("fullscreenchange", change); document.removeEventListener("visibilitychange", hide); };
  }, [restore]);

  const changeMode = (next: "camera" | "manual") => {
    if (next === mode) return;
    camera.stop();
    setManual({ ...MANUAL_REST }); setMode(next); restore();
  };
  const changeExperience = (next: "guided" | "practice") => {
    if (next === experience) return;
    setExperience(next); setGuidedRunning(false); setPaused(false);
    setManual({ ...MANUAL_REST }); restore();
  };
  const startGuided = () => {
    if (!artwork.art) throw new Error("Load a drawing before starting.");
    setExperience("guided"); setGuidedRunning(true); setPaused(false);
    setManual({ ...MANUAL_REST }); restore();
  };
  const changeArea = (next: BodyArea) => {
    if (experience !== "practice") changeExperience("practice");
    if (next === area && experience === "practice") return;
    holds.current = resetUnfinished(holds.current);
    setManual({ ...MANUAL_REST }); setArea(next);
    const state = holds.current[next];
    setProgress({ hold: state.elapsed / timing.holdMs, fade: state.fade, complete: state.complete, active: false });
  };
  useWebMcp({
    state: () => ({ drawingSource: artwork.kind, mode, camera: camera.status, experience, guided: { running: guidedRunning, activity: journey.index + 1, step: journey.step, skipped: journey.skipped, feetFallback: journey.feetFallback, progress: journey.progress, total: journey.total, done: journey.done }, bodyArea: activeArea, areaFades: { ...fades }, manual: { ...manual }, paused, areaCount: 3, holdSeconds: timing.holdMs / 1000, fadeSeconds: timing.fadeMs / 1000, fadeAmount: strength, holdProgress: progress.hold, fadeProgress: progress.fade, complete: progress.complete }),
    setManual: pose => { changeMode("manual"); setManual(pose); },
    setArea: changeArea,
    startGuided,
    restore: () => { if (!artwork.art) throw new Error("Load a drawing before restoring colors."); restore(); },
  });
  const togglePause = () => {
    holds.current = resetUnfinished(holds.current);
    setPaused(value => !value);
  };
  const resetExperience = () => {
    setManual({ ...MANUAL_REST }); setPaused(false); setGuidedRunning(false);
    displayed.current = { ...REST }; restore();
  };
  const skipActivity = () => {
    guide.current = skipGuide(guide.current); setJourney(guideSnapshot(guide.current));
    setManual({ ...MANUAL_REST }); setPaused(false);
  };
  const startFresh = () => {
    camera.stop(); setMode("camera"); setManual({ ...MANUAL_REST });
    setArea("arms-back"); setExperience("guided"); setGuidedRunning(false); setPaused(false); setTiming({ ...DEFAULT_TIMING }); setStrength(.97);
    displayed.current = { ...REST }; artwork.reset(); restore(); setSaveError(""); setFullscreenError("");
    onParticipantReset?.();
  };
  const enterFullscreen = async () => {
    setFullscreenError("");
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else if ((fullscreenRoot?.current || stage.current)?.requestFullscreen) await (fullscreenRoot?.current || stage.current)!.requestFullscreen();
      else setFullscreenError("Fullscreen is unavailable in this browser. Use your browser’s fullscreen shortcut.");
    } catch { setFullscreenError("Fullscreen could not open. Use your browser’s fullscreen shortcut."); }
  };
  const save = async () => {
    if (!canvas.current || !artwork.art) return;
    setSaving(true); setSaveError("");
    try { await saveAvatarPng(canvas.current, `out-of-body-${mode === "manual" ? "manual" : "camera"}-${Date.now()}.png`); }
    catch (caught) { setSaveError(caught instanceof Error ? caught.message : "The image could not be saved. Try again."); }
    finally { setSaving(false); }
  };
  const holdSeconds = timing.holdMs / 1000;
  const hasColor = !!artwork.art && artwork.art.areas[activeArea].coloredPixels >= 40;
  const stretchState = paused ? "paused" : !artwork.art ? "waiting" : !hasColor ? "no-color"
    : progress.complete ? progress.fade >= 1 ? "completed" : "fading" : progress.active ? "holding" : "not-detected";
  const missing = activeArea === "neck-head" ? !detected.headVisible : activeArea === "arms-back"
    ? experience === "guided" ? journey.step === "side-stretch" ? !detected.hipsVisible || !detected.leftVisible && !detected.rightVisible : !detected.leftVisible && !detected.rightVisible : !detected.leftVisible || !detected.rightVisible
    : !detected.leftLegVisible && !detected.rightLegVisible;
  const holdText = paused ? "Session paused" : !artwork.art ? "Upload a drawing to begin" : !hasColor ? "No strong color in this body area. Add a colored mark or align the photo."
    : progress.complete ? progress.fade >= 1 ? "Completed — selected color faded" : "Stretch held — fading selected color…" : progress.active ? `Hold still — ${preset.holding}`
    : mode === "camera" && camera.status !== "live" ? "Not detected — enable camera or use manual demo"
    : mode === "camera" && (!detected.tracked || missing) ? `Not detected — ${preset.framing}`
    : "Not detected — follow the stretch instruction";
  const statusText = paused ? "Paused" : mode === "manual" ? "Manual simulation" : camera.status === "live" ? camera.tracking ? "Tracking" : "No body detected" : "Camera off";
  const practiceFeedback = <div className="stretch-feedback" data-testid="stretch-feedback" data-stretch-state={stretchState}>
    <p className="stretch-instruction" data-testid="stretch-instruction"><strong>{preset.instruction}</strong> Hold for {holdSeconds} seconds.</p>
    <p className="stretch-mapping">Fade: {preset.fadeLabel}. Leaving the stretch before the hold finishes restarts the timer.</p>
    <div className="hold-panel"><strong role="status" aria-live="polite" data-testid="stretch-status">{holdText}</strong><span data-testid="hold-number">{(progress.hold * holdSeconds).toFixed(1)} / {holdSeconds}s</span><progress aria-label="Gesture hold" max={holdSeconds} value={progress.hold * holdSeconds} /><span>Fade: {Math.round(progress.fade * 100)}%</span></div>
  </div>;
  const guidedStatus = paused ? "Paused" : !artwork.art ? "Upload a drawing" : !guidedRunning ? "Ready to start"
    : journey.done ? journey.skipped.length ? `Finished · ${journey.skipped.length} skipped` : "Sequence completed"
    : journey.transitioning ? journey.index < 2 ? "Completed · next activity…" : "Completed"
    : mode === "camera" && camera.status !== "live" ? "Enable camera or choose Manual demo"
    : mode === "camera" && (!detected.tracked || missing) ? activeArea === "neck-head" ? "Keep head and shoulders in view." : activeArea === "arms-back" ? "Keep hands and hips in view." : "Keep both legs and feet in view."
    : journey.step === "heel-raise" && !detected.leftFootVisible && !detected.rightFootVisible ? "Feet unclear · keep them in view, or skip"
    : journey.active ? "Movement detected" : "Follow the guide gently";
  const guidedFeedback = <div className="stretch-feedback guided-feedback" data-testid="guided-feedback" data-guided-state={paused ? "paused" : journey.done ? "completed" : journey.transitioning ? "transitioning" : guidedRunning ? journey.active ? "moving" : "ready" : "idle"}>
    <ol className="activity-steps" aria-label="Stretching sequence">{GUIDED_ACTIVITIES.map((activity, index) => <li key={activity.area} aria-current={journey.index === index ? "step" : undefined} data-completed={journey.fades[activity.area] >= 1}>
      {index + 1}. {areaConfig(activity.area).label}{journey.skipped.includes(activity.area) ? " (skipped)" : journey.fades[activity.area] >= 1 ? " ✓" : ""}
    </li>)}</ol>
    <p className="stretch-instruction" data-testid="current-activity"><strong>{journey.feetFallback ? "Feet unclear: continue gentle side steps." : STEP_INSTRUCTIONS[journey.step]}</strong></p>
    <p className="comfort-note">Stay comfortable. Skip any activity.</p>
    <div className="guided-progress"><strong role="status" aria-live="polite" data-testid="guided-status">{guidedStatus}</strong>
      <progress aria-label="Activity progress" max="1" value={journey.progress} /><span data-testid="guided-percent">{Math.round(journey.progress * 100)}%</span>
    </div>
    {!hasColor && artwork.art && <p className="color-note">No colored marks here. Movement still counts.</p>}
  </div>;
  const feedback = experience === "guided" ? guidedFeedback : practiceFeedback;

  return <div className="installation-shell" data-experience={experience}>
    <header className="site-header"><h1>{participantMode ? "Out of Body" : "Out of Body — MVP"}</h1></header>
    <main><div className="experience-grid">
      <aside className="control-panel">
        <section className="control-section" aria-labelledby="area-title">
          <h2 id="area-title">Stretching</h2>
          {experience === "guided" ? (!guidedRunning || journey.done) && <button className="full-width" disabled={!artwork.art} onClick={startGuided}>{journey.done ? "Replay sequence" : "Start guided session"}</button> : <select aria-label="Body area" value={area} onChange={event => changeArea(event.target.value as BodyArea)}>{BODY_AREAS.map(p => <option value={p.id} key={p.id}>{p.label}</option>)}</select>}
          <details className="secondary-controls"><summary>More controls</summary>
            <div className="segmented experience-options" aria-label="Stretching experience"><button aria-pressed={experience === "guided"} onClick={() => changeExperience("guided")}>Guided sequence</button><button aria-pressed={experience === "practice"} onClick={() => changeExperience("practice")}>Individual stretches</button></div>
            <div className="button-row"><button disabled={!artwork.art || saving} onClick={() => void save()}>{saving ? "Saving…" : "Save PNG"}</button><button onClick={startFresh}>Start fresh</button></div>
          </details>
          {experience === "practice" && <p className="area-progress" data-testid="area-progress">{BODY_AREAS.map(p => `${p.label}: ${fades[p.id] >= 1 ? "completed" : holds.current[p.id].complete ? "fading" : "waiting"}`).join(" · ")}</p>}
        </section>
        {!participantMode && <ArtworkPanel artwork={artwork} area={activeArea} />}
        <MotionPanel area={activeArea} step={journey.step} compact={experience === "guided"} camera={camera} mode={mode} setMode={changeMode} manual={manual} setManual={setManual} detected={detected} />
        {experience === "practice" && <section className="control-section" aria-labelledby="session-title">
          <h2 id="session-title">Hold and fade</h2>
          <label className="slider-label">Hold: {holdSeconds}s<input type="range" aria-label="Hold duration" min="2" max="3" step=".5" value={holdSeconds} onChange={event => setTiming({ ...timing, holdMs: +event.target.value * 1000 })} /></label>
          <label className="slider-label">Fade: {timing.fadeMs / 1000}s<input type="range" aria-label="Fade duration" min=".2" max="5" step=".1" value={timing.fadeMs / 1000} onChange={event => setTiming({ ...timing, fadeMs: +event.target.value * 1000 })} /></label>
          <label className="slider-label">Amount: {Math.round(strength * 100)}%<input type="range" aria-label="Fade amount" min="25" max="100" step="1" value={Math.round(strength * 100)} onChange={event => setStrength(+event.target.value / 100)} /></label>
          <button onClick={() => { setTiming({ ...DEFAULT_TIMING }); setStrength(.97); }}>Reset timing</button>
        </section>}
      </aside>
      <section className="stage-panel" aria-labelledby="stage-title">
        <div className="output-toolbar"><h2 id="stage-title">{experience === "guided" ? "Guided stretching" : "Avatar"}</h2><span>{artwork.kind === "upload" ? "Uploaded drawing" : artwork.kind === "sample" ? "Example drawing" : "No drawing loaded"}</span>
          <div className="output-actions">
            <button disabled={!artwork.art} onClick={togglePause}>{paused ? "Resume" : "Pause"}</button>
            {experience === "guided" && <button disabled={!guidedRunning || journey.done || journey.transitioning} onClick={skipActivity}>Skip activity</button>}
            <button disabled={!artwork.art} onClick={resetExperience}>Reset experience</button>
            <button aria-label={full ? "Exit fullscreen" : "Open installation fullscreen"} onClick={() => void enterFullscreen()}>Fullscreen</button>
          </div>
        </div>
        {!full && feedback}
        <div className="avatar-stage duet-stage" ref={stage}>
          {full && <div className="fullscreen-feedback">{feedback}<div className="button-row fullscreen-actions">
            <button onClick={togglePause}>{paused ? "Resume" : "Pause"}</button>
            {experience === "guided" && <button disabled={!guidedRunning || journey.done || journey.transitioning} onClick={skipActivity}>Skip activity</button>}
            <button disabled={!artwork.art} onClick={resetExperience}>Reset experience</button>
          </div></div>}
          <VisualInstructor area={activeArea} step={experience === "guided" ? journey.step : undefined} resetKey={resetKey} paused={paused || journey.done && experience === "guided"} />
          <div className="stage-pane participant-pane"><h3 className="pane-title">Your drawing</h3><span className="stage-status">{statusText}</span>
          <div className="avatar-frame"><canvas ref={canvas} width={STAGE_WIDTH} height={HEIGHT} className="avatar-canvas" data-testid="avatar" data-area={activeArea} data-step={journey.step} data-guided-progress={journey.progress.toFixed(3)} data-guided-total={journey.total.toFixed(3)} data-head-fade={fades["neck-head"].toFixed(2)} data-arms-fade={fades["arms-back"].toFixed(2)} data-legs-fade={fades["legs-feet"].toFixed(2)} data-fade={(experience === "guided" ? journey.progress : progress.fade).toFixed(2)} data-hold={progress.hold.toFixed(2)} data-paused={paused} aria-label={`${artwork.art ? `Moving artwork: ${artwork.name}` : "Blank silhouette preview"}. ${mode === "manual" ? "Motion is simulated." : "Motion follows the webcam."}`} /></div></div>
          {full && <button className="fullscreen-exit" onClick={() => void enterFullscreen()}>Exit fullscreen</button>}
        </div>
        {fullscreenError && <p className="error-message" role="alert">{fullscreenError}</p>}
        {saveError && <p className="error-message" role="alert">{saveError}</p>}
        <p className="prototype-note">Symbolic fade, not proof of medical relief.</p>
      </section>
    </div></main>
  </div>;
}
