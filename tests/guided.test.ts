import { test } from "node:test";
import assert from "node:assert/strict";
import { advanceGuide, createGuide, instructorMotion, guideSnapshot, ACTIVITY_MS, PART_MS, NEXT_ACTIVITY_MS, guideStep, skipGuide, type GuideState } from "../src/lib/guided";
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
  for (let now = 0; now <= 45000; now += 100) {
    const area = ["neck-head", "arms-back", "legs-feet"][state.index] as "neck-head" | "arms-back" | "legs-feet";
    let motion: Motion;
    if (area === "neck-head") motion = neck(now % 600 < 300 ? -.3 : .3);
    else if (area === "arms-back") motion = guideStep(state) === "reach"
      ? manualMotion(now % 600 < 300 ? .5 : .8, 0, 0)
      : manualMotion(.65, now % 600 < 300 ? -.3 : .3, 0);
    else motion = guideStep(state) === "heel-raise"
      ? manualMotion(0, 0, 0, REST_LEGS, REST_HIPS, { headTilt: 0 }, { heelRaise: now % 600 < 300 ? 0 : .6 })
      : manualMotion(0, 0, 0, { ...REST_LEGS, leftLeg: now % 600 < 300 ? .25 : 0, rightLeg: now % 600 < 300 ? 0 : -.25 });
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
test("arms sequence requires reach first, then raised-arm side stretch; low hand waving is rejected", () => {
  let state = { ...createGuide(), index: 1 };
  for (let now = 0; now <= 2000; now += 100) state = advanceGuide(state, manualMotion(now % 600 ? .2 : 0, now % 600 ? .4 : -.4, 0), now);
  assert.equal(state.earned["arms-back"], 0);
  for (let now = 2100; now <= 7200; now += 100) state = advanceGuide(state, manualMotion(now % 600 < 300 ? .5 : .8, 0, 0), now);
  assert.equal(guideStep(state), "side-stretch"); assert.equal(state.earned["arms-back"], PART_MS);
  for (let now = 7300; now <= 9500; now += 100) state = advanceGuide(state, manualMotion(now % 600 < 300 ? .5 : .8, 0, 0), now);
  assert.equal(state.earned["arms-back"], PART_MS);
  for (let now = 9600; now <= 11000; now += 100) state = advanceGuide(state, manualMotion(0, now % 600 < 300 ? -.3 : .3), now);
  assert.equal(state.earned["arms-back"], PART_MS);
  for (let now = 11100; now <= 16000; now += 100) state = advanceGuide(state, manualMotion(.65, now % 600 < 300 ? -.3 : .3, 0), now);
  assert.equal(state.earned["arms-back"], ACTIVITY_MS);
  assert.equal(state.earned["neck-head"], 0); assert.equal(state.earned["legs-feet"], 0);
});
test("alternating steps are required; knee bend and heel motion cannot complete the step part", () => {
  let state = { ...createGuide(), index: 2 };
  for (let now = 0; now <= 1500; now += 100) state = advanceGuide(state, manualMotion(0, 0, 0, { ...REST_LEGS, leftKnee: now % 600 ? .7 : 0 }), now);
  assert.equal(state.earned["legs-feet"], 0);
  for (let now = 1600; now <= 7000; now += 100) state = advanceGuide(state, manualMotion(0, 0, 0, { ...REST_LEGS, leftLeg: now % 600 < 300 ? 0 : .25 }), now);
  assert.ok(state.earned["legs-feet"] < PART_MS); assert.equal(guideStep(state), "side-step");
  for (let now = 7100; now <= 7300; now += 100) state = advanceGuide(state, manualMotion(0, 0, 0, { ...REST_LEGS, rightLeg: -.25 }), now);
  assert.equal(guideStep(state), "heel-raise"); assert.equal(state.earned["legs-feet"], PART_MS);
  for (let now = 7400; now <= 8500; now += 100) state = advanceGuide(state, manualMotion(0, 0, 0, { ...REST_LEGS, leftLeg: now % 600 ? .5 : 0 }), now);
  assert.equal(state.earned["legs-feet"], PART_MS);
});
test("heel raises require changing heel and ankle height with planted toes; jitter and foot lifts fail", () => {
  let state = { ...createGuide(), index: 2, earned: { "neck-head": 0, "arms-back": 0, "legs-feet": PART_MS } };
  const heel = (value: number) => manualMotion(0, 0, 0, REST_LEGS, REST_HIPS, { headTilt: 0 }, { heelRaise: value });
  for (let now = 0; now <= 1500; now += 100) state = advanceGuide(state, heel(now % 600 ? .1 : 0), now);
  assert.equal(state.earned["legs-feet"], PART_MS);
  for (let now = 1600; now <= 3000; now += 100) state = advanceGuide(state, { ...heel(now % 600 ? .6 : 0), leftToeY: now % 600 ? .7 : .9, rightToeY: now % 600 ? .7 : .9 }, now);
  assert.equal(state.earned["legs-feet"], PART_MS);
  state = { ...state, anchor: null };
  for (let now = 3100; now <= 8000; now += 100) state = advanceGuide(state, heel(now % 600 < 300 ? 0 : .6), now);
  assert.equal(state.earned["legs-feet"], ACTIVITY_MS);
});
test("unusable feet give an explicit matching side-step fallback; loss of the whole person does not", () => {
  const start = () => ({ ...createGuide(), index: 2, earned: { "neck-head": 0, "arms-back": 0, "legs-feet": PART_MS } });
  let state = start();
  for (let now = 0; now <= 3000; now += 100) state = advanceGuide(state, REST, now);
  assert.equal(state.feetFallback, false); assert.equal(state.earned["legs-feet"], PART_MS);
  state = start();
  for (let now = 0; now <= 3000; now += 100) state = advanceGuide(state, { ...manualMotion(0, 0), leftFootVisible: false, rightFootVisible: false }, now);
  assert.equal(state.feetFallback, true); assert.equal(guideStep(state), "side-step");
  assert.equal(state.earned["legs-feet"], PART_MS);
  for (let now = 3100; now <= 8000; now += 100) {
    const motion = manualMotion(0, 0, 0, { ...REST_LEGS, leftLeg: now % 600 < 300 ? .25 : 0, rightLeg: now % 600 < 300 ? 0 : -.25 });
    state = advanceGuide(state, { ...motion, leftFootVisible: false, rightFootVisible: false }, now);
  }
  assert.equal(state.earned["legs-feet"], ACTIVITY_MS);
});
test("skip preserves only earned fades, progresses in order, and reset clears skips", () => {
  let state = { ...createGuide(), earned: { "neck-head": 1000, "arms-back": 0, "legs-feet": 0 } };
  state = skipGuide(state); assert.equal(state.index, 1); assert.deepEqual(state.skipped, ["neck-head"]);
  assert.equal(guideSnapshot(state).fades["neck-head"], .125);
  state = skipGuide(state); assert.equal(state.index, 2);
  state = skipGuide(state); assert.equal(state.done, true);
  assert.deepEqual(guideSnapshot(state).fades, { "neck-head": .125, "arms-back": 0, "legs-feet": 0 });
  assert.equal(skipGuide(state), state);
  assert.deepEqual(createGuide().skipped, []);
});
test("each authored loop demonstrates only its named movement with a gentle range", () => {
  const head = instructorMotion("neck-head", 1.5, "tilt");
  assert.ok(head.headTilt > .15 && head.headTilt <= .21); assert.equal(head.lean, 0);
  assert.equal(instructorMotion("arms-back", 3, "reach").lean, 0);
  const side = instructorMotion("arms-back", 1.5, "side-stretch");
  assert.ok(side.leftReaching && side.rightReaching); assert.ok(side.lean > .10 && side.lean < .16);
  const steps = instructorMotion("legs-feet", 1.5, "side-step");
  assert.ok(steps.leftLeg > 0 && steps.leftLeg < .3); assert.equal(steps.leftKnee, 0);
  const heels = instructorMotion("legs-feet", 3, "heel-raise");
  assert.equal(heels.leftLeg, 0); assert.ok(heels.leftHeel > .2);
});
