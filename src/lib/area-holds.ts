import { AREA_IDS, type BodyArea } from "./body-areas";
import { advanceHold, DEFAULT_TIMING, EMPTY_HOLD, type HoldState } from "./pose";

export type AreaHolds = Record<BodyArea, HoldState>;
export const createAreaHolds = (): AreaHolds => ({ "neck-head": { ...EMPTY_HOLD }, "arms-back": { ...EMPTY_HOLD }, "legs-feet": { ...EMPTY_HOLD } });
export function resetUnfinished(states: AreaHolds): AreaHolds {
  return Object.fromEntries(AREA_IDS.map(id => [id, states[id].complete ? { ...states[id] } : { ...EMPTY_HOLD }])) as AreaHolds;
}
export function advanceAreaHolds(states: AreaHolds, selected: BodyArea, active: boolean, now: number, timing = DEFAULT_TIMING, paused = false): AreaHolds {
  return Object.fromEntries(AREA_IDS.map(id => [id, advanceHold(states[id], id === selected && active, now, timing, paused)])) as AreaHolds;
}
