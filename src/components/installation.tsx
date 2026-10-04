"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useArtwork } from "@/hooks/use-artwork";
import { useWebMcp } from "@/hooks/use-webmcp";
import { useCamera, type MotionSource } from "@/hooks/use-camera";
import { ArtworkPanel } from "./artwork-panel";
import { MotionPanel, MANUAL_REST, type ManualPose } from "./motion-panel";
import { advanceHold, DEFAULT_TIMING, EMPTY_HOLD, manualMotion, matchesGesture, REST, smoothMotion, type HoldState, type Timing } from "@/lib/pose";
import { renderAvatar } from "@/lib/render";
import { saveAvatarPng } from "@/lib/export";
import { STAGE_WIDTH, HEIGHT } from "@/lib/rig";

const EMPTY_PROGRESS = { hold: 0, fade: 0, complete: false, active: false };

export function Installation() {
  const artwork = useArtwork();
  const source = useRef<MotionSource>({ motion: { ...REST }, time: 0 });
  const camera = useCamera(source);
  const canvas = useRef<HTMLCanvasElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const hold = useRef<HoldState>({ ...EMPTY_HOLD });
  const displayed = useRef({ ...REST });
  const [mode, setMode] = useState<"camera" | "manual">("camera");
  const gesture = "raise" as const;
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

  const restore = useCallback(() => {
    hold.current = { ...EMPTY_HOLD };
    setProgress({ ...EMPTY_PROGRESS });
  }, []);
  useEffect(restore, [artwork.art, gesture, mode, timing, strength, restore]);

  useEffect(() => {
    const ctx = canvas.current?.getContext("2d");
    if (!ctx) return;
    let frame = 0, last = performance.now(), uiTime = 0;
    const tick = (now: number) => {
      const dt = Math.min(100, now - last); last = now;
      const target = mode === "manual" ? manualMotion(manual.left, manual.lean, manual.right, manual, manual)
        : now - source.current.time < 300 ? source.current.motion : { ...REST };
      if (!paused) displayed.current = smoothMotion(displayed.current, target, dt);
      const active = !paused && !document.hidden && !!artwork.art && artwork.art.coloredPixels >= 40 && matchesGesture(target, gesture);
      hold.current = advanceHold(hold.current, active, now, timing, paused || document.hidden);
      renderAvatar(ctx, artwork.art, displayed.current, hold.current.fade, strength);
      if (now - uiTime > 80) {
        setProgress({ hold: hold.current.elapsed / timing.holdMs, fade: hold.current.fade, complete: hold.current.complete, active });
        setDetected(target); uiTime = now;
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [artwork.art, gesture, mode, manual, timing, strength, paused]);

  useEffect(() => {
    const change = () => setFull(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", change);
    const hide = () => { if (document.hidden && !hold.current.complete) restore(); };
    document.addEventListener("visibilitychange", hide);
    return () => { document.removeEventListener("fullscreenchange", change); document.removeEventListener("visibilitychange", hide); };
  }, [restore]);

  const changeMode = (next: "camera" | "manual") => {
    if (next === mode) return;
    camera.stop();
    setManual({ ...MANUAL_REST }); setMode(next); restore();
  };
  useWebMcp({
    state: () => ({ drawingSource: artwork.kind, mode, camera: camera.status, gesture, manual: { ...manual }, paused, areaCount: artwork.regions.length, holdSeconds: timing.holdMs / 1000, fadeSeconds: timing.fadeMs / 1000, fadeAmount: strength, holdProgress: progress.hold, fadeProgress: progress.fade, complete: progress.complete }),
    setManual: pose => { changeMode("manual"); setManual(pose); },
    restore: () => { if (!artwork.art) throw new Error("Load a drawing before restoring colors."); restore(); },
  });
  const togglePause = () => {
    if (!hold.current.complete) restore();
    setPaused(value => !value);
  };
  const startFresh = () => {
    camera.stop(); setMode("camera"); setManual({ ...MANUAL_REST });
    setPaused(false); setTiming({ ...DEFAULT_TIMING }); setStrength(.97);
    displayed.current = { ...REST }; artwork.reset(); restore(); setSaveError(""); setFullscreenError("");
  };
  const enterFullscreen = async () => {
    setFullscreenError("");
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else if (stage.current?.requestFullscreen) await stage.current.requestFullscreen();
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
  const fadeArea = artwork.regions.length > 1 ? "selected areas" : artwork.region.label === "Your selection" ? "selected area" : `${artwork.region.label.toLowerCase()} area`;
  const stretchState = paused ? "paused" : !artwork.art ? "waiting" : artwork.art.coloredPixels < 40 ? "no-color"
    : progress.complete ? progress.fade >= 1 ? "completed" : "fading" : progress.active ? "holding" : "not-detected";
  const holdText = paused ? "Session paused" : !artwork.art ? "Upload a drawing to begin" : artwork.art.coloredPixels < 40 ? "No strong color in the selected area. Align the photo or choose a colored area."
    : progress.complete ? progress.fade >= 1 ? "Completed — selected color faded" : "Stretch held — fading selected color…" : progress.active ? "Hold still — keep both arms raised"
    : mode === "camera" && camera.status !== "live" ? "Not detected — enable camera or use manual demo"
    : mode === "camera" && (!detected.tracked || !detected.leftVisible || !detected.rightVisible) ? "Not detected — keep shoulders, elbows and both hands in view"
    : "Not detected — raise both hands above your shoulders";
  const statusText = paused ? "Paused" : mode === "manual" ? "Manual simulation" : camera.status === "live" ? camera.tracking ? "Tracking" : "No body detected" : "Camera off";
  const feedback = <div className="stretch-feedback" data-testid="stretch-feedback" data-stretch-state={stretchState}>
    <p className="stretch-instruction" data-testid="stretch-instruction"><strong>Raise both hands above your shoulders.</strong> Keep elbows near shoulder height and hold for {holdSeconds} seconds.</p>
    <p className="stretch-mapping">Fade: {fadeArea}. Lowering an arm before the hold finishes restarts the timer.</p>
    <div className="hold-panel"><strong role="status" aria-live="polite" data-testid="stretch-status">{holdText}</strong><span data-testid="hold-number">{(progress.hold * holdSeconds).toFixed(1)} / {holdSeconds}s</span><progress aria-label="Gesture hold" max={holdSeconds} value={progress.hold * holdSeconds} /><span>Fade: {Math.round(progress.fade * 100)}%</span></div>
  </div>;

  return <div className="installation-shell">
    <header className="site-header"><h1>Out of Body — MVP</h1></header>
    <main><div className="experience-grid">
      <aside className="control-panel">
        <ArtworkPanel artwork={artwork} />
        <MotionPanel camera={camera} mode={mode} setMode={changeMode} manual={manual} setManual={setManual} detected={detected} />
        <section className="control-section" aria-labelledby="session-title">
          <h2 id="session-title">Hold and fade</h2>
          <label className="slider-label">Hold: {holdSeconds}s<input type="range" aria-label="Hold duration" min="2" max="3" step=".5" value={holdSeconds} onChange={event => setTiming({ ...timing, holdMs: +event.target.value * 1000 })} /></label>
          <label className="slider-label">Fade: {timing.fadeMs / 1000}s<input type="range" aria-label="Fade duration" min=".2" max="5" step=".1" value={timing.fadeMs / 1000} onChange={event => setTiming({ ...timing, fadeMs: +event.target.value * 1000 })} /></label>
          <label className="slider-label">Amount: {Math.round(strength * 100)}%<input type="range" aria-label="Fade amount" min="25" max="100" step="1" value={Math.round(strength * 100)} onChange={event => setStrength(+event.target.value / 100)} /></label>
          <button onClick={() => { setTiming({ ...DEFAULT_TIMING }); setStrength(.97); }}>Reset timing</button>
        </section>
      </aside>
      <section className="stage-panel" aria-labelledby="stage-title">
        <div className="output-toolbar"><h2 id="stage-title">Avatar</h2><span>{artwork.kind === "upload" ? "Uploaded drawing" : artwork.kind === "sample" ? "Example drawing" : "No drawing loaded"}</span>
          <div className="output-actions">
            <button disabled={!artwork.art} onClick={togglePause}>{paused ? "Resume" : "Pause"}</button>
            <button disabled={!artwork.art || saving} onClick={() => void save()}>{saving ? "Saving…" : "Save PNG"}</button>
            <button aria-label={full ? "Exit fullscreen" : "Open installation fullscreen"} onClick={() => void enterFullscreen()}>Fullscreen</button>
            <button aria-label="Restore original colors" disabled={!artwork.art} onClick={restore}>Restore colors</button>
            <button onClick={startFresh}>Start fresh</button>
          </div>
        </div>
        {!full && feedback}
        <div className="avatar-stage" ref={stage}>
          <span className="stage-status">{statusText}</span>
          {full && <div className="fullscreen-feedback">{feedback}</div>}
          <div className="avatar-frame"><canvas ref={canvas} width={STAGE_WIDTH} height={HEIGHT} className="avatar-canvas" data-testid="avatar" data-fade={progress.fade.toFixed(2)} data-hold={progress.hold.toFixed(2)} data-paused={paused} aria-label={`${artwork.art ? `Moving artwork: ${artwork.name}` : "Blank silhouette preview"}. ${mode === "manual" ? "Motion is simulated." : "Motion follows the webcam."}`} /></div>
          {full && <button className="fullscreen-exit" onClick={() => void enterFullscreen()}>Exit fullscreen</button>}
        </div>
        {fullscreenError && <p className="error-message" role="alert">{fullscreenError}</p>}
        {saveError && <p className="error-message" role="alert">{saveError}</p>}
        <p className="prototype-note">Symbolic fade, not proof of medical relief.</p>
      </section>
    </div></main>
  </div>;
}
