import { test } from "node:test";
import assert from "node:assert/strict";
import { drawingRegionPixels } from "../src/lib/drawing-regions";
import { cleanDrawingPixels } from "../src/lib/drawing-cleanup";

function sheet(width = 100, height = 100) {
  const pixels = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < pixels.length; i += 4) pixels.set([250, 248, 243, 255], i);
  const owners = new Uint8Array(width * height).fill(1);
  const mark = (x: number, y: number, color = [39, 154, 163, 255]) => pixels.set(color, (y * width + x) * 4);
  return { pixels, owners, mark, width, height };
}
const detect = (s: ReturnType<typeof sheet>) => drawingRegionPixels(s.pixels, s.owners, s.width, s.height);

test("40 connected colored pixels select a region; scattered speckles and neutral paper do not", () => {
  const s = sheet();
  assert.equal(detect(s).some(Boolean), false);
  for (let i = 0; i < 60; i++) s.mark(5 + i % 10 * 9, 5 + Math.floor(i / 10) * 12);
  assert.equal(detect(s).some(Boolean), false);
  for (let x = 20; x < 59; x++) s.mark(x, 70);
  assert.equal(detect(s).some(Boolean), false);
  s.mark(59, 70);
  assert.equal(detect(s).filter(Boolean).length, 40);
});

test("boundary-spanning marks need enough connected color in each distinct region", () => {
  const s = sheet();
  for (let y = 0; y < s.height; y++) for (let x = 50; x < s.width; x++) s.owners[y * s.width + x] = 2;
  for (let y = 20; y < 28; y++) for (let x = 45; x < 55; x++) s.mark(x, y);
  const result = detect(s);
  assert.equal(result.filter(id => id === 1).length, 40);
  assert.equal(result.filter(id => id === 2).length, 40);
  for (let y = 20; y < 28; y++) s.mark(54, y, [250, 248, 243, 255]);
  assert.equal(detect(s).filter(id => id === 1).length, 40);
  assert.equal(detect(s).filter(id => id === 2).length, 0);
});

test("diagonal strokes remain connected; row edges, transparency and outside marks cannot add regions", () => {
  const s = sheet();
  for (let i = 0; i < 40; i++) s.mark(20 + i, 20 + i);
  assert.equal(detect(s).filter(Boolean).length, 40);
  for (let i = 0; i < s.owners.length; i++) s.owners[i] = 0;
  assert.equal(detect(s).some(Boolean), false);
  const transparent = sheet();
  for (let x = 10; x < 70; x++) transparent.mark(x, 20, [39, 154, 163, 0]);
  assert.equal(detect(transparent).some(Boolean), false);
  const wrapped = sheet(10, 100);
  for (let y = 0; y < 40; y += 2) { wrapped.mark(9, y); wrapped.mark(0, y + 1); }
  assert.equal(detect(wrapped).some(Boolean), false);
});

test("the phone's paper cleanup prevents a warm blank sheet from selecting unrelated regions", () => {
  const s = sheet();
  for (let y = 0; y < s.height; y++) for (let x = 0; x < s.width; x++) s.mark(x, y, [195, 180, 160, 255]);
  s.pixels = cleanDrawingPixels(s.pixels, s.width, s.height, .75);
  assert.equal(detect(s).some(Boolean), false);
});
