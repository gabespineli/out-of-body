import { COLOR_PIXEL_MIN } from "./body-areas";

/** Keep the existing saturation classifier, then reject disconnected photo noise. */
export function drawingRegionPixels(pixels: Uint8ClampedArray, owners: Uint8Array, width: number, height: number) {
  const candidates = new Uint8Array(width * height);
  for (let p = 0; p < candidates.length; p++) {
    const i = p * 4;
    if (!owners[p] || pixels[i + 3] < 128) continue;
    const max = Math.max(pixels[i], pixels[i + 1], pixels[i + 2]);
    const min = Math.min(pixels[i], pixels[i + 1], pixels[i + 2]);
    if (max >= 55 && (max - min) / max >= .17) candidates[p] = owners[p];
  }
  const accepted = new Uint8Array(candidates.length);
  const queue = new Int32Array(candidates.length);
  for (let p = 0; p < candidates.length; p++) {
    const owner = candidates[p];
    if (!owner) continue;
    let head = 0, tail = 1;
    queue[0] = p; candidates[p] = 0;
    while (head < tail) {
      const point = queue[head++], x = point % width, y = Math.floor(point / width);
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
        const neighbor = ny * width + nx;
        if (candidates[neighbor] !== owner) continue;
        candidates[neighbor] = 0; queue[tail++] = neighbor;
      }
    }
    // Each region needs its own connected mark; pixels cannot count twice at a joint.
    if (tail >= COLOR_PIXEL_MIN) for (let q = 0; q < tail; q++) accepted[queue[q]] = owner;
  }
  return accepted;
}
