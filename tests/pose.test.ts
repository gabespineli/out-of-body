import { test } from "node:test";
import assert from "node:assert/strict";
import { motionFromLandmarks, advanceHold, EMPTY_HOLD, manualMotion, matchesGesture, HOLD_MS, REST_LEGS, REST_HIPS, type Landmark, type HoldState } from "../src/lib/pose";

function standing(): Landmark[] {
  const p = Array.from({ length: 33 }, () => ({ x: .5, y: .5, visibility: .99, presence: .99 }));
  p[11] = { ...p[11], x: .6, y: .3 }; p[12] = { ...p[12], x: .4, y: .3 };
  p[13] = { ...p[13], x: .65, y: .5 }; p[14] = { ...p[14], x: .35, y: .5 };
  p[15] = { ...p[15], x: .7, y: .7 }; p[16] = { ...p[16], x: .3, y: .7 };
  p[23] = { ...p[23], x: .56, y: .65 }; p[24] = { ...p[24], x: .44, y: .65 };
  p[25] = { ...p[25], x: .562, y: .8 }; p[26] = { ...p[26], x: .438, y: .8 };
  p[27] = { ...p[27], x: .558, y: .95 }; p[28] = { ...p[28], x: .442, y: .95 };
  return p;
}

test("confident raised wrists and elbows detect a two-arm hold", () => {
  const p = standing();
  assert.equal(motionFromLandmarks(p).raised, false);
  p[15].y = .05; p[16].y = .05; p[13].y = .18; p[14].y = .18;
  const motion = motionFromLandmarks(p);
  assert.equal(motion.raised, true); assert.equal(motion.tracked, true);
  assert.ok(motion.leftArm > 1); assert.ok(motion.rightArm < -1);
  p[15].visibility = .2;
  assert.equal(motionFromLandmarks(p).raised, false);
});

test("shoulder-to-hip lean detects both sides and requires visible hips", () => {
  const p = standing();
  p[11].x += .1; p[12].x += .1;
  assert.equal(motionFromLandmarks(p).leaning, true);
  assert.ok(motionFromLandmarks(p).lean < -.2);
  p[11].x -= .2; p[12].x -= .2;
  assert.ok(motionFromLandmarks(p).lean > .2);
  p[23].visibility = .2;
  assert.equal(motionFromLandmarks(p).leaning, false);
});

test("raised-arm jitter tolerance preserves a valid hold but lowered or missing hands release it", () => {
  const p = standing();
  p[15].y = .21; p[16].y = .21; p[13].y = .32; p[14].y = .32;
  const raised = motionFromLandmarks(p);
  assert.equal(raised.raised, true);
  p[15].y = .24; p[16].y = .24;
  assert.equal(motionFromLandmarks(p).raised, false);
  assert.equal(motionFromLandmarks(p, 4 / 3, raised).raised, true);
  p[16].y = .27;
  assert.equal(motionFromLandmarks(p, 4 / 3, raised).raised, false);
  p[16].y = .21; p[15].presence = .2;
  assert.equal(motionFromLandmarks(p, 4 / 3, raised).raised, false);
});

test("a confident upper-body stretch works without visible hips or legs and loss restarts its hold", () => {
  const p = standing();
  p[15].y = .05; p[16].y = .05; p[13].y = .18; p[14].y = .18;
  for (const i of [23, 24, 25, 26, 27, 28]) p[i].visibility = .1;
  let motion = motionFromLandmarks(p), hold = { ...EMPTY_HOLD };
  assert.equal(motion.raised, true);
  for (let now = 0; now <= 2000; now += 100) hold = advanceHold(hold, motion.raised, now);
  p[16].visibility = .1;
  motion = motionFromLandmarks(p, 4 / 3, motion);
  hold = advanceHold(hold, motion.raised, 2100);
  assert.equal(hold.elapsed, 0); assert.equal(hold.complete, false);
  p[16].visibility = .99;
  motion = motionFromLandmarks(p, 4 / 3, motion);
  for (let now = 2200; now <= 5100; now += 100) hold = advanceHold(hold, motion.raised, now);
  assert.equal(hold.complete, true);
});

test("no person or low-confidence shoulders cannot trigger symbolic progress", () => {
  assert.equal(motionFromLandmarks([]).tracked, false);
  const p = standing(); p[11].visibility = .1;
  assert.equal(motionFromLandmarks(p).tracked, false);
});

test("hold completes only after continuous three seconds and interruption resets", () => {
  let hold = advanceHold({ ...EMPTY_HOLD }, false, 0);
  for (let now = 100; now <= 2500; now += 100) hold = advanceHold(hold, true, now);
  assert.equal(hold.complete, false); assert.equal(hold.elapsed, 2500);
  hold = advanceHold(hold, false, 2600);
  assert.equal(hold.elapsed, 0);
  for (let now = 2700; now <= 5600; now += 100) hold = advanceHold(hold, true, now);
  assert.equal(hold.elapsed, HOLD_MS); assert.equal(hold.complete, true); assert.equal(hold.fade, 0);
  for (let now = 5700; now <= 7200; now += 100) hold = advanceHold(hold, false, now);
  assert.equal(hold.fade, 1);
});

test("a suspended tab or missing frame gap does not count as held pose", () => {
  let hold = advanceHold({ ...EMPTY_HOLD }, true, 0);
  hold = advanceHold(hold, true, 100); hold = advanceHold(hold, true, 4100);
  assert.equal(hold.complete, false); assert.equal(hold.elapsed, 0);
});

test("manual controls map to the same gestures and visibly different joint angles", () => {
  assert.equal(manualMotion(0, 0).raised, false);
  assert.equal(manualMotion(1, 0).raised, true);
  assert.ok(manualMotion(1, 0).leftArm > 2);
  assert.equal(manualMotion(0, -1).leaning, true);
  assert.equal(manualMotion(0, 1).leaning, true);
});

test("one raised arm works independently and a hidden wrist cannot complete its gesture", () => {
  const p = standing(); p[15].y = .05; p[13].y = .18;
  let motion = motionFromLandmarks(p);
  assert.equal(matchesGesture(motion, "left-arm"), true);
  assert.equal(matchesGesture(motion, "right-arm"), false);
  assert.equal(matchesGesture(motion, "raise"), false);
  p[15].visibility = .2; motion = motionFromLandmarks(p);
  assert.equal(motion.leftVisible, false);
  assert.equal(matchesGesture(motion, "left-arm"), false);
  p[16].y = .05; p[14].y = .18;
  assert.equal(matchesGesture(motionFromLandmarks(p), "right-arm"), true);
});

test("directional lean rejects the opposite side and missing hips", () => {
  const p = standing(); p[11].x += .1; p[12].x += .1;
  assert.equal(matchesGesture(motionFromLandmarks(p), "lean-left"), true);
  assert.equal(matchesGesture(motionFromLandmarks(p), "lean-right"), false);
  p[11].x -= .2; p[12].x -= .2;
  assert.equal(matchesGesture(motionFromLandmarks(p), "lean-right"), true);
  p[24].visibility = .1;
  assert.equal(matchesGesture(motionFromLandmarks(p), "lean-right"), false);
});

test("custom timing requires the chosen hold and controls the fade speed", () => {
  const timing = { holdMs: 1500, fadeMs: 500 };
  let hold = advanceHold({ ...EMPTY_HOLD }, true, 0, timing);
  for (let now = 100; now <= 1400; now += 100) hold = advanceHold(hold, true, now, timing);
  assert.equal(hold.complete, false);
  hold = advanceHold(hold, true, 1500, timing);
  assert.equal(hold.complete, true);
  hold = advanceHold(hold, false, 1600, timing);
  assert.equal(hold.fade, .2);
  for (let now = 1700; now <= 2000; now += 100) hold = advanceHold(hold, false, now, timing);
  assert.equal(hold.fade, 1);
});

test("pause restarts an unfinished hold and freezes an earned fade without catching up", () => {
  let hold: HoldState = { elapsed: 2000, lastTime: 2000, complete: false, fade: 0 };
  hold = advanceHold(hold, true, 2100, undefined, true);
  assert.equal(hold.elapsed, 0);
  assert.equal(advanceHold(hold, true, 8000).complete, false);
  hold = { elapsed: HOLD_MS, lastTime: 2000, complete: true, fade: .25 };
  for (let now = 2100; now <= 5000; now += 100) hold = advanceHold(hold, true, now, undefined, true);
  assert.equal(hold.fade, .25);
  assert.equal(advanceHold(hold, false, 5100).fade, .3125);
});

test("hips, knees and ankles move each leg and detect the outward side independently", () => {
  const p = standing();
  assert.equal(matchesGesture(motionFromLandmarks(p), "left-leg"), false);
  assert.equal(matchesGesture(motionFromLandmarks(p), "right-leg"), false);
  p[25].x = .68; p[25].y = .78; p[27].x = .67;
  let motion = motionFromLandmarks(p);
  assert.ok(motion.leftLeg > .5); assert.ok(motion.leftKnee < -.5);
  assert.ok(Math.abs(motion.rightLeg) < .03);
  assert.equal(matchesGesture(motion, "left-leg"), true);
  assert.equal(matchesGesture(motion, "right-leg"), false);
  p[26].x = .3; p[26].y = .78; p[28].x = .34;
  motion = motionFromLandmarks(p);
  assert.ok(motion.rightLeg < -.5); assert.ok(motion.rightKnee > .5);
  assert.equal(matchesGesture(motion, "right-leg"), true);
});

test("a missing ankle resets only its leg and cannot earn a leg hold", () => {
  const p = standing(); p[25].x = .68; p[26].x = .3;
  p[15].y = .05; p[13].y = .18; p[27].visibility = .2;
  const motion = motionFromLandmarks(p);
  assert.equal(motion.leftLegVisible, false); assert.equal(motion.leftLeg, 0); assert.equal(motion.leftKnee, 0);
  assert.equal(matchesGesture(motion, "left-leg"), false);
  assert.equal(motion.rightLegVisible, true); assert.equal(matchesGesture(motion, "right-leg"), true);
  assert.equal(matchesGesture(motion, "left-arm"), true);
  p[25].visibility = .99; p[27].visibility = .99; p[27].x = p[25].x; p[27].y = p[25].y;
  assert.equal(motionFromLandmarks(p).leftLegVisible, false);
});

test("manual legs swing independently and knees bend without changing the arms", () => {
  const left = manualMotion(0, 0, 0, { ...REST_LEGS, leftLeg: 1, leftKnee: .5 });
  assert.equal(matchesGesture(left, "left-leg"), true); assert.equal(matchesGesture(left, "right-leg"), false);
  assert.equal(left.leftArm, 0); assert.equal(left.rightLeg, 0); assert.equal(left.leftKnee, .45);
  const right = manualMotion(0, 0, 0, { ...REST_LEGS, rightLeg: -1, rightKnee: .5 });
  assert.equal(matchesGesture(right, "right-leg"), true); assert.equal(right.rightKnee, -.45);
  assert.equal(matchesGesture(manualMotion(0, 0, 0, { ...REST_LEGS, leftLeg: -1 }), "left-leg"), false);
});

test("camera position changes leave joint angles unchanged while the hip line rotates", () => {
  const p = standing();
  const rest = motionFromLandmarks(p);
  assert.equal(rest.hipTilt, 0);
  for (const point of p) { point.x += .06; point.y += .04; }
  const shifted = motionFromLandmarks(p);
  for (const key of Object.keys(rest) as (keyof typeof rest)[]) {
    const a = rest[key], b = shifted[key];
    if (typeof a === "number" && typeof b === "number") assert.ok(Math.abs(a - b) < 1e-10, key);
    else assert.equal(a, b, key);
  }
  p[24].y += .04;
  const tilted = motionFromLandmarks(p);
  assert.ok(tilted.hipTilt > .2);
  p[23].visibility = .1;
  const lost = motionFromLandmarks(p);
  assert.equal(lost.hipTilt, 0);
  assert.equal(lost.tracked, true);
});

test("hip rotation is bounded and a tilt alone cannot count as a leg lift", () => {
  const p = standing();
  p[24].y += .5;
  assert.equal(motionFromLandmarks(p).hipTilt, .35);
  p[24].y -= 1;
  assert.equal(motionFromLandmarks(p).hipTilt, -.35);
  const manual = manualMotion(0, 0, 0, REST_LEGS, { ...REST_HIPS, hipTilt: 1 });
  assert.equal(manual.hipTilt, .35);
  assert.equal(manual.leftLeg, manual.hipTilt); assert.equal(manual.rightLeg, manual.hipTilt);
  assert.equal(matchesGesture(manual, "left-leg"), false); assert.equal(matchesGesture(manual, "right-leg"), false);
});
