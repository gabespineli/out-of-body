import { WIDTH, HEIGHT, SEGMENTS } from "./rig";
import { BODY_AREAS, type BodyArea } from "./body-areas";
export type Alignment = { scale: number; x: number; y: number; rotation: number };
export const DEFAULT_ALIGNMENT: Alignment = { scale: 1, x: 0, y: 0, rotation: 0 };
export type AreaMask = { fadeOverlay: HTMLCanvasElement; coloredPixels: number };
export type Artwork = { original: HTMLCanvasElement; areas: Record<BodyArea, AreaMask>; name: string };

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
  drawAlignedPhoto(ctx, image, alignment);
  return output;
}

// Preview and export share the same transform; reuse the preview canvas during gestures.
export function drawAlignedPhoto(ctx: CanvasRenderingContext2D, image: HTMLImageElement, alignment: Alignment) {
  ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = "#faf8f3"; ctx.fillRect(0, 0, WIDTH, HEIGHT);
  const scale = Math.min(WIDTH / image.naturalWidth, HEIGHT / image.naturalHeight) * alignment.scale;
  ctx.translate(WIDTH / 2 + alignment.x, HEIGHT / 2 + alignment.y);
  ctx.rotate(alignment.rotation * Math.PI / 180);
  ctx.drawImage(image, -image.naturalWidth * scale / 2, -image.naturalHeight * scale / 2, image.naturalWidth * scale, image.naturalHeight * scale);
  ctx.restore();
}

let shapes: Record<BodyArea, Uint8ClampedArray> | undefined;
function areaShapes() {
  if (!shapes) shapes = Object.fromEntries(BODY_AREAS.map(area => {
    const mask = canvas(), ctx = mask.getContext("2d", { willReadFrequently: true })!;
    ctx.fillStyle = "white";
    for (const key of area.segments) ctx.fill(new Path2D(SEGMENTS[key]));
    return [area.id, ctx.getImageData(0, 0, WIDTH, HEIGHT).data];
  })) as Record<BodyArea, Uint8ClampedArray>;
  return shapes;
}

// Fixed template masks select pixels; saturated color is never a diagnosis or art recognition.
export function buildArtwork(original: HTMLCanvasElement, name: string): Artwork {
  const pixels = original.getContext("2d", { willReadFrequently: true })!.getImageData(0, 0, WIDTH, HEIGHT).data;
  const masks = areaShapes();
  const areas = Object.fromEntries(BODY_AREAS.map(area => {
    const fadeOverlay = canvas(), ctx = fadeOverlay.getContext("2d")!;
    const out = ctx.createImageData(WIDTH, HEIGHT);
    let coloredPixels = 0;
    for (let i = 0; i < pixels.length; i += 4) {
      const alpha = masks[area.id][i + 3];
      if (!alpha) continue;
      const max = Math.max(pixels[i], pixels[i + 1], pixels[i + 2]), min = Math.min(pixels[i], pixels[i + 1], pixels[i + 2]);
      if (max < 55 || (max - min) / max < .17) continue;
      out.data[i] = 250; out.data[i + 1] = 248; out.data[i + 2] = 243; out.data[i + 3] = alpha;
      coloredPixels++;
    }
    ctx.putImageData(out, 0, 0);
    return [area.id, { fadeOverlay, coloredPixels }];
  })) as Record<BodyArea, AreaMask>;
  return { original, areas, name };
}
