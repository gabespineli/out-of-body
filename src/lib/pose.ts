export type Gesture = "raise" | "left-arm" | "right-arm" | "lean" | "lean-left" | "lean-right" | "left-leg" | "right-leg";
export const GESTURES: { value: Gesture; label: string; prompt: string }[] = [
  { value: "raise", label: "Raised arms", prompt: "Raise both arms" },
  { value: "left-arm", label: "Left arm", prompt: "Raise your left arm" },
  { value: "right-arm", label: "Right arm", prompt: "Raise your right arm" },
  { value: "lean", label: "Side lean", prompt: "Lean to one side" },
  { value: "lean-left", label: "Lean left", prompt: "Lean to your left" },
  { value: "lean-right", label: "Lean right", prompt: "Lean to your right" },
  { value: "left-leg", label: "Left leg lift", prompt: "Move your left leg out to the side" },
  { value: "right-leg", label: "Right leg lift", prompt: "Move your right leg out to the side" },
];
export type Landmark = { x: number; y: number; visibility?: number; presence?: number };
export type Motion = {
  leftArm: number; rightArm: number; leftElbow: number; rightElbow: number;
  leftLeg: number; rightLeg: number; leftKnee: number; rightKnee: number;
  hipTilt: number;
  lean: number; tracked: boolean; raised: boolean; leaning: boolean;
  leftRaised: boolean; rightRaised: boolean;
  leftVisible: boolean; rightVisible: boolean; hipsVisible: boolean;
  leftLegVisible: boolean; rightLegVisible: boolean; leftLegLifted: boolean; rightLegLifted: boolean;
};
export const REST: Motion = { leftArm: 0, rightArm: 0, leftElbow: 0, rightElbow: 0, leftLeg: 0, rightLeg: 0, leftKnee: 0, rightKnee: 0, hipTilt: 0, lean: 0, tracked: false, raised: false, leaning: false, leftRaised: false, rightRaised: false, leftVisible: false, rightVisible: false, hipsVisible: false, leftLegVisible: false, rightLegVisible: false, leftLegLifted: false, rightLegLifted: false };
export type ManualLegs = { leftLeg: number; rightLeg: number; leftKnee: number; rightKnee: number };
export const REST_LEGS: ManualLegs = { leftLeg: 0, rightLeg: 0, leftKnee: 0, rightKnee: 0 };
export type ManualHips = { hipTilt: number };
export const REST_HIPS: ManualHips = { hipTilt: 0 };
export const HOLD_MS = 3000;
export const FADE_MS = 1600;
export type Timing = { holdMs: number; fadeMs: number };
export const DEFAULT_TIMING: Timing = { holdMs: HOLD_MS, fadeMs: FADE_MS };
const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));
const visible = (p: Landmark | undefined) => !!p && Number.isFinite(p.x) && Number.isFinite(p.y) && (p.visibility ?? 0) >= .6 && (p.presence ?? 1) >= .6;
const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));

// Mirror X once, as in the preview. Aspect correction prevents wide-camera angle bias.
export function motionFromLandmarks(points: Landmark[], aspect = 4 / 3, previous: Motion = REST): Motion {
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
  let lean = 0, hipTilt = 0;
  const hipsVisible = [23, 24].every(i => visible(points[i]));
  if (hipsVisible) {
    const sx = (points[11].x + points[12].x) / 2;
    const sy = (points[11].y + points[12].y) / 2;
    const hx = (points[23].x + points[24].x) / 2;
    const hy = (points[23].y + points[24].y) / 2;
    if (hy - sy > .08) lean = clamp(Math.atan2((hx - sx) * aspect, hy - sy), -.5, .5);
    const span = Math.abs(points[23].x - points[24].x) * aspect;
    if (span >= .04) hipTilt = clamp(Math.atan2(points[24].y - points[23].y, span), -.35, .35);
  }
  const leftVisible = [13, 15].every(i => visible(points[i]));
  const rightVisible = [14, 16].every(i => visible(points[i]));
  // Enter with hands clearly above the shoulders; tolerate small jitter while held.
  // Low confidence still releases immediately, and lowered hands cannot keep a hold.
  const raisedArm = (s: number, e: number, w: number, wasRaised: boolean) =>
    visible(points[e]) && visible(points[w]) && points[w].y < points[s].y - (wasRaised ? .04 : .08)
    && points[e].y < points[s].y + (wasRaised ? .07 : .05);
  const leftRaised = raisedArm(11, 13, 15, previous.leftRaised);
  const rightRaised = raisedArm(12, 14, 16, previous.rightRaised);
  const leg = (h: number, k: number, a: number, thighRest: number, shinRest: number) => {
    if (![h, k, a].every(i => visible(points[i]))) return { upper: 0, lower: 0, visible: false };
    const length = (p: Landmark, q: Landmark) => Math.hypot((p.x - q.x) * aspect, p.y - q.y);
    if (length(points[h], points[k]) < .04 || length(points[k], points[a]) < .04) return { upper: 0, lower: 0, visible: false };
    const upper = clamp(wrap(angle(points[h], points[k]) - thighRest), -1.3, 1.3);
    const lower = clamp(wrap(angle(points[k], points[a]) - shinRest - upper), -2, 2);
    return { upper, lower, visible: true };
  };
  const leftLeg = leg(23, 25, 27, Math.atan2(130, -2), Math.atan2(133, 4));
  const rightLeg = leg(24, 26, 28, Math.atan2(130, 2), Math.atan2(133, -4));
  return { leftArm: left.upper - lean, rightArm: right.upper - lean, leftElbow: left.lower, rightElbow: right.lower, lean, tracked: true, raised: leftRaised && rightRaised, leaning: hipsVisible && Math.abs(lean) >= .20, leftRaised, rightRaised, leftVisible, rightVisible, hipsVisible,
    hipTilt,
    leftLeg: leftLeg.visible ? leftLeg.upper : hipTilt, rightLeg: rightLeg.visible ? rightLeg.upper : hipTilt, leftKnee: leftLeg.lower, rightKnee: rightLeg.lower,
    leftLegVisible: leftLeg.visible, rightLegVisible: rightLeg.visible,
    leftLegLifted: leftLeg.visible && leftLeg.upper - hipTilt >= .28, rightLegLifted: rightLeg.visible && rightLeg.upper - hipTilt <= -.28 };
}

export function manualMotion(left: number, lean: number, right = left, legs: ManualLegs = REST_LEGS, hips: ManualHips = REST_HIPS): Motion {
  const tilt = lean * .4;
  const hipTilt = hips.hipTilt * .35;
  return { leftArm: left * 2.55, rightArm: right * -2.55, leftElbow: left * -.18, rightElbow: right * .18, lean: tilt + hipTilt, tracked: true, raised: left >= .72 && right >= .72, leaning: Math.abs(tilt + hipTilt) >= .20, leftRaised: left >= .72, rightRaised: right >= .72, leftVisible: true, rightVisible: true, hipsVisible: true,
    hipTilt,
    leftLeg: legs.leftLeg * .8 + hipTilt, rightLeg: legs.rightLeg * .8 + hipTilt, leftKnee: legs.leftKnee * .9, rightKnee: legs.rightKnee * -.9,
    leftLegVisible: true, rightLegVisible: true, leftLegLifted: legs.leftLeg * .8 >= .28, rightLegLifted: legs.rightLeg * .8 <= -.28 };
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
    case "left-leg": return motion.leftLegLifted;
    case "right-leg": return motion.rightLegLifted;
  }
}

export function smoothMotion(current: Motion, target: Motion, dt: number): Motion {
  const weight = 1 - Math.exp(-dt / 90);
  const mix = (a: number, b: number) => a + (b - a) * weight;
  return { ...target, leftArm: mix(current.leftArm, target.leftArm), rightArm: mix(current.rightArm, target.rightArm), leftElbow: mix(current.leftElbow, target.leftElbow), rightElbow: mix(current.rightElbow, target.rightElbow), leftLeg: mix(current.leftLeg, target.leftLeg), rightLeg: mix(current.rightLeg, target.rightLeg), leftKnee: mix(current.leftKnee, target.leftKnee), rightKnee: mix(current.rightKnee, target.rightKnee), hipTilt: mix(current.hipTilt, target.hipTilt), lean: mix(current.lean, target.lean) };
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
