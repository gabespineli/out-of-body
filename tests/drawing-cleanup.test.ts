import test from "node:test";
import assert from "node:assert/strict";
import { cleanDrawingPixels, PAPER_COLOR } from "../src/lib/drawing-cleanup";
import { participantName, permanentMobileUrl } from "../src/lib/queue";
function image(width: number, height: number, color: (x: number) => number[]) {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) data.set([...color(x), 255], (y * width + x) * 4);
  return data;
}
test("paper lighting and a warm cast normalize toward the same fade color", () => {
  const raw = image(192, 96, () => [195, 180, 160]);
  const black = (40 * 192 + 50) * 4; raw.set([34, 34, 34, 255], black);
  const corrected = cleanDrawingPixels(raw, 192, 96, 1);
  assert.deepEqual([...corrected.slice(0, 4)], [...PAPER_COLOR, 255]);
  assert.deepEqual([...corrected.slice(black, black + 4)], [34, 34, 34, 255]);
  assert.deepEqual([...raw.slice(0, 4)], [195, 180, 160, 255]);
});
test("gradual shadows are reduced without turning a neutral pencil mark into paper", () => {
  const raw = image(192, 96, x => { const shade = Math.round(140 + x * .4); return [shade, shade, shade]; });
  const pencil = (40 * 192 + 90) * 4; raw.set([80, 80, 80, 255], pencil);
  const corrected = cleanDrawingPixels(raw, 192, 96, 1);
  const left = corrected[(40 * 192 + 30) * 4], right = corrected[(40 * 192 + 160) * 4];
  assert.ok(Math.abs(right - left) < 25); assert.ok(left > raw[(40 * 192 + 30) * 4]);
  assert.ok(corrected[pencil] < 150);
});
test("well-lit colorful marks remain exact, and cleanup off preserves every byte", () => {
  const raw = image(96, 96, () => [...PAPER_COLOR]); const mark = (40 * 96 + 40) * 4; raw.set([39, 154, 163, 255], mark);
  assert.deepEqual([...cleanDrawingPixels(raw, 96, 96, .75).slice(mark, mark + 4)], [39, 154, 163, 255]);
  assert.deepEqual(cleanDrawingPixels(raw, 96, 96, 0), raw);
});
test("fully colorful artwork without paper samples remains finite and retains its marks", () => {
  const raw = image(96, 96, () => [39, 154, 163]); assert.deepEqual(cleanDrawingPixels(raw, 96, 96, 1), raw);
});
test("names stay optional, have a bounded length and strip invisible control characters", () => {
  assert.equal(participantName("  Alex\n  Lee\u200b "), "Alex Lee"); assert.equal(participantName(""), "");
  assert.throws(() => participantName("a".repeat(41))); assert.throws(() => participantName(null));
  assert.equal(permanentMobileUrl("https://example.com/some-old-path"), "https://example.com/mobile");
});
