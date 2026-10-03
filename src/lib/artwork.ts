import { WIDTH, HEIGHT, SEGMENTS, type Region } from "./rig";
export type Alignment = { scale: number; x: number; y: number; rotation: number };
export const DEFAULT_ALIGNMENT: Alignment = { scale: 1, x: 0, y: 0, rotation: 0 };
export type Artwork = { original: HTMLCanvasElement; fadeOverlay: HTMLCanvasElement; coloredPixels: number; regionPixels: number[]; name: string };

export function canvas(width = WIDTH, height = HEIGHT) {
  const element = document.createElement("canvas");
  element.width = width; element.height = height;
  return element;
}

export function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("This image could not be opened. Try a JPG, PNG or WebP photo."));
    image.src = url;
  });
}

export function normalizePhoto(image: HTMLImageElement, alignment: Alignment) {
  const output = canvas();
  const ctx = output.getContext("2d", { willReadFrequently: true })!;
  ctx.fillStyle = "#faf8f3"; ctx.fillRect(0, 0, WIDTH, HEIGHT);
  const scale = Math.min(WIDTH / image.naturalWidth, HEIGHT / image.naturalHeight) * alignment.scale;
  ctx.save();
  ctx.translate(WIDTH / 2 + alignment.x, HEIGHT / 2 + alignment.y);
  ctx.rotate(alignment.rotation * Math.PI / 180);
  ctx.drawImage(image, -image.naturalWidth * scale / 2, -image.naturalHeight * scale / 2, image.naturalWidth * scale, image.naturalHeight * scale);
  ctx.restore();
  return output;
}

export function buildArtwork(original: HTMLCanvasElement, regions: Region[], name: string): Artwork {
  const fadeOverlay = canvas();
  const ctx = original.getContext("2d", { willReadFrequently: true })!;
  const pixels = ctx.getImageData(0, 0, WIDTH, HEIGHT);
  const overlay = fadeOverlay.getContext("2d")!;
  const out = overlay.createImageData(WIDTH, HEIGHT);
  const paths = Object.values(SEGMENTS).map(d => new Path2D(d));
  let coloredPixels = 0;
  const regionPixels = regions.map(() => 0);
  const counted = new Uint8Array(WIDTH * HEIGHT);
  for (const [index, { x, y, radius }] of regions.entries()) {
    for (let py = Math.max(0, Math.floor(y - radius)); py < Math.min(HEIGHT, y + radius); py++) {
      for (let px = Math.max(0, Math.floor(x - radius)); px < Math.min(WIDTH, x + radius); px++) {
        const distance = Math.hypot(px - x, py - y) / radius;
        if (distance >= 1 || !paths.some(path => ctx.isPointInPath(path, px, py))) continue;
        const i = (py * WIDTH + px) * 4;
        const r = pixels.data[i], g = pixels.data[i + 1], b = pixels.data[i + 2];
        const max = Math.max(r, g, b), min = Math.min(r, g, b);
        const saturation = max ? (max - min) / max : 0;
        // A color threshold is a visual mask, never art recognition or a diagnosis.
        if (saturation < .17 || max < 55) continue;
        const feather = Math.min(1, (1 - distance) / .2);
        out.data[i] = 250; out.data[i + 1] = 248; out.data[i + 2] = 243;
        // Combine overlapping circles without multiplying their fade strength.
        if (!counted[i / 4]) { coloredPixels++; counted[i / 4] = 1; }
        out.data[i + 3] = Math.max(out.data[i + 3], Math.round(255 * feather));
        regionPixels[index]++;
      }
    }
  }
  overlay.putImageData(out, 0, 0);
  return { original, fadeOverlay, coloredPixels, regionPixels, name };
}

export function regionHasBody(point: { x: number; y: number }) {
  const ctx = canvas(1, 1).getContext("2d")!;
  return Object.values(SEGMENTS).some(d => ctx.isPointInPath(new Path2D(d), point.x, point.y));
}
