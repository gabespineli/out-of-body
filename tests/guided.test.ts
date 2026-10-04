import { test } from "node:test";
import assert from "node:assert/strict";
import { advanceGuide, createGuide, instructorMotion, guideSnapshot, ACTIVITY_MS, NEXT_ACTIVITY_MS, type GuideState } from "../src/lib/guided";
import { manualMotion, REST, REST_LEGS, REST_HIPS, type Motion } from "../src/lib/pose";

const neck = (angle: number) => manualMotion(0, 0, 0, REST_LEGS, REST_HIPS, { headTilt: angle });
test("guide loops independently; idle and small tracking jitter earn no progress", () => {
  assert.notDeepEqual(instructorMotion("neck-head", 0), instructorMotion("neck-head", 1.5));
  let state = createGuide();
  for (let now = 0; now <= 12000; now += 100) state = advanceGuide(state, neck(Math.sin(now) * .04), now);
  assert.equal(state.earned["neck-head"], 0);
  assert.equal(state.index, 0);
  assert.equal(guideSnapshot(state).total, 0);
});
test("gentle neck motion below the strict pose threshold earns progressive fade; rests retain it", () => {
  let state = createGuide();
  for (let now = 0; now <= 2000; now += 100) state = advanceGuide(state, neck(now % 600 < 300 ? -.3 : .3), now);
  assert.ok(state.earned["neck-head"] > 1000);
  const snapshot = guideSnapshot(state);
  assert.ok(snapshot.progress > 0 && snapshot.progress < 1);
  assert.equal(snapshot.fades["arms-back"], 0); assert.equal(snapshot.fades["legs-feet"], 0);
  for (let now = 2100; now <= 4000; now += 100) state = advanceGuide(state, neck(.3), now);
  const rested = state.earned["neck-head"];
  for (let now = 4100; now <= 6000; now += 100) state = advanceGuide(state, neck(.3), now);
  assert.equal(state.earned["neck-head"], rested);
});
test("wrong region, missing points, pause and long frame gaps never grant movement credit", () => {
  let state = createGuide();
  for (let now = 0; now <= 1000; now += 100) state = advanceGuide(state, manualMotion(now % 200 ? 1 : 0, 0), now);
  assert.equal(state.earned["neck-head"], 0);
  for (let now = 1100; now <= 1600; now += 100) state = advanceGuide(state, neck(now % 200 ? 1 : -1), now);
  const earned = state.earned["neck-head"];
  state = advanceGuide(state, REST, 1700);
  state = advanceGuide(state, neck(-1), 5000);
  assert.equal(state.earned["neck-head"], earned);
  for (let now = 5100; now <= 8000; now += 100) state = advanceGuide(state, neck(now % 200 ? 1 : -1), now, true, true);
  assert.equal(state.earned["neck-head"], earned);
  state = advanceGuide(state, neck(-1), 8100);
  assert.equal(state.earned["neck-head"], earned);
});
test("sequence advances automatically in order, keeps each fade, and finishes without looping", () => {
  let state = createGuide();
  for (let now = 0; now <= 34000; now += 100) {
    const area = ["neck-head", "arms-back", "legs-feet"][state.index] as "neck-head" | "arms-back" | "legs-feet";
    let motion: Motion;
    if (area === "neck-head") motion = neck(now % 600 < 300 ? -.3 : .3);
    else if (area === "arms-back") motion = manualMotion(now % 600 < 300 ? 0 : .2, 0, 0); // One gentle arm is enough.
    else motion = manualMotion(0, 0, 0, { ...REST_LEGS, leftLeg: now % 600 < 300 ? 0 : .25 });
    state = advanceGuide(state, motion, now);
  }
  assert.equal(state.done, true); assert.equal(state.index, 2);
  for (const value of Object.values(state.earned)) assert.equal(value, ACTIVITY_MS);
  assert.equal(guideSnapshot(state).total, 1);
  assert.deepEqual(guideSnapshot(state).fades, { "neck-head": 1, "arms-back": 1, "legs-feet": 1 });
});
test("hip rotation alone does not credit back or legs; missing leg confidence blocks its channel", () => {
  let state = { ...createGuide(), index: 1 };
  for (let now = 0; now <= 1500; now += 100) state = advanceGuide(state, manualMotion(0, 0, 0, REST_LEGS, { hipTilt: now % 200 ? 1 : -1 }), now);
  assert.equal(state.earned["arms-back"], 0);
  state = { ...createGuide(), index: 2 };
  for (let now = 0; now <= 1500; now += 100) {
    const motion = manualMotion(0, 0, 0, { ...REST_LEGS, leftLeg: now % 200 ? 1 : 0 });
    state = advanceGuide(state, { ...motion, leftLegVisible: false }, now);
  }
  assert.equal(state.earned["legs-feet"], 0);
});
test("a completed activity waits briefly, freezes transition during pause, and baselines the next area", () => {
  let state: GuideState = { ...createGuide(), earned: { "neck-head": ACTIVITY_MS, "arms-back": 0, "legs-feet": 0 }, transition: NEXT_ACTIVITY_MS, lastTime: 1000 };
  state = advanceGuide(state, neck(1), 1100, true, true);
  assert.equal(state.transition, NEXT_ACTIVITY_MS);
  for (let now = 1200; now <= 2500; now += 100) state = advanceGuide(state, neck(1), now);
  assert.equal(state.index, 1); assert.equal(state.earned["arms-back"], 0);
  state = advanceGuide(state, manualMotion(1, 0), 2600);
  assert.equal(state.earned["arms-back"], 0); // An already-held pose does not grant a fresh movement.
});
