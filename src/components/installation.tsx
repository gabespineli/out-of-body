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
import { AREA_IDS, BODY_AREAS, areaConfig, areaSide, coloredAreas, COLOR_PIXEL_MIN, emptyFades, isArmArea, type BodyArea } from "@/lib/body-areas";
import { createAreaHolds, resetUnfinished, advanceAreaHolds } from "@/lib/area-holds";
import { guideInstruction, createGuide, advanceGuide, guideSnapshot, skipGuide } from "@/lib/guided";
import { VisualInstructor } from "./visual-instructor";
import { PositioningGate } from "./positioning-gate";
import { StretchStage } from "./stretch-stage";
import { assessFraming, advanceFraming, createFramingState, positionCountdown } from "@/lib/framing";
import { BrandLogo } from "./design-brand";
import { StretchCelebration } from "./stretch-celebration";

const EMPTY_PROGRESS = { hold: 0, fade: 0, complete: false, active: false };

export type InstallationResult = { snapshot: string; skipped: BodyArea[] };
type InstallationProps = { initialArtwork?: File; onArtworkReady?: () => void; onComplete?: (result: InstallationResult) => void; onParticipantReset?: () => void;
  participantMode?: boolean; participantName?: string; fullscreenRoot?: React.RefObject<HTMLDivElement | null>; onSetupVisibilityChange?: (visible: boolean) => void; setupBlocked?: boolean };
export function Installation({ initialArtwork, onArtworkReady, onComplete, onParticipantReset, participantMode, participantName, fullscreenRoot, onSetupVisibilityChange, setupBlocked = false }: InstallationProps = {}) {
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
  const [area, setArea] = useState<BodyArea>("left-upper-arm");
  const [experience, setExperience] = useState<"guided" | "practice">("guided");
  const guide = useRef(createGuide());
  const [journey, setJourney] = useState(() => guideSnapshot(guide.current));
  const [guidedRunning, setGuidedRunning] = useState(false);
  const [phase, setPhase] = useState<"setup" | "positioning" | "stretching">("setup");
  useEffect(() => { onSetupVisibilityChange?.(experience === "guided" && phase !== "stretching"); }, [phase, experience, onSetupVisibilityChange]);
  const framing = useRef(createFramingState());
  const [frameStatus, setFrameStatus] = useState({ ...createFramingState(), valid: false, message: "Move into view so the camera can see you." });
  useEffect(() => {
    framing.current = createFramingState();
    setFrameStatus(value => ({ ...value, ...framing.current, valid: false }));
  }, [camera.deviceId]);
  useEffect(() => { if (journey.done && guidedRunning) camera.stop(); }, [journey.done, guidedRunning, camera.stop]);
  useEffect(() => { if (participantMode && initialArtwork && artwork.art) setPhase("positioning"); }, [participantMode, initialArtwork, artwork.art]);
  const [resetKey, setResetKey] = useState(0);
  const activeArea = experience === "guided" ? journey.area : area;
  const [fades, setFades] = useState(emptyFades());
  const preset = areaConfig(activeArea);
  const [manual, setManual] = useState<ManualPose>({ ...MANUAL_REST });
  const [timing, setTiming] = useState<Timing>({ ...DEFAULT_TIMING });
  const [strength, setStrength] = useState(.97);
  const [paused, setPaused] = useState(false);
  const [homeOpen, setHomeOpen] = useState(false);
  const [progress, setProgress] = useState({ ...EMPTY_PROGRESS });
  const [detected, setDetected] = useState({ ...REST });
  const [fullscreenError, setFullscreenError] = useState("");
  const [full, setFull] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [celebration, setCelebration] = useState(0);

  useEffect(() => {
    if (!journey.done) { notifiedComplete.current = false; return; }
    if (guidedRunning && onComplete && !notifiedComplete.current && canvas.current) {
      notifiedComplete.current = true;
      onComplete({ snapshot: canvas.current.toDataURL("image/png"), skipped: [...journey.skipped] });
    }
  }, [journey.done, journey.skipped, guidedRunning, onComplete]);

  const restore = useCallback(() => {
    holds.current = createAreaHolds();
    guide.current = createGuide(artwork.art ? coloredAreas(artwork.art.areas) : []); setJourney(guideSnapshot(guide.current));
    setResetKey(key => key + 1);
    setFades(emptyFades());
    setProgress({ ...EMPTY_PROGRESS });
    setCelebration(0);
    framing.current = createFramingState();
  }, [artwork.art]);
  useEffect(restore, [artwork.art, mode, timing, strength, restore]);

  useEffect(() => {
    const ctx = canvas.current?.getContext("2d");
    if (!ctx) return;
    let frame = 0, last = performance.now(), uiTime = 0;
    const tick = (now: number) => {
      const dt = Math.min(100, now - last); last = now;
      const target = mode === "manual" ? manualMotion(manual.left, manual.lean, manual.right, manual, manual, manual, manual, manual)
        : now - source.current.time < 300 ? source.current.motion : { ...REST };
      const requiredAreas = phase === "stretching" ? [guide.current.areas[guide.current.index]].filter(Boolean) as BodyArea[] : guide.current.areas;
      const verdict = mode === "manual" ? { valid: true, message: "Manual simulation" } : assessFraming(source.current.landmarks ?? [], target, requiredAreas, now - source.current.time < 300);
      framing.current = advanceFraming(framing.current, verdict.valid, now, phase === "stretching" && !guide.current.done, document.hidden || setupBlocked);
      const trackingBlocked = experience === "guided" && mode === "camera" && (!verdict.valid || framing.current.recovery);
      const freeze = paused || homeOpen || document.hidden || trackingBlocked || experience === "guided" && phase !== "stretching";
      if (!freeze) displayed.current = smoothMotion(displayed.current, target, dt);
      const active = !paused && !document.hidden && !!artwork.art && artwork.art.areas[area].coloredPixels >= COLOR_PIXEL_MIN && matchesBodyStretch(target, area);
      if (experience === "guided") {
        const previous = guideSnapshot(guide.current);
        guide.current = advanceGuide(guide.current, target, now, guidedRunning && phase === "stretching" && !!artwork.art, freeze);
        if (previous.progress < 1 && guideSnapshot(guide.current).fades[previous.area] >= 1) setCelebration(value => value + 1);
      } else {
        const previous = holds.current[area].fade;
        holds.current = advanceAreaHolds(holds.current, area, active, now, timing, paused || document.hidden);
        if (previous < 1 && holds.current[area].fade >= 1) setCelebration(value => value + 1);
      }
      const current = holds.current[area], snapshot = guideSnapshot(guide.current);
      const areaFades = experience === "guided" ? snapshot.fades : Object.fromEntries(AREA_IDS.map(id => [id, holds.current[id].fade])) as ReturnType<typeof emptyFades>;
      renderAvatar(ctx, artwork.art, displayed.current, areaFades, strength);
      if (now - uiTime > 80) {
        setProgress({ hold: current.elapsed / timing.holdMs, fade: current.fade, complete: current.complete, active });
        setFades(areaFades); setJourney(snapshot);
        setDetected(target); uiTime = now;
        setFrameStatus({ ...framing.current, ...verdict });
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [artwork.art, area, mode, manual, timing, strength, paused, experience, guidedRunning, phase, setupBlocked, homeOpen]);

  useEffect(() => {
    const change = () => setFull(!!document.fullscreenElement);
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && document.fullscreenElement && (document.fullscreenElement === stage.current || document.fullscreenElement === fullscreenRoot?.current))
        void document.exitFullscreen().catch(() => { /* The browser may have already handled Escape. */ });
    };
    document.addEventListener("fullscreenchange", change);
    window.addEventListener("keydown", escape);
    const hide = () => { if (document.hidden) holds.current = resetUnfinished(holds.current); };
    document.addEventListener("visibilitychange", hide);
    return () => { document.removeEventListener("fullscreenchange", change); document.removeEventListener("visibilitychange", hide); window.removeEventListener("keydown", escape); };
  }, [restore, fullscreenRoot]);

  const changeMode = (next: "camera" | "manual") => {
    if (next === mode) return;
    camera.stop();
    framing.current = createFramingState();
    setManual({ ...MANUAL_REST }); setMode(next); restore();
  };
  const changeExperience = (next: "guided" | "practice") => {
    if (next === experience) return;
    camera.stop(); setPhase("setup");
    setExperience(next); setGuidedRunning(false); setPaused(false);
    setManual({ ...MANUAL_REST }); restore();
  };
  const startGuided = () => {
    if (!artwork.art) throw new Error("Load a drawing before starting.");
    if (!coloredAreas(artwork.art.areas).length) throw new Error("No colored regions detected. Check the drawing alignment or add colored marks.");
    setExperience("guided"); setPaused(false);
    if (!guidedRunning) { setManual({ ...MANUAL_REST }); restore(); }
    if (mode === "camera") { framing.current = createFramingState(); setPhase("positioning"); }
    else { setGuidedRunning(true); setPhase("stretching"); }
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
    state: () => ({ phase, framing: { ready: frameStatus.ready, valid: frameStatus.valid, recovery: frameStatus.recovery }, drawingSource: artwork.kind, mode, camera: camera.status, experience, guided: { running: guidedRunning, areas: journey.areas, activity: journey.areas.length ? journey.index + 1 : 0, activityCount: journey.areas.length, step: journey.step, skipped: journey.skipped, progress: journey.progress, total: journey.total, done: journey.done }, bodyArea: activeArea, areaFades: { ...fades }, manual: { ...manual }, paused, areaCount: AREA_IDS.length, holdSeconds: timing.holdMs / 1000, fadeSeconds: timing.fadeMs / 1000, fadeAmount: strength, holdProgress: progress.hold, fadeProgress: progress.fade, complete: progress.complete }),
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
    setPhase("setup");
    displayed.current = { ...REST }; restore();
  };
  const skipActivity = () => {
    guide.current = skipGuide(guide.current); setJourney(guideSnapshot(guide.current));
    setManual({ ...MANUAL_REST }); setPaused(false);
  };
  const startFresh = () => {
    camera.stop(); setMode("camera"); setManual({ ...MANUAL_REST });
    setPhase("setup");
    setArea("left-upper-arm"); setExperience("guided"); setGuidedRunning(false); setPaused(false); setTiming({ ...DEFAULT_TIMING }); setStrength(.97);
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
  const hasColor = !!artwork.art && artwork.art.areas[activeArea].coloredPixels >= COLOR_PIXEL_MIN;
  const stretchState = paused ? "paused" : !artwork.art ? "waiting" : !hasColor ? "no-color"
    : progress.complete ? progress.fade >= 1 ? "completed" : "fading" : progress.active ? "holding" : "not-detected";
  const selectedSide = areaSide(activeArea);
  const missing = activeArea === "neck-head" ? !detected.headVisible : activeArea === "torso" ? !detected.hipsVisible
    : isArmArea(activeArea) ? !detected[`${selectedSide}Visible`] : !detected.hipsVisible || !detected[`${selectedSide}LegVisible`];
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
  const guidedStatus = paused ? "Paused" : !artwork.art ? "Upload a drawing" : !journey.areas.length ? "No colored regions detected. Check the drawing alignment or add colored marks." : !guidedRunning ? "Ready to start"
    : journey.done ? journey.skipped.length ? `Finished · ${journey.skipped.length} skipped` : "Sequence completed"
    : journey.transitioning ? journey.index < journey.areas.length - 1 ? "Completed · next activity…" : "Completed"
    : mode === "camera" && camera.status !== "live" ? "Enable camera or choose Manual demo"
    : mode === "camera" && (!detected.tracked || missing) ? preset.framing
    : journey.active ? "Movement detected" : "Follow the guide gently";
  const guidedFeedback = <div className="stretch-feedback guided-feedback" data-testid="guided-feedback" data-guided-state={paused ? "paused" : journey.done ? "completed" : journey.transitioning ? "transitioning" : guidedRunning ? journey.active ? "moving" : "ready" : "idle"}>
    <ol className="activity-steps" aria-label="Stretching sequence">{journey.areas.map((id, index) => <li key={id} aria-current={journey.index === index ? "step" : undefined} data-completed={journey.fades[id] >= 1}>
      {index + 1}. {areaConfig(id).label}{journey.skipped.includes(id) ? " (skipped)" : journey.fades[id] >= 1 ? " ✓" : ""}
    </li>)}</ol>
    <p className="stretch-instruction" data-testid="current-activity"><strong>{journey.areas.length ? guideInstruction(activeArea, journey.step) : "Your colored regions will select the stretches."}</strong></p>
    <p className="comfort-note">Stay comfortable. Skip any activity.</p>
    <div className="guided-progress"><strong role="status" aria-live="polite" data-testid="guided-status">{guidedStatus}</strong>
      <progress aria-label="Activity progress" max="1" value={journey.progress} /><span data-testid="guided-percent">{Math.round(journey.progress * 100)}%</span>
    </div>
    {!!journey.areas.length && <p className="stretch-mapping">Fade: {preset.fadeLabel}. Only colored regions are included.</p>}
  </div>;
  const feedback = experience === "guided" ? guidedFeedback : practiceFeedback;

  const guidedView = experience === "guided" && <div className="guided-shell" ref={stage} data-experience="guided" data-phase={phase} data-testid="guided-shell">
    {!!celebration && <StretchCelebration key={celebration} />}
    <PositioningGate camera={camera} visible={phase === "positioning"} countdown={setupBlocked ? null : positionCountdown(frameStatus, frameStatus.valid)} valid={frameStatus.valid} message={frameStatus.message} hasColor={journey.areas.length > 0}
      onStart={() => { if (setupBlocked || document.hidden || phase !== "positioning" || !framing.current.ready || positionCountdown(framing.current, true) !== 0) return; framing.current.recovery = false; setGuidedRunning(true); setPhase("stretching"); }}
      onBack={() => { camera.stop(); setPhase("setup"); }} />
    <div hidden={phase !== "setup"} className="exhibit-setup"><header><h1><BrandLogo /></h1><p>Prepare your drawing, then find your position.</p></header>
      {!participantMode && <ArtworkPanel artwork={artwork} area={activeArea} />}
      <p role="status">{!artwork.art ? "Load a drawing to begin." : !journey.areas.length ? "No colored regions detected. Check the drawing alignment or add colored marks." : `${journey.areas.length} ${journey.areas.length === 1 ? "region" : "regions"} selected from your drawing.`}</p>
      <button className="primary-action" disabled={setupBlocked || !artwork.art || !journey.areas.length} onClick={startGuided}>{journey.done ? "Replay sequence" : "Start guided session"}</button>
      <details className="secondary-controls setup-tools"><summary>Setup tools</summary>
        <div className="button-row"><button onClick={() => changeExperience("practice")}>Individual stretches</button><button aria-pressed="true">Guided sequence</button><button onClick={() => void enterFullscreen()}>Fullscreen</button></div>
        <MotionPanel preview={false} area={activeArea} step={journey.step} compact camera={camera} mode={mode} setMode={changeMode} manual={manual} setManual={setManual} detected={detected} />
        <ol className="activity-steps" aria-label="Stretching sequence">{journey.areas.map(id => <li key={id}>{areaConfig(id).label}</li>)}</ol>
        <div className="button-row"><button disabled={!artwork.art || saving} onClick={() => void save()}>Save PNG</button><button onClick={startFresh}>Start fresh</button></div>
      </details>
    </div>
    <div hidden={phase !== "stretching"}><StretchStage area={activeArea} step={journey.step} name={participantName || "Your drawing"} paused={paused || homeOpen || mode === "camera" && (!frameStatus.valid || frameStatus.recovery)} done={journey.done} transitioning={journey.transitioning} resetKey={resetKey}
      progress={journey.progress} status={guidedStatus} recovery={phase === "stretching" && frameStatus.recovery && mode === "camera"} ready={frameStatus.ready} message={frameStatus.message}
      onSkip={skipActivity} onPause={togglePause} onRestart={() => { restore(); setManual({ ...MANUAL_REST }); setPaused(false); if (mode === "camera") setPhase("positioning"); }}
      homeOpen={homeOpen} onRequestHome={() => setHomeOpen(true)} onCancelHome={() => setHomeOpen(false)}
      onEnd={() => { setHomeOpen(false); camera.stop(); if (onParticipantReset) onParticipantReset(); else resetExperience(); }}
      participant={<div className="stage-pane participant-pane"><div className="avatar-frame"><canvas ref={canvas} width={STAGE_WIDTH} height={HEIGHT} className="avatar-canvas" data-testid="avatar" data-area={activeArea} data-step={journey.step} data-guided-progress={journey.progress.toFixed(3)} data-guided-total={journey.total.toFixed(3)} {...Object.fromEntries(AREA_IDS.map(id => [`data-${id}-fade`, fades[id].toFixed(2)]))} data-fade={journey.progress.toFixed(2)} data-paused={paused || mode === "camera" && (!frameStatus.valid || frameStatus.recovery)} aria-label={`${artwork.art ? "Moving artwork" : "Blank silhouette preview"}. ${mode === "manual" ? "Motion is simulated." : "Motion follows the webcam."}`} /></div></div>} /></div>
    {phase === "stretching" && journey.done && !participantMode && <div className="session-ended"><button className="primary-action" onClick={() => { setPhase("setup"); setGuidedRunning(false); }}>Back to setup</button><button className="quiet-action" onClick={() => void save()}>Save PNG</button></div>}
    {fullscreenError && <p role="alert">{fullscreenError}</p>}{saveError && <p role="alert">{saveError}</p>}
  </div>;

  if (guidedView) return guidedView;
  return <div className="installation-shell" data-experience={experience}>
    {!!celebration && !full && <StretchCelebration key={celebration} />}
    <header className="site-header"><h1>{participantMode ? "Out of Body" : "Out of Body — MVP"}</h1></header>
    <main><div className="experience-grid">
      <aside className="control-panel">
        <section className="control-section" aria-labelledby="area-title">
          <h2 id="area-title">Stretching</h2>
          {experience === "guided" ? (!guidedRunning || journey.done) && <button className="full-width" disabled={!artwork.art || !journey.areas.length} onClick={startGuided}>{journey.done ? "Replay sequence" : "Start guided session"}</button> : <select aria-label="Body area" value={area} onChange={event => changeArea(event.target.value as BodyArea)}>{BODY_AREAS.map(p => <option value={p.id} key={p.id}>{p.label}</option>)}</select>}
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
          {!!celebration && full && <StretchCelebration key={celebration} />}
          {full && <div className="fullscreen-feedback">{feedback}<div className="button-row fullscreen-actions">
            <button onClick={togglePause}>{paused ? "Resume" : "Pause"}</button>
            {experience === "guided" && <button disabled={!guidedRunning || journey.done || journey.transitioning} onClick={skipActivity}>Skip activity</button>}
            <button disabled={!artwork.art} onClick={resetExperience}>Reset experience</button>
          </div></div>}
          <VisualInstructor area={activeArea} step={experience === "guided" ? journey.step : undefined} resetKey={resetKey} paused={paused || journey.done && experience === "guided"} />
          <div className="stage-pane participant-pane"><h3 className="pane-title">Your drawing</h3><span className="stage-status">{statusText}</span>
          <div className="avatar-frame"><canvas ref={canvas} width={STAGE_WIDTH} height={HEIGHT} className="avatar-canvas" data-testid="avatar" data-area={activeArea} data-step={journey.step} data-guided-progress={journey.progress.toFixed(3)} data-guided-total={journey.total.toFixed(3)} {...Object.fromEntries(AREA_IDS.map(id => [`data-${id}-fade`, fades[id].toFixed(2)]))} data-fade={(experience === "guided" ? journey.progress : progress.fade).toFixed(2)} data-hold={progress.hold.toFixed(2)} data-paused={paused} aria-label={`${artwork.art ? `Moving artwork: ${artwork.name}` : "Blank silhouette preview"}. ${mode === "manual" ? "Motion is simulated." : "Motion follows the webcam."}`} /></div></div>
          {full && <button className="fullscreen-exit" onClick={() => void enterFullscreen()}>Exit fullscreen</button>}
        </div>
        {fullscreenError && <p className="error-message" role="alert">{fullscreenError}</p>}
        {saveError && <p className="error-message" role="alert">{saveError}</p>}
        <p className="prototype-note">Symbolic fade, not proof of medical relief.</p>
      </section>
    </div></main>
  </div>;
}
