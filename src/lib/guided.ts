import { AREA_IDS, areaSide, emptyFades, type AreaFades, type BodyArea } from "./body-areas";
import { manualMotion, REST_LEGS, REST_HIPS, REST_HEAD, REST_FEET, type Motion } from "./pose";

export const ACTIVITY_MS = 8000;
export const PART_MS = ACTIVITY_MS / 3;
export const NEXT_ACTIVITY_MS = 1400;
const MOVEMENT_GRACE_MS = 800;
export type GuideStep = "tilt" | "reach" | "elbow-bend" | "side-stretch" | "side-step" | "side-raise";
export const STEP_INSTRUCTIONS: Record<GuideStep, string> = {
  tilt: "Gently tilt your head side to side.", reach: "Gently reach overhead, then lower.",
  "elbow-bend": "Gently bend your elbow, then lower. Keep your upper arm still.",
  "side-stretch": "With hands on your hips, gently lean left, then right.",
  "side-step": "Take small steps out to the side, then return.",
  "side-raise": "Hold a stable support if needed. Gently raise your leg sideways, then lower.",
};
export type GuideState = {
  areas: BodyArea[]; index: number; earned: AreaFades; transition: number | null; done: boolean;
  lastTime: number | null; anchor: Record<string, number> | null; engagedUntil: number;
  seenSides: number; skipped: BodyArea[];
};
export const createGuide = (areas: BodyArea[] = []): GuideState => ({
  areas: AREA_IDS.filter(id => areas.includes(id)), index: 0, earned: emptyFades(), transition: null, done: false,
  lastTime: null, anchor: null, engagedUntil: 0, seenSides: 0, skipped: [],
});
const freshPart = { anchor: null, engagedUntil: 0, seenSides: 0 };
export function guideStep(state: GuideState): GuideStep {
  const area = state.areas[state.index];
  if (!area || area === "neck-head") return "tilt";
  if (area === "torso") return "side-stretch";
  if (area.endsWith("upper-arm")) return "reach";
  if (area.endsWith("forearm")) return "elbow-bend";
  if (state.earned[area] < PART_MS) return "side-step";
  return "side-raise";
}
export function guideInstruction(area: BodyArea, step: GuideStep) {
  if (area === "neck-head" || area === "torso") return STEP_INSTRUCTIONS[step];
  const side = areaSide(area);
  if (step === "reach") return `Gently reach overhead with your ${side} arm, then lower.`;
  if (step === "elbow-bend") return `Gently bend your ${side} elbow, then lower. Keep your upper arm still.`;
  if (step === "side-step") return `Take small steps to your ${side}, then return.`;
  if (step === "side-raise") return `Hold a stable support if needed. Try gentle ${side} side leg raises, then lower.`;
  return STEP_INSTRUCTIONS[step];
}
export function guideFades(state: GuideState): AreaFades {
  return Object.fromEntries(AREA_IDS.map(area => [area, Math.min(1, state.earned[area] / ACTIVITY_MS)])) as AreaFades;
}
export function guideSnapshot(state: GuideState) {
  const fades = guideFades(state), area = state.areas[state.index] ?? "neck-head";
  return { areas: state.areas, area, index: state.index, done: state.done, step: guideStep(state), skipped: state.skipped,
    transitioning: state.transition !== null, active: state.engagedUntil > (state.lastTime ?? Infinity),
    progress: state.areas.length ? fades[area] : 0,
    total: state.areas.length ? state.areas.reduce((sum, id) => sum + fades[id], 0) / state.areas.length : 0, fades };
}
export function skipGuide(state: GuideState): GuideState {
  if (!state.areas.length || state.done || state.transition !== null) return state;
  const final = state.index === state.areas.length - 1;
  return { ...state, ...freshPart, skipped: [...state.skipped, state.areas[state.index]], lastTime: null, transition: null,
    index: final ? state.index : state.index + 1, done: final };
}
function channels(m: Motion, step: GuideStep, area: BodyArea): Record<string, number> {
  if (!m.tracked) return {};
  if (step === "tilt") return m.headVisible ? { head: m.headTilt } : {};
  if (step === "side-stretch") return m.hipsVisible ? { back: m.lean - m.hipTilt } : {};
  const side = areaSide(area);
  if (step === "reach") return m[`${side}Visible`] ? { arm: m[`${side}Arm`] } : {};
  if (step === "elbow-bend") return m[`${side}Visible`] ? { elbow: m[`${side}Elbow`] } : {};
  if (step === "side-step" || step === "side-raise") return m.hipsVisible && m[`${side}LegVisible`]
    ? { leg: (m[`${side}Leg`] - m.hipTilt) * (side === "left" ? 1 : -1) } : {};
  return {};
}
// Only current, unsmoothed participant measurements earn progress.
export function advanceGuide(state: GuideState, m: Motion, now: number, enabled = true, paused = false): GuideState {
  const gap = state.lastTime === null ? 0 : now - state.lastTime;
  const dt = gap > 0 && gap <= 250 ? gap : 0;
  const next = { ...state, lastTime: now };
  if (!enabled || paused || gap > 250 || gap < 0) return { ...next, anchor: null, engagedUntil: 0 };
  if (state.done || !state.areas.length) return next;
  if (state.transition !== null) {
    const transition = Math.max(0, state.transition - dt);
    if (transition > 0) return { ...next, transition };
    return state.index === state.areas.length - 1 ? { ...next, ...freshPart, done: true, transition: null }
      : { ...next, ...freshPart, index: state.index + 1, transition: null };
  }
  const area = state.areas[state.index], step = guideStep(state), side = areaSide(area);
  const current = channels(m, step, area);
  const entries = Object.entries(current).filter(([, value]) => Number.isFinite(value));
  if (!entries.length) return { ...next, anchor: null, engagedUntil: 0 };
  if (step === "reach" && !m[`${side}Reaching`]) return { ...next, anchor: current, engagedUntil: 0 };
  if (!state.anchor) return { ...next, anchor: current, engagedUntil: 0 };
  const anchor = state.anchor;
  const changed = (key: string, threshold: number) => Number.isFinite(current[key]) && Number.isFinite(anchor[key]) && Math.abs(current[key] - anchor[key]) >= threshold;
  let moved = false, seenSides = state.seenSides;
  if (step === "tilt") moved = changed("head", .09);
  if (step === "reach") moved = changed("arm", .14);
  if (step === "elbow-bend") moved = changed("elbow", .14);
  if (step === "side-stretch") {
    moved = changed("back", .07);
    if (moved && current.back <= -.07) seenSides |= 1;
    if (moved && current.back >= .07) seenSides |= 2;
  }
  if (step === "side-step" || step === "side-raise") moved = changed("leg", .09) && Math.max(current.leg, anchor.leg) >= (step === "side-raise" ? .28 : .08);
  const engagedUntil = moved ? now + MOVEMENT_GRACE_MS : state.engagedUntil;
  const partEnd = step === "side-step" ? PART_MS : ACTIVITY_MS;
  const limit = step === "side-stretch" && seenSides !== 3 ? partEnd - 100 : partEnd;
  const earned = Math.min(limit, state.earned[area] + (now < engagedUntil ? dt : 0));
  const updated = { ...next, seenSides, anchor: moved ? current : anchor, engagedUntil,
    earned: { ...state.earned, [area]: earned }, transition: earned >= ACTIVITY_MS ? NEXT_ACTIVITY_MS : null };
  return guideStep(updated) !== step ? { ...updated, ...freshPart } : updated;
}
// Authored loops explain the action; their timing never drives detection.
export function instructorMotion(area: BodyArea, seconds: number, step?: GuideStep): Motion {
  const phase = seconds * Math.PI * 2 / 6, swing = Math.sin(phase), lift = (1 - Math.cos(phase)) / 2;
  if (area === "neck-head") return manualMotion(0, 0, 0, REST_LEGS, REST_HIPS, { headTilt: swing * .5 });
  if (area === "torso") return { ...manualMotion(0, swing * .5), leftArm: .3, rightArm: -.3, leftElbow: -1.35, rightElbow: 1.35 };
  const side = areaSide(area);
  if (area.endsWith("upper-arm")) return manualMotion(side === "left" ? lift * .85 : 0, 0, side === "right" ? lift * .85 : 0);
  if (area.endsWith("forearm")) return manualMotion(0, 0, 0, REST_LEGS, REST_HIPS, REST_HEAD, REST_FEET,
    { leftElbow: side === "left" ? lift * .85 : 0, rightElbow: side === "right" ? lift * .85 : 0 });
  const extent = step === "side-step" ? .3 : .65;
  return manualMotion(0, 0, 0, { ...REST_LEGS, leftLeg: side === "left" ? lift * extent : 0, rightLeg: side === "right" ? -lift * extent : 0 });
}
