import { WIDTH, JOINTS, SEGMENTS } from "./rig";
import { canvas, type Artwork } from "./artwork";
import type { Motion } from "./pose";
import { AREA_IDS, segmentArea, type AreaFades, type BodyArea } from "./body-areas";

type SegmentKey = keyof typeof SEGMENTS;
let cachedPaths: Record<SegmentKey, Path2D> | undefined;
const fadedTextures = new WeakMap<Artwork, { texture: HTMLCanvasElement; signature: string }>();
function fadedTexture(art: Artwork, fades: AreaFades, strength: number) {
  const signature = `${strength}:${AREA_IDS.map(id => fades[id]).join(",")}`;
  let cached = fadedTextures.get(art);
  if (!cached) { cached = { texture: canvas(), signature: "" }; fadedTextures.set(art, cached); }
  if (cached.signature !== signature) {
    const ctx = cached.texture.getContext("2d")!;
    ctx.clearRect(0, 0, cached.texture.width, cached.texture.height);
    ctx.drawImage(art.original, 0, 0);
    for (const id of AREA_IDS) if (fades[id] > 0) {
      ctx.globalAlpha = fades[id] * strength; ctx.drawImage(art.areas[id].fadeOverlay, 0, 0);
    }
    ctx.globalAlpha = 1; cached.signature = signature;
  }
  return cached.texture;
}

export function renderAvatar(ctx: CanvasRenderingContext2D, art: Artwork | null, motion: Motion, fades: AreaFades, strength = .97, instructorArea?: BodyArea) {
  cachedPaths ??= Object.fromEntries(Object.entries(SEGMENTS).map(([key, path]) => [key, new Path2D(path)])) as Record<SegmentKey, Path2D>;
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  ctx.save();
  ctx.translate((ctx.canvas.width - WIDTH) / 2, 0);
  // Fade owned drawing pixels once, before the rig reuses overlapping joint
  // textures. Otherwise an earned forearm fade leaves a colored copy on the arm.
  const texture = art ? fadedTexture(art, fades, strength) : null;
  const draw = (key: SegmentKey) => {
    ctx.save();
    const path = cachedPaths![key];
    ctx.clip(path);
    if (texture) {
      ctx.drawImage(texture, 0, 0);
    } else {
      ctx.fillStyle = instructorArea ? segmentArea(key) === instructorArea ? "#a9d9f2" : "#e3eff6" : "#f4f0e7"; ctx.fill(path);
    }
    ctx.restore();
    ctx.strokeStyle = art ? "rgba(62, 68, 73, .65)" : instructorArea ? "#276380" : "#bdb5a6";
    ctx.lineWidth = art ? 1.8 : instructorArea ? 2.8 : 1.6; ctx.stroke(path);
  };
  const rotate = (pivot: { x: number; y: number }, angle: number) => {
    ctx.translate(pivot.x, pivot.y); ctx.rotate(angle); ctx.translate(-pivot.x, -pivot.y);
  };
  const leg = (side: "left" | "right") => {
    ctx.save(); rotate(JOINTS[`${side}Hip`], motion[`${side}Leg`] - motion.hipTilt);
    draw(`${side}Thigh`);
    rotate(JOINTS[`${side}Knee`], motion[`${side}Knee`]);
    draw(`${side}Shin`); ctx.restore();
  };
  // Rotate the textured pelvis and attached body around a fixed stage-center pivot.
  rotate(JOINTS.pelvis, motion.hipTilt);
  leg("left"); leg("right"); draw("pelvis");
  ctx.save(); rotate(JOINTS.hip, motion.lean - motion.hipTilt);
  draw("torso");
  ctx.save(); rotate(JOINTS.neck, motion.headTilt); draw("head"); ctx.restore();
  const arm = (side: "left" | "right") => {
    ctx.save(); rotate(JOINTS[`${side}Shoulder`], motion[`${side}Arm`]);
    draw(`${side}Upper`);
    rotate(JOINTS[`${side}Elbow`], motion[`${side}Elbow`]);
    draw(`${side}Lower`); ctx.restore();
  };
  arm("left"); arm("right");
  ctx.restore();
  ctx.restore();
}
