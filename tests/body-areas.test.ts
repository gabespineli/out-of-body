import { test } from "node:test";
import assert from "node:assert/strict";
import { motionFromLandmarks, manualMotion, matchesBodyStretch, REST_LEGS, REST_HIPS, REST_HEAD, type Landmark } from "../src/lib/pose";
import { advanceAreaHolds, createAreaHolds, resetUnfinished } from "../src/lib/area-holds";

function standing(): Landmark[] {
  const p = Array.from({ length: 33 }, () => ({ x: .5, y: .5, visibility: .99, presence: .99 }));
  for (const [i, x, y] of [[7, .55, .15], [8, .45, .15], [11, .6, .3], [12, .4, .3], [13, .65, .5], [14, .35, .5], [15, .7, .7], [16, .3, .7], [23, .56, .65], [24, .44, .65], [25, .562, .8], [26, .438, .8], [27, .558, .95], [28, .442, .95]]) p[i] = { ...p[i], x, y };
  return p;
}

test("a head tilt works on either side relative to shoulders; body roll alone does not count", () => {
  const p = standing();
  assert.equal(matchesBodyStretch(motionFromLandmarks(p), "neck-head"), false);
  p[8].y += .04;
  assert.equal(matchesBodyStretch(motionFromLandmarks(p), "neck-head"), true);
  p[8].y -= .08;
  assert.equal(matchesBodyStretch(motionFromLandmarks(p), "neck-head"), true);
  const rolled = standing();
  // Equal slopes in aspect-corrected ear and shoulder lines cancel out.
  rolled[8].y += .04; rolled[12].y += .08;
  const motion = motionFromLandmarks(rolled);
  assert.ok(Math.abs(motion.headTilt) < 1e-10);
  assert.equal(matchesBodyStretch(motion, "neck-head"), false);
});

test("head tilt tolerates small jitter but resets for level, missing or collapsed ears", () => {
  const p = standing(); p[8].y += .04;
  const held = motionFromLandmarks(p);
  p[8].y = p[7].y + .024;
  assert.equal(motionFromLandmarks(p).headTilted, false);
  assert.equal(motionFromLandmarks(p, 4 / 3, held).headTilted, true);
  p[8].y = p[7].y + .01;
  assert.equal(motionFromLandmarks(p, 4 / 3, held).headTilted, false);
  p[8].y = p[7].y + .04; p[7].visibility = .1;
  assert.equal(motionFromLandmarks(p, 4 / 3, held).headVisible, false);
  p[7].visibility = .99; p[8].x = p[7].x;
  assert.equal(motionFromLandmarks(p).headVisible, false);
});

test("each area requires its own pose and confidence; a missing head does not block raised arms", () => {
  const p = standing(); p[7].visibility = .1;
  p[15].y = .05; p[16].y = .05; p[13].y = .18; p[14].y = .18;
  const arms = motionFromLandmarks(p);
  assert.equal(matchesBodyStretch(arms, "arms-back"), true);
  assert.equal(matchesBodyStretch(arms, "neck-head"), false);
  assert.equal(matchesBodyStretch(arms, "legs-feet"), false);
  p[16].presence = .1;
  assert.equal(matchesBodyStretch(motionFromLandmarks(p), "arms-back"), false);
  const legs = standing(); legs[25].x = .68;
  assert.equal(matchesBodyStretch(motionFromLandmarks(legs), "legs-feet"), true);
  legs[27].visibility = .1;
  assert.equal(matchesBodyStretch(motionFromLandmarks(legs), "legs-feet"), false);
});

test("manual head and either leg use the same area matcher; hip rotation alone earns nothing", () => {
  for (const headTilt of [-1, 1]) {
    const motion = manualMotion(0, 0, 0, REST_LEGS, REST_HIPS, { headTilt });
    assert.equal(matchesBodyStretch(motion, "neck-head"), true);
    assert.equal(matchesBodyStretch(motion, "arms-back"), false);
    assert.equal(matchesBodyStretch(motion, "legs-feet"), false);
  }
  for (const legs of [{ ...REST_LEGS, leftLeg: 1 }, { ...REST_LEGS, rightLeg: -1 }])
    assert.equal(matchesBodyStretch(manualMotion(0, 0, 0, legs), "legs-feet"), true);
  const hips = manualMotion(0, 0, 0, REST_LEGS, { hipTilt: 1 }, REST_HEAD);
  for (const area of ["neck-head", "arms-back", "legs-feet"] as const) assert.equal(matchesBodyStretch(hips, area), false);
});

test("switching areas discards unfinished time; an earned fade continues independently", () => {
  const timing = { holdMs: 2000, fadeMs: 1000 };
  let states = createAreaHolds();
  for (let now = 0; now <= 1500; now += 100) states = advanceAreaHolds(states, "arms-back", true, now, timing);
  assert.equal(states["arms-back"].elapsed, 1500);
  states = resetUnfinished(states);
  states = advanceAreaHolds(states, "neck-head", false, 1600, timing);
  assert.equal(states["arms-back"].elapsed, 0);
  for (let now = 1700; now <= 3600; now += 100) states = advanceAreaHolds(states, "neck-head", true, now, timing);
  assert.equal(states["neck-head"].complete, true);
  states = resetUnfinished(states);
  for (let now = 3700; now <= 4600; now += 100) states = advanceAreaHolds(states, "legs-feet", true, now, timing);
  assert.ok(states["neck-head"].fade > .9999);
  assert.equal(states["legs-feet"].complete, false);
  assert.equal(states["arms-back"].fade, 0);
});

test("pause freezes earned fades and resets partial holds across all areas; restore clears all", () => {
  let states = createAreaHolds();
  states["neck-head"] = { elapsed: 3000, lastTime: 1000, complete: true, fade: .4 };
  states["legs-feet"] = { elapsed: 1500, lastTime: 1000, complete: false, fade: 0 };
  for (let now = 1100; now <= 4000; now += 100) states = advanceAreaHolds(states, "legs-feet", true, now, undefined, true);
  assert.equal(states["neck-head"].fade, .4);
  assert.equal(states["legs-feet"].elapsed, 0);
  states = advanceAreaHolds(states, "legs-feet", false, 4100);
  assert.equal(states["neck-head"].fade, .4625);
  const restored = createAreaHolds();
  for (const value of Object.values(restored)) assert.deepEqual(value, { elapsed: 0, lastTime: null, complete: false, fade: 0 });
});
