// Small raster correction, executed locally after alignment. No remote inference.
export const PAPER_COLOR = [250, 248, 243] as const;
const TILE = 48;
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
type Paper = [number, number, number];
function estimate(samples: Paper[], fallback: Paper): Paper {
  if (samples.length < 4) return fallback;
  samples.sort((a, b) => (a[0] + a[1] + a[2]) - (b[0] + b[1] + b[2]));
  return samples[Math.floor((samples.length - 1) * .85)];
}
export function cleanDrawingPixels(input: Uint8ClampedArray, width: number, height: number, strength = .75) {
  const out = new Uint8ClampedArray(input);
  strength = clamp(strength, 0, 1);
  if (!strength || !width || !height) return out;
  const cols = Math.ceil(width / TILE), rows = Math.ceil(height / TILE);
  const samples: Paper[][] = Array.from({ length: cols * rows }, () => []), all: Paper[] = [];
  // Neutral, brighter pixels are likely paper. Colored/dark strokes are excluded.
  for (let y = 0; y < height; y += 4) for (let x = 0; x < width; x += 4) {
    const i = (y * width + x) * 4, r = input[i], g = input[i + 1], b = input[i + 2];
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    if (max < 90 || max - min > 55 || input[i + 3] < 240) continue;
    const p: Paper = [r, g, b]; samples[Math.floor(y / TILE) * cols + Math.floor(x / TILE)].push(p); all.push(p);
  }
  const fallback = estimate(all, [...PAPER_COLOR]);
  const field = samples.map(s => estimate(s, fallback));
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const i = (y * width + x) * 4;
    if (Math.max(input[i], input[i + 1], input[i + 2]) < 55) continue; // Keep black outlines exact.
    const gx = clamp(x / TILE - .5, 0, cols - 1), gy = clamp(y / TILE - .5, 0, rows - 1);
    const x0 = Math.floor(gx), y0 = Math.floor(gy), x1 = Math.min(cols - 1, x0 + 1), y1 = Math.min(rows - 1, y0 + 1);
    const fx = gx - x0, fy = gy - y0;
    const p00 = field[y0 * cols + x0], p10 = field[y0 * cols + x1], p01 = field[y1 * cols + x0], p11 = field[y1 * cols + x1];
    const max = Math.max(input[i], input[i + 1], input[i + 2]), min = Math.min(input[i], input[i + 1], input[i + 2]);
    for (let c = 0; c < 3; c++) {
      const paper = (p00[c] * (1 - fx) + p10[c] * fx) * (1 - fy) + (p01[c] * (1 - fx) + p11[c] * fx) * fy;
      const gain = clamp(PAPER_COLOR[c] / Math.max(90, paper), .8, 1.8);
      // Don't alter already well-lit colored strokes just to change paper tone.
      if ((max - min) / max >= .17 && Math.abs(gain - 1) < .06) continue;
      const corrected = clamp(input[i + c] * gain, 0, 255);
      out[i + c] = Math.round(input[i + c] + (corrected - input[i + c]) * strength);
    }
  }
  return out;
}
export function cleanDrawingCanvas(canvas: HTMLCanvasElement, strength: number) {
  if (!strength) return;
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height);
  pixels.data.set(cleanDrawingPixels(pixels.data, canvas.width, canvas.height, strength));
  ctx.putImageData(pixels, 0, 0);
}
