import { test } from "node:test";
import assert from "node:assert/strict";
import { advanceGuide, createGuide, instructorMotion, guideSnapshot, ACTIVITY_MS, PART_MS, NEXT_ACTIVITY_MS, guideStep, skipGuide, type GuideState } from "../src/lib/guided";
import { AREA_IDS, coloredAreas, emptyFades, segmentArea, type BodyArea } from "../src/lib/body-areas";
import { manualMotion, REST, REST_LEGS, REST_HIPS, REST_HEAD, REST_FEET, type Motion } from "../src/lib/pose";
import { SEGMENTS } from "../src/lib/rig";

const neck = (angle: number) => manualMotion(0, 0, 0, REST_LEGS, REST_HIPS, { headTilt: angle });
const elbow = (left: number, right = 0) => manualMotion(0, 0, 0, REST_LEGS, REST_HIPS, REST_HEAD, REST_FEET, { leftElbow: left, rightElbow: right });
const legs = (left: number, right = 0) => manualMotion(0, 0, 0, { ...REST_LEGS, leftLeg: left, rightLeg: right });
function run(state: GuideState, motion: (i: number) => Motion, duration: number): GuideState {
  const start = state.lastTime === null ? 0 : state.lastTime + 100;
  for (let i = 0; i <= duration; i += 100) state = advanceGuide(state, motion(i), start + i);
  return state;
}
test("each qualifying region selects one ordered activity; uncolored and sub-threshold regions are omitted", () => {
  const areas = Object.fromEntries(AREA_IDS.map(id => [id, { coloredPixels: 0 }])) as Record<BodyArea, { coloredPixels: number }>;
  assert.deepEqual(coloredAreas(areas), []);
  for (const id of AREA_IDS) {
    areas[id].coloredPixels = 39; assert.deepEqual(coloredAreas(areas), []);
    areas[id].coloredPixels = 40; assert.deepEqual(createGuide(coloredAreas(areas)).areas, [id]);
    areas[id].coloredPixels = 0;
  }
  areas["left-forearm"].coloredPixels = 80; areas.torso.coloredPixels = 60;
  assert.deepEqual(coloredAreas(areas), ["torso", "left-forearm"]);
  assert.deepEqual(createGuide(["right-leg", "torso", "torso"]).areas, ["torso", "right-leg"]);
  for (const segment of Object.keys(SEGMENTS) as (keyof typeof SEGMENTS)[]) assert.ok(segmentArea(segment));
  const blank = run(createGuide(), () => neck(1), 5000);
  assert.equal(blank.done, false); assert.equal(guideSnapshot(blank).total, 0); assert.equal(skipGuide(blank).done, false);
});
test("instructor loops independently; idle and jitter earn no progress", () => {
  assert.notDeepEqual(instructorMotion("neck-head", 0), instructorMotion("neck-head", 1.5));
  const state = run(createGuide(["neck-head"]), i => neck(Math.sin(i) * .04), 12000);
  assert.equal(state.earned["neck-head"], 0);
});

test("a selected stretch completes after five earned seconds rather than the old eight", () => {
  let state = run(createGuide(["left-forearm"]), i => elbow(i % 400 ? .7 : .1), 4000);
  assert.ok(state.earned["left-forearm"] < ACTIVITY_MS);
  state = run(state, i => elbow(i % 400 ? .7 : .1), 1200);
  assert.equal(state.earned["left-forearm"], 5000);
  assert.notEqual(state.transition, null);
});
test("gentle neck movement fades only the head; rest retains earned progress", () => {
  let state = run(createGuide(["neck-head", "torso"]), i => neck(i % 600 < 300 ? -.3 : .3), 2000);
  assert.ok(state.earned["neck-head"] > 1000);
  assert.equal(state.earned.torso, 0);
  assert.equal(guideSnapshot(state).total, guideSnapshot(state).progress / 2);
  state = run(state, () => neck(.3), 1500); const earned = state.earned["neck-head"];
  state = run(state, () => neck(.3), 2000); assert.equal(state.earned["neck-head"], earned);
});
test("wrong region, missing points, pause, disabled and stale frames grant no credit", () => {
  let state = run(createGuide(["neck-head"]), i => manualMotion(i % 200 ? 1 : 0, 0), 1000);
  assert.equal(state.earned["neck-head"], 0);
  state = run(state, i => neck(i % 200 ? 1 : -1), 600); const earned = state.earned["neck-head"];
  state = advanceGuide(state, REST, 1800);
  state = advanceGuide(state, neck(-1), 5000);
  state = advanceGuide(state, neck(1), 5100, true, true);
  state = advanceGuide(state, neck(-1), 5200, false);
  assert.equal(state.earned["neck-head"], earned); assert.equal(state.anchor, null);
});
test("a forearm-only activity accepts only its elbow and never shoulder-only or opposite-side movement", () => {
  let state = run(createGuide(["left-forearm"]), i => manualMotion(i % 400 ? .8 : .5, 0), 2500);
  assert.equal(state.earned["left-forearm"], 0);
  state = run(state, i => elbow(0, i % 400 ? .7 : .1), 2500);
  assert.equal(state.earned["left-forearm"], 0);
  state = run(state, i => ({ ...elbow(i % 400 ? .7 : .1), leftVisible: false }), 2500);
  assert.equal(state.earned["left-forearm"], 0);
  state = run(state, i => elbow(i % 400 ? .7 : .1), 2000);
  assert.ok(state.earned["left-forearm"] > 1000);
  for (const id of AREA_IDS.filter(id => id !== "left-forearm")) assert.equal(state.earned[id], 0);
});
test("either upper-arm activity requires its own visible reaching arm", () => {
  for (const side of ["left", "right"] as const) {
    const area: BodyArea = `${side}-upper-arm`;
    let state = run(createGuide([area]), i => manualMotion(side === "right" ? .8 : 0, 0, side === "left" ? .8 : 0), 1500);
    assert.equal(state.earned[area], 0);
    state = run(state, i => manualMotion(side === "left" ? (i % 400 ? .8 : .5) : 0, 0, side === "right" ? (i % 400 ? .8 : .5) : 0), 1500);
    assert.ok(state.earned[area] > 500);
  }
});
test("torso movement needs both directions, ignores hip roll and does not require raised arms", () => {
  let state = run(createGuide(["torso"]), i => manualMotion(0, 0, 0, REST_LEGS, { hipTilt: i % 400 ? .8 : -.8 }), 1500);
  assert.equal(state.earned.torso, 0);
  state = run(state, i => manualMotion(0, i % 600 < 300 ? .5 : 0), 10000);
  assert.equal(state.earned.torso, ACTIVITY_MS - 100); assert.equal(state.transition, null);
  state = run(state, () => manualMotion(0, -.5), 200);
  assert.equal(state.earned.torso, ACTIVITY_MS); assert.ok(state.transition !== null && state.transition <= NEXT_ACTIVITY_MS);
});
test("legs spend one third on side steps and the remaining time on selected-side raises", () => {
  for (const side of ["left", "right"] as const) {
    const area = `${side}-leg` as BodyArea;
    const motion = (value: number) => side === "left" ? legs(value) : legs(0, -value);
    let state = run(createGuide([area]), i => side === "left" ? legs(0, i % 400 ? -.6 : 0) : legs(i % 400 ? .6 : 0), 1500);
    assert.equal(state.earned[area], 0);
    state = run(state, i => motion(i % 400 ? .25 : 0), 3000);
    assert.equal(state.earned[area], PART_MS); assert.equal(guideStep(state), "side-raise");
    state = run(state, i => motion(i % 400 ? .2 : 0), 1500);
    assert.equal(state.earned[area], PART_MS);
    state = run(state, i => ({ ...motion(i % 400 ? .6 : 0), leftFootVisible: false, rightFootVisible: false }), 3000);
    assert.ok(state.earned[area] > PART_MS * 2); assert.equal(guideStep(state), "side-raise");
    state = run(state, i => ({ ...motion(i % 400 ? .6 : 0), [`${side}LegVisible`]: false }), 1000);
    const earned = state.earned[area];
    state = run(state, i => ({ ...motion(i % 400 ? .6 : 0), [`${side}LegVisible`]: false }), 1000);
    assert.equal(state.earned[area], earned);
    state = run(state, i => motion(i % 400 ? .6 : 0), 4000);
    assert.equal(state.earned[area], ACTIVITY_MS);
  }
});

test("partial skips retain fades, advance only selected regions and finish after the final skip", () => {
  let state = createGuide(["left-forearm", "right-leg"]); state.earned["left-forearm"] = 1000;
  state = skipGuide(state);
  assert.equal(guideSnapshot(state).area, "right-leg"); assert.equal(guideSnapshot(state).total, 1000 / ACTIVITY_MS / 2);
  state = skipGuide(state);
  assert.equal(state.done, true); assert.deepEqual(state.skipped, ["left-forearm", "right-leg"]);
  assert.equal(state.earned["left-forearm"], 1000); assert.equal(state.earned["right-leg"], 0);
});
test("completion transitions work for single-region and eight-region sequences; totals reflect performed movement", () => {
  for (const areas of [["neck-head"] as BodyArea[], AREA_IDS]) {
    let state = createGuide(areas);
    for (const id of areas) {
      state.earned[id] = ACTIVITY_MS; state.transition = NEXT_ACTIVITY_MS;
      state = run(state, () => REST, NEXT_ACTIVITY_MS);
    }
    assert.equal(state.done, true); assert.equal(guideSnapshot(state).total, 1);
    assert.deepEqual(createGuide(areas).earned, emptyFades());
  }
});
test("instructor moves only the selected arm/leg and demonstrates elbows and hands-on-hips separately", () => {
  const reach = instructorMotion("left-upper-arm", 3);
  assert.ok(reach.leftArm > 1); assert.equal(Math.abs(reach.rightArm), 0); assert.equal(Math.abs(reach.leftElbow), 0);
  const bend = instructorMotion("right-forearm", 3);
  assert.ok(bend.rightElbow > 1); assert.equal(Math.abs(bend.leftElbow), 0); assert.equal(Math.abs(bend.rightArm), 0);
  const torso = instructorMotion("torso", 1.5);
  assert.ok(torso.lean > 0); assert.equal(torso.leftReaching, false);
  const leg = instructorMotion("right-leg", 3, "side-raise");
  assert.equal(leg.leftLeg, 0); assert.ok(leg.rightLeg < -.28);
});
