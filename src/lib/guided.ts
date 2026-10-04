import { AREA_IDS, emptyFades, type AreaFades, type BodyArea } from "./body-areas";
import { manualMotion, REST_LEGS, REST_HIPS, type Motion } from "./pose";

export const ACTIVITY_MS = 8000;
export const NEXT_ACTIVITY_MS = 1400;
const MOVEMENT_GRACE_MS = 1000;
export const GUIDED_ACTIVITIES: { area: BodyArea; instruction: string }[] = [
  { area: "neck-head", instruction: "Gently tilt your head from side to side." },
  { area: "arms-back", instruction: "Slowly reach up, then lower your arms. A gentle side lean counts too." },
  { area: "legs-feet", instruction: "Step or extend a leg sideways, return, and try the other side." },
];
export type GuideState = {
  index: number; earned: AreaFades; transition: number | null; done: boolean;
  lastTime: number | null; anchor: Record<string, number> | null; engagedUntil: number;
};
export const createGuide = (): GuideState => ({ index: 0, earned: emptyFades(), transition: null, done: false, lastTime: null, anchor: null, engagedUntil: 0 });
export function guideFades(state: GuideState): AreaFades {
  return Object.fromEntries(AREA_IDS.map(area => [area, Math.min(1, state.earned[area] / ACTIVITY_MS)])) as AreaFades;
}
export function guideSnapshot(state: GuideState) {
  const fades = guideFades(state);
  return { index: state.index, done: state.done, transitioning: state.transition !== null, active: state.engagedUntil > (state.lastTime ?? Infinity),
    progress: fades[GUIDED_ACTIVITIES[state.index].area], total: Object.values(fades).reduce((a, b) => a + b, 0) / 3, fades };
}

// Sample only relevant, confidently tracked angles; body translation is never motion credit.
function channels(motion: Motion, area: BodyArea): Record<string, number> {
  if (!motion.tracked) return {};
  if (area === "neck-head") return motion.headVisible ? { head: motion.headTilt } : {};
  if (area === "arms-back") return {
    ...(motion.leftVisible ? { leftArm: motion.leftArm } : {}),
    ...(motion.rightVisible ? { rightArm: motion.rightArm } : {}),
    ...(motion.hipsVisible ? { back: motion.lean - motion.hipTilt } : {}),
  };
  return {
    ...(motion.leftLegVisible ? { leftLeg: motion.leftLeg - motion.hipTilt, leftKnee: motion.leftKnee } : {}),
    ...(motion.rightLegVisible ? { rightLeg: motion.rightLeg - motion.hipTilt, rightKnee: motion.rightKnee } : {}),
  };
}
function threshold(channel: string) {
  return channel === "head" ? .09 : channel === "back" ? .10 : channel.includes("Arm") ? .18 : .13;
}

// Credit genuine displacement above a jitter deadband, with a short grace between motions.
// Rest/lost tracking retains earned time. Pauses and suspended frames never advance it.
export function advanceGuide(state: GuideState, motion: Motion, now: number, enabled = true, paused = false): GuideState {
  const gap = state.lastTime === null ? 0 : now - state.lastTime;
  const dt = gap > 0 && gap <= 250 ? gap : 0;
  const next = { ...state, lastTime: now };
  if (!enabled || paused || gap > 250 || gap < 0)
    return { ...next, anchor: null, engagedUntil: 0 };
  if (state.done) return next;
  if (state.transition !== null) {
    const transition = Math.max(0, state.transition - dt);
    if (transition > 0) return { ...next, transition };
    return state.index === GUIDED_ACTIVITIES.length - 1
      ? { ...next, done: true, transition: null, anchor: null, engagedUntil: 0 }
      : { ...next, index: state.index + 1, transition: null, anchor: null, engagedUntil: 0 };
  }
  const area = GUIDED_ACTIVITIES[state.index].area, current = channels(motion, area);
  const entries = Object.entries(current).filter(([, value]) => Number.isFinite(value));
  if (!entries.length) return { ...next, anchor: null, engagedUntil: 0 };
  if (!state.anchor) return { ...next, anchor: current, engagedUntil: 0 };
  const shared = entries.filter(([key]) => Number.isFinite(state.anchor![key]));
  if (!shared.length) return { ...next, anchor: current, engagedUntil: 0 };
  const moved = shared.some(([key, value]) => Math.abs(value - state.anchor![key]) >= threshold(key));
  const engagedUntil = moved ? now + MOVEMENT_GRACE_MS : state.engagedUntil;
  const earned = Math.min(ACTIVITY_MS, state.earned[area] + (now < engagedUntil ? dt : 0));
  return { ...next, anchor: moved ? current : { ...state.anchor, ...Object.fromEntries(entries.filter(([key]) => !(key in state.anchor!))) },
    engagedUntil, earned: { ...state.earned, [area]: earned }, transition: earned >= ACTIVITY_MS ? NEXT_ACTIVITY_MS : null };
}

// Authored demonstration only: it never reads participant landmarks or uploaded pixels.
export function instructorMotion(area: BodyArea, seconds: number): Motion {
  const phase = seconds * Math.PI * 2 / 6;
  if (area === "neck-head") return manualMotion(0, 0, 0, REST_LEGS, REST_HIPS, { headTilt: Math.sin(phase) * .7 });
  if (area === "arms-back") {
    const reach = (1 - Math.cos(phase)) / 2 * .92;
    return manualMotion(reach, 0, reach);
  }
  const swing = Math.sin(phase);
  return manualMotion(0, 0, 0, { ...REST_LEGS, leftLeg: Math.max(0, swing) * .6, rightLeg: Math.min(0, swing) * .6 });
}
