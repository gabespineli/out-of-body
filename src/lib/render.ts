import { WIDTH, JOINTS, SEGMENTS } from "./rig";
import type { Artwork } from "./artwork";
import type { Motion } from "./pose";

type SegmentKey = keyof typeof SEGMENTS;
let cachedPaths: Record<SegmentKey, Path2D> | undefined;

export function renderAvatar(ctx: CanvasRenderingContext2D, art: Artwork | null, motion: Motion, fade: number, strength = .97) {
  cachedPaths ??= Object.fromEntries(Object.entries(SEGMENTS).map(([key, path]) => [key, new Path2D(path)])) as Record<SegmentKey, Path2D>;
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  ctx.save();
  ctx.translate((ctx.canvas.width - WIDTH) / 2, 0);
  const draw = (key: SegmentKey) => {
    ctx.save();
    const path = cachedPaths![key];
    ctx.clip(path);
    if (art) {
      ctx.drawImage(art.original, 0, 0);
      ctx.globalAlpha = fade * strength; ctx.drawImage(art.fadeOverlay, 0, 0); ctx.globalAlpha = 1;
    } else {
      ctx.fillStyle = "#f4f0e7"; ctx.fill(path);
    }
    ctx.restore();
    ctx.strokeStyle = art ? "rgba(92, 82, 67, .22)" : "#bdb5a6";
    ctx.lineWidth = art ? 1 : 1.6; ctx.stroke(path);
  };
  const rotate = (pivot: { x: number; y: number }, angle: number) => {
    ctx.translate(pivot.x, pivot.y); ctx.rotate(angle); ctx.translate(-pivot.x, -pivot.y);
  };
  const leg = (side: "left" | "right") => {
    ctx.save(); rotate(JOINTS[`${side}Hip`], motion[`${side}Leg`]);
    draw(`${side}Thigh`);
    rotate(JOINTS[`${side}Knee`], motion[`${side}Knee`]);
    draw(`${side}Shin`); ctx.restore();
  };
  leg("left"); leg("right"); draw("pelvis");
  ctx.save(); rotate(JOINTS.hip, motion.lean);
  draw("torso"); draw("head");
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
