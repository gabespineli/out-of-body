import { test } from "node:test";
import assert from "node:assert/strict";
import { assessFraming, advanceFraming, createFramingState } from "../src/lib/framing";
import { manualMotion, REST, type Landmark } from "../src/lib/pose";
const points = (): Landmark[] => Array.from({ length: 33 }, () => ({ x: .5, y: .5, visibility: .99, presence: .99 }));
test("framing checks the selected regions, confidence and boundary rather than shoulders alone", () => {
  const p = points(), m = manualMotion(0, 0);
  assert.equal(assessFraming(p, m, ["neck-head"], true).valid, true);
  p[27].y = 1.02;
  assert.equal(assessFraming(p, m, ["neck-head"], true).valid, true);
  assert.equal(assessFraming(p, m, ["left-leg"], true).valid, false);
  p[27].y = .9; p[15].x = .97;
  assert.equal(assessFraming(p, m, ["left-forearm"], true).valid, false);
  p[15].x = .5; p[15].visibility = .3;
  assert.equal(assessFraming(p, m, ["left-upper-arm"], true).valid, false);
  assert.equal(assessFraming(p, REST, ["torso"], true).valid, false);
  assert.equal(assessFraming(p, m, ["torso"], false).valid, false);
  assert.equal(assessFraming(p, m, [], true).valid, false);
  p[15].visibility = .99; p[15].x = Number.NaN;
  assert.equal(assessFraming(p, m, ["left-forearm"], true).valid, false);
});
test("all selected areas must fit during setup; current leg framing permits heel fallback", () => {
  const p = points(), m = { ...manualMotion(0, 0), leftFootVisible: false };
  assert.equal(assessFraming(p, m, ["left-leg"], true).valid, true);
  assert.equal(assessFraming(p, { ...m, hipsVisible: false }, ["torso"], true).valid, false);
  assert.equal(assessFraming(p, { ...m, rightVisible: false }, ["neck-head", "right-forearm"], true).valid, false);
});
test("Start needs two seconds of continuous valid frames and invalid frames reset readiness", () => {
  let state = createFramingState();
  for (let now = 0; now <= 1900; now += 100) state = advanceFraming(state, true, now, false);
  assert.equal(state.ready, false);
  state = advanceFraming(state, true, 2000, false); assert.equal(state.ready, true);
  state = advanceFraming(state, false, 2100, false); assert.equal(state.ready, false);
  state = advanceFraming(state, true, 2200, false); assert.equal(state.ready, false);
});
test("brief tracking flicker does not open the prompt; sustained loss latches until acknowledged", () => {
  let state = advanceFraming(createFramingState(), false, 0, true);
  for (let now = 100; now <= 600; now += 100) state = advanceFraming(state, false, now, true);
  assert.equal(state.recovery, false);
  state = advanceFraming(state, true, 650, true); assert.equal(state.recovery, false);
  for (let now = 700; now <= 1400; now += 100) state = advanceFraming(state, false, now, true);
  assert.equal(state.recovery, true);
  for (let now = 1500; now <= 3500; now += 100) state = advanceFraming(state, true, now, true);
  assert.equal(state.ready, true); assert.equal(state.recovery, true);
});
test("hidden or stale frames cannot satisfy the gate or silently resume a running session", () => {
  let state = advanceFraming(createFramingState(), true, 0, false);
  state = advanceFraming(state, true, 3000, false); assert.equal(state.ready, false);
  state = advanceFraming(state, true, 3100, true, true); assert.equal(state.ready, false); assert.equal(state.recovery, true);
});
