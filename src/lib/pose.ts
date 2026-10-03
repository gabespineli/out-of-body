export type Gesture = "raise" | "left-arm" | "right-arm" | "lean" | "lean-left" | "lean-right";
export const GESTURES: { value: Gesture; label: string; prompt: string }[] = [
  { value: "raise", label: "Raised arms", prompt: "Raise both arms" },
  { value: "left-arm", label: "Left arm", prompt: "Raise your left arm" },
  { value: "right-arm", label: "Right arm", prompt: "Raise your right arm" },
  { value: "lean", label: "Side lean", prompt: "Lean to one side" },
  { value: "lean-left", label: "Lean left", prompt: "Lean to your left" },
  { value: "lean-right", label: "Lean right", prompt: "Lean to your right" },
];
export type Landmark = { x: number; y: number; visibility?: number; presence?: number };
export type Motion = {
  leftArm: number; rightArm: number; leftElbow: number; rightElbow: number;
  lean: number; tracked: boolean; raised: boolean; leaning: boolean;
  leftRaised: boolean; rightRaised: boolean;
  leftVisible: boolean; rightVisible: boolean; hipsVisible: boolean;
};
export const REST: Motion = { leftArm: 0, rightArm: 0, leftElbow: 0, rightElbow: 0, lean: 0, tracked: false, raised: false, leaning: false, leftRaised: false, rightRaised: false, leftVisible: false, rightVisible: false, hipsVisible: false };
export const HOLD_MS = 3000;
export const FADE_MS = 1600;
export type Timing = { holdMs: number; fadeMs: number };
export const DEFAULT_TIMING: Timing = { holdMs: HOLD_MS, fadeMs: FADE_MS };
const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));
const visible = (p: Landmark | undefined) => !!p && Number.isFinite(p.x) && Number.isFinite(p.y) && (p.visibility ?? 0) >= .6 && (p.presence ?? 1) >= .6;
const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));

// Mirror X once, as in the preview. Aspect correction prevents wide-camera angle bias.
export function motionFromLandmarks(points: Landmark[], aspect = 4 / 3): Motion {
  if (![11, 12].every(i => visible(points[i]))) return { ...REST };
  const angle = (a: Landmark, b: Landmark) => Math.atan2(b.y - a.y, (a.x - b.x) * aspect);
  const leftRest = Math.atan2(118, -34);
  const rightRest = Math.atan2(118, 34);
  const arm = (s: number, e: number, w: number, rest: number, forearmRest: number) => {
    if (!visible(points[e])) return { upper: 0, lower: 0 };
    const upper = wrap(angle(points[s], points[e]) - rest);
    const lower = visible(points[w]) ? wrap(angle(points[e], points[w]) - forearmRest - upper) : 0;
    return { upper: clamp(upper, -2.9, 2.9), lower: clamp(lower, -2.2, 2.2) };
  };
  const left = arm(11, 13, 15, leftRest, Math.atan2(108, -26));
  const right = arm(12, 14, 16, rightRest, Math.atan2(108, 26));
  let lean = 0;
  const hipsVisible = [23, 24].every(i => visible(points[i]));
  if (hipsVisible) {
    const sx = (points[11].x + points[12].x) / 2;
    const sy = (points[11].y + points[12].y) / 2;
    const hx = (points[23].x + points[24].x) / 2;
    const hy = (points[23].y + points[24].y) / 2;
    if (hy - sy > .08) lean = clamp(Math.atan2((hx - sx) * aspect, hy - sy), -.5, .5);
  }
  const leftVisible = [13, 15].every(i => visible(points[i]));
  const rightVisible = [14, 16].every(i => visible(points[i]));
  const leftRaised = leftVisible && points[15].y < points[11].y - .08 && points[13].y < points[11].y + .05;
  const rightRaised = rightVisible && points[16].y < points[12].y - .08 && points[14].y < points[12].y + .05;
  return { leftArm: left.upper - lean, rightArm: right.upper - lean, leftElbow: left.lower, rightElbow: right.lower, lean, tracked: true, raised: leftRaised && rightRaised, leaning: hipsVisible && Math.abs(lean) >= .20, leftRaised, rightRaised, leftVisible, rightVisible, hipsVisible };
}

export function manualMotion(left: number, lean: number, right = left): Motion {
  const tilt = lean * .4;
  return { leftArm: left * 2.55, rightArm: right * -2.55, leftElbow: left * -.18, rightElbow: right * .18, lean: tilt, tracked: true, raised: left >= .72 && right >= .72, leaning: Math.abs(tilt) >= .20, leftRaised: left >= .72, rightRaised: right >= .72, leftVisible: true, rightVisible: true, hipsVisible: true };
}

export function matchesGesture(motion: Motion, gesture: Gesture): boolean {
  if (!motion.tracked) return false;
  switch (gesture) {
    case "raise": return motion.raised;
    case "left-arm": return motion.leftRaised;
    case "right-arm": return motion.rightRaised;
    case "lean": return motion.leaning;
    // Direction matches the mirrored preview and the participant's own left/right.
    case "lean-left": return motion.leaning && motion.lean <= -.20;
    case "lean-right": return motion.leaning && motion.lean >= .20;
  }
}

export function smoothMotion(current: Motion, target: Motion, dt: number): Motion {
  const weight = 1 - Math.exp(-dt / 90);
  const mix = (a: number, b: number) => a + (b - a) * weight;
  return { ...target, leftArm: mix(current.leftArm, target.leftArm), rightArm: mix(current.rightArm, target.rightArm), leftElbow: mix(current.leftElbow, target.leftElbow), rightElbow: mix(current.rightElbow, target.rightElbow), lean: mix(current.lean, target.lean) };
}

export type HoldState = { elapsed: number; lastTime: number | null; complete: boolean; fade: number };
export const EMPTY_HOLD: HoldState = { elapsed: 0, lastTime: null, complete: false, fade: 0 };

// No accumulation across interruptions, missing frames or tab suspension.
export function advanceHold(state: HoldState, active: boolean, now: number, timing = DEFAULT_TIMING, paused = false): HoldState {
  // Pausing freezes an earned fade; an unfinished continuous hold must restart.
  if (paused) return state.complete ? { ...state, lastTime: now } : { ...EMPTY_HOLD, lastTime: now };
  const gap = state.lastTime === null ? 0 : now - state.lastTime;
  const dt = gap > 0 && gap <= 250 ? gap : 0;
  if (state.complete) return { ...state, lastTime: now, fade: Math.min(1, state.fade + dt / timing.fadeMs) };
  if (!active) return { ...EMPTY_HOLD, lastTime: now };
  const elapsed = gap > 250 ? 0 : Math.min(timing.holdMs, state.elapsed + dt);
  return { elapsed, lastTime: now, complete: elapsed >= timing.holdMs, fade: 0 };
}
