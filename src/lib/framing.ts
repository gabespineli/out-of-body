import { areaSide, isLegArea, type BodyArea } from "./body-areas";
import type { Landmark, Motion } from "./pose";

export const POSITION_STEADY_MS = 2000;
export const POSITION_COUNTDOWN_MS = 3000;
export const LOST_PROMPT_MS = 650;
export type FramingVerdict = { valid: boolean; message: string };
export function assessFraming(points: Landmark[], motion: Motion, areas: BodyArea[], fresh: boolean): FramingVerdict {
  if (!fresh || !motion.tracked || !areas.length) return { valid: false, message: "Move into view so the camera can see you." };
  const required = new Set([11, 12]);
  for (const area of areas) {
    if (area === "neck-head") { [0, 7, 8].forEach(id => required.add(id)); if (!motion.headVisible) return { valid: false, message: "Face the camera with your head and shoulders visible." }; }
    else if (area === "torso") { [23, 24].forEach(id => required.add(id)); if (!motion.hipsVisible) return { valid: false, message: "Step back until your shoulders and hips are visible." }; }
    else {
      const left = areaSide(area) === "left";
      if (isLegArea(area)) {
        [23, 24, left ? 25 : 26, left ? 27 : 28].forEach(id => required.add(id));
        if (!motion.hipsVisible || !motion[`${left ? "left" : "right"}LegVisible`]) return { valid: false, message: `Step back until your ${left ? "left" : "right"} leg and ankle are visible.` };
      } else {
        [left ? 13 : 14, left ? 15 : 16].forEach(id => required.add(id));
        if (!motion[`${left ? "left" : "right"}Visible`]) return { valid: false, message: `Keep your ${left ? "left" : "right"} shoulder, elbow and hand visible.` };
      }
    }
  }
  for (const id of required) {
    const point = points[id];
    if (!point || !Number.isFinite(point.x) || !Number.isFinite(point.y) || (point.visibility ?? 0) < .6 || (point.presence ?? 1) < .6)
      return { valid: false, message: "Move into clear view and leave room to move." };
    if (point.x < .06 || point.x > .94) return { valid: false, message: "Move toward the center of the outline." };
    if (point.y < .04 || point.y > .96) return { valid: false, message: "Step back to fit inside the boundary." };
  }
  return { valid: true, message: "You’re in position. Hold steady for a moment." };
}
export type FramingState = { lastTime: number | null; steadySince: number | null; missingSince: number | null; ready: boolean; recovery: boolean };
export const createFramingState = (): FramingState => ({ lastTime: null, steadySince: null, missingSince: null, ready: false, recovery: false });
// Count only current, continuously visible tracking frames, never elapsed timer time.
export function positionCountdown(state: FramingState, valid: boolean): number | null {
  if (!valid || state.steadySince === null || state.lastTime === null) return null;
  return Math.max(0, Math.ceil((POSITION_COUNTDOWN_MS - (state.lastTime - state.steadySince)) / 1000));
}
export function advanceFraming(state: FramingState, valid: boolean, now: number, monitoring: boolean, hidden = false): FramingState {
  const gap = state.lastTime === null ? 0 : now - state.lastTime;
  if (hidden || gap > 250 || gap < 0) return { ...createFramingState(), lastTime: now, recovery: state.recovery || monitoring };
  const steadySince = valid ? state.steadySince ?? now : null;
  const missingSince = valid ? null : state.missingSince ?? now;
  const ready = steadySince !== null && now - steadySince >= POSITION_STEADY_MS;
  return { lastTime: now, steadySince, missingSince, ready,
    recovery: !ready && (state.recovery || monitoring && missingSince !== null && now - missingSince >= LOST_PROMPT_MS) };
}
