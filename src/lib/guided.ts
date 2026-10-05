import { AREA_IDS, emptyFades, type AreaFades, type BodyArea } from "./body-areas";
import { manualMotion, REST_LEGS, REST_HIPS, REST_HEAD, type Motion } from "./pose";

export const ACTIVITY_MS = 8000;
export const PART_MS = ACTIVITY_MS / 2;
export const NEXT_ACTIVITY_MS = 1400;
const MOVEMENT_GRACE_MS = 800;
const FEET_WAIT_MS = 2500;
export type GuideStep = "tilt" | "reach" | "side-stretch" | "side-step" | "heel-raise";
export const GUIDED_ACTIVITIES: { area: BodyArea; instruction: string }[] = [
  { area: "neck-head", instruction: "Gently tilt your head side to side." },
  { area: "arms-back", instruction: "Reach overhead, then gently stretch side to side." },
  { area: "legs-feet", instruction: "Side steps, then heel raises holding a chair." },
];
export const STEP_INSTRUCTIONS: Record<GuideStep, string> = {
  tilt: "Gently tilt your head side to side.",
  reach: "Gently reach overhead, then lower. One arm is okay.",
  "side-stretch": "Keep an arm up; gently lean side to side.",
  "side-step": "Take small side steps, alternating left and right.",
  "heel-raise": "Hold a stable chair. Slowly raise and lower your heels.",
};
export type GuideState = {
  index: number; earned: AreaFades; transition: number | null; done: boolean;
  lastTime: number | null; anchor: Record<string, number> | null; engagedUntil: number;
  seenSides: number; feetMissingMs: number; feetFallback: boolean; skipped: BodyArea[];
};
export const createGuide = (): GuideState => ({ index: 0, earned: emptyFades(), transition: null, done: false,
  lastTime: null, anchor: null, engagedUntil: 0, seenSides: 0, feetMissingMs: 0, feetFallback: false, skipped: [] });
const freshPart = { anchor: null, engagedUntil: 0, seenSides: 0, feetMissingMs: 0, feetFallback: false };
export function guideStep(state: GuideState): GuideStep {
  const area = GUIDED_ACTIVITIES[state.index].area;
  if (area === "neck-head") return "tilt";
  if (area === "arms-back") return state.earned[area] < PART_MS ? "reach" : "side-stretch";
  return state.earned[area] < PART_MS || state.feetFallback ? "side-step" : "heel-raise";
}
export function guideFades(state: GuideState): AreaFades {
  return Object.fromEntries(AREA_IDS.map(area => [area, Math.min(1, state.earned[area] / ACTIVITY_MS)])) as AreaFades;
}
export function guideSnapshot(state: GuideState) {
  const fades = guideFades(state);
  return { index: state.index, done: state.done, step: guideStep(state), feetFallback: state.feetFallback, skipped: state.skipped,
    transitioning: state.transition !== null, active: state.engagedUntil > (state.lastTime ?? Infinity),
    progress: fades[GUIDED_ACTIVITIES[state.index].area], total: Object.values(fades).reduce((a, b) => a + b, 0) / 3, fades };
}
// A skip retains partial fades without awarding unperformed movement.
export function skipGuide(state: GuideState): GuideState {
  if (state.done || state.transition !== null) return state;
  const skipped = [...state.skipped, GUIDED_ACTIVITIES[state.index].area];
  return { ...state, ...freshPart, skipped, lastTime: null, transition: null,
    index: Math.min(2, state.index + 1), done: state.index === 2 };
}
function channels(m: Motion, step: GuideStep): Record<string, number> {
  if (!m.tracked) return {};
  if (step === "tilt") return m.headVisible ? { head: m.headTilt } : {};
  if (step === "reach") return {
    ...(m.leftVisible ? { leftArm: m.leftArm } : {}), ...(m.rightVisible ? { rightArm: m.rightArm } : {}),
  };
  if (step === "side-stretch") return m.hipsVisible ? { back: m.lean - m.hipTilt } : {};
  if (step === "side-step") return m.hipsVisible ? {
    ...(m.leftLegVisible ? { leftLeg: m.leftLeg - m.hipTilt } : {}), ...(m.rightLegVisible ? { rightLeg: m.rightLeg - m.hipTilt } : {}),
  } : {};
  return {
    ...(m.leftFootVisible ? { leftHeel: m.leftHeel, leftAnkle: m.leftAnkleHeight, leftToe: m.leftToeY } : {}),
    ...(m.rightFootVisible ? { rightHeel: m.rightHeel, rightAnkle: m.rightAnkleHeight, rightToe: m.rightToeY } : {}),
  };
}
// Current unsmoothed participant measurements only; the instructor is never an input.
export function advanceGuide(state: GuideState, m: Motion, now: number, enabled = true, paused = false): GuideState {
  const gap = state.lastTime === null ? 0 : now - state.lastTime;
  const dt = gap > 0 && gap <= 250 ? gap : 0;
  const next = { ...state, lastTime: now };
  if (!enabled || paused || gap > 250 || gap < 0) return { ...next, anchor: null, engagedUntil: 0, feetMissingMs: 0 };
  if (state.done) return next;
  if (state.transition !== null) {
    const transition = Math.max(0, state.transition - dt);
    if (transition > 0) return { ...next, transition };
    return state.index === 2 ? { ...next, ...freshPart, done: true, transition: null }
      : { ...next, ...freshPart, index: state.index + 1, transition: null };
  }
  const area = GUIDED_ACTIVITIES[state.index].area, step = guideStep(state);
  // Poor foot tracking explicitly switches both guide and detector to more side steps.
  const feetMissingMs = step === "heel-raise" && m.tracked && m.hipsVisible
    && (m.leftLegVisible || m.rightLegVisible) && !m.leftFootVisible && !m.rightFootVisible ? state.feetMissingMs + dt : 0;
  if (feetMissingMs >= FEET_WAIT_MS) return { ...next, ...freshPart, feetFallback: true };
  next.feetMissingMs = feetMissingMs;
  const current = channels(m, step);
  const entries = Object.entries(current).filter(([, value]) => Number.isFinite(value));
  if (!entries.length) return { ...next, anchor: null, engagedUntil: 0 };
  const reaching = m.leftVisible && m.leftReaching || m.rightVisible && m.rightReaching;
  if ((step === "reach" || step === "side-stretch") && !reaching) return { ...next, anchor: current, engagedUntil: 0 };
  if (!state.anchor) return { ...next, anchor: current, engagedUntil: 0 };
  const anchor = state.anchor;
  const changed = (key: string, threshold: number) => Number.isFinite(current[key]) && Number.isFinite(anchor[key])
    && Math.abs(current[key] - anchor[key]) >= threshold;
  let moved = false, seenSides = state.seenSides;
  if (step === "tilt") moved = changed("head", .09);
  if (step === "reach") moved = m.leftReaching && changed("leftArm", .14) || m.rightReaching && changed("rightArm", .14);
  if (step === "side-stretch") moved = changed("back", .07);
  if (step === "side-step") {
    const left = changed("leftLeg", .09) && Math.max(current.leftLeg, anchor.leftLeg) >= .08;
    const right = changed("rightLeg", .09) && Math.min(current.rightLeg, anchor.rightLeg) <= -.08;
    moved = left || right;
    if (left) seenSides |= 1;
    if (right) seenSides |= 2;
  }
  if (step === "heel-raise") moved = ["left", "right"].some(side =>
    changed(side + "Heel", .055) && changed(side + "Ankle", .03)
    && (current[side + "Heel"] - anchor[side + "Heel"]) * (current[side + "Ankle"] - anchor[side + "Ankle"]) > 0
    && Math.abs(current[side + "Toe"] - anchor[side + "Toe"]) <= .015);
  if (step === "heel-raise" && !moved && ["left", "right"].some(side =>
    Number.isFinite(current[side + "Toe"]) && Number.isFinite(anchor[side + "Toe"])
    && Math.abs(current[side + "Toe"] - anchor[side + "Toe"]) > .015))
    return { ...next, anchor: current, engagedUntil: 0 }; // Reposition without earning progress.
  const engagedUntil = moved ? now + MOVEMENT_GRACE_MS : state.engagedUntil;
  const partEnd = (step === "reach" || step === "side-step" && state.earned[area] < PART_MS) ? PART_MS : ACTIVITY_MS;
  const limit = step === "side-step" && seenSides !== 3 ? partEnd - 100 : partEnd;
  const earned = Math.min(limit, state.earned[area] + (now < engagedUntil ? dt : 0));
  const updated = { ...next, seenSides, anchor: moved ? current : { ...anchor, ...Object.fromEntries(entries.filter(([key]) => !(key in anchor))) },
    engagedUntil, earned: { ...state.earned, [area]: earned }, transition: earned >= ACTIVITY_MS ? NEXT_ACTIVITY_MS : null };
  return guideStep(updated) !== step ? { ...updated, ...freshPart } : updated;
}
// Authored loops. Matching their timing is unnecessary.
export function instructorMotion(area: BodyArea, seconds: number, step?: GuideStep): Motion {
  const phase = seconds * Math.PI * 2 / 6;
  if (area === "neck-head") return manualMotion(0, 0, 0, REST_LEGS, REST_HIPS, { headTilt: Math.sin(phase) * .5 });
  if (area === "arms-back") {
    const part = step ?? (seconds % 12 < 6 ? "reach" : "side-stretch");
    if (part === "reach") { const reach = (1 - Math.cos(phase)) / 2 * .85; return manualMotion(reach, 0, reach); }
    return manualMotion(.85, Math.sin(phase) * .35, .85);
  }
  if (step === "heel-raise") return manualMotion(.2, 0, .2, REST_LEGS, REST_HIPS, REST_HEAD, { heelRaise: (1 - Math.cos(phase)) / 2 });
  const swing = Math.sin(phase);
  return manualMotion(0, 0, 0, { ...REST_LEGS, leftLeg: Math.max(0, swing) * .3, rightLeg: Math.min(0, swing) * .3 });
}
