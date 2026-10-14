"use client";
import { useEffect, useRef } from "react";
import { instructorMotion, type GuideStep } from "@/lib/guided";
import { emptyFades, type BodyArea } from "@/lib/body-areas";
import { renderAvatar } from "@/lib/render";
import { STAGE_WIDTH, HEIGHT, JOINTS, WIDTH } from "@/lib/rig";

// The arc illustrates side tilt about the neck pivot, not a full neck circle.
function neckArc(ctx: CanvasRenderingContext2D) {
  const x = JOINTS.neck.x + (STAGE_WIDTH - WIDTH) / 2, y = JOINTS.neck.y, radius = 152;
  const start = -Math.PI / 2 - .58, end = -Math.PI / 2 + .58;
  ctx.save(); ctx.strokeStyle = "#276380"; ctx.fillStyle = "#276380"; ctx.lineWidth = 4;
  ctx.beginPath(); ctx.arc(x, y, radius, start, end); ctx.stroke();
  for (const [angle, direction] of [[start, -1], [end, 1]]) {
    ctx.save(); ctx.translate(x + Math.cos(angle) * radius, y + Math.sin(angle) * radius);
    ctx.rotate(angle + direction * Math.PI / 2);
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-14, -7); ctx.lineTo(-14, 7); ctx.closePath(); ctx.fill(); ctx.restore();
  }
  ctx.beginPath(); ctx.arc(x, y, 4, 0, Math.PI * 2); ctx.fill(); ctx.restore();
}

// Side view makes the planted toes, lifted heels and hand support legible. This
// authored guide does not change the participant's fixed-pivot texture renderer.
function supportedHeels(ctx: CanvasRenderingContext2D, seconds: number, area: BodyArea) {
  const lift = (1 - Math.cos(seconds * Math.PI * 2 / 6)) / 2 * 22;
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  ctx.save(); ctx.translate(90, 0);
  ctx.strokeStyle = "#687681"; ctx.lineWidth = 5; ctx.lineCap = "round";
  ctx.beginPath(); ctx.moveTo(180, 810); ctx.lineTo(590, 810); ctx.stroke();
  // Stable chair: the instructor's hand stays on the back throughout the loop.
  ctx.beginPath(); ctx.moveTo(490, 460); ctx.lineTo(490, 650); ctx.lineTo(560, 650);
  ctx.moveTo(490, 650); ctx.lineTo(490, 805); ctx.moveTo(560, 650); ctx.lineTo(570, 805); ctx.stroke();
  const shape = (points: number[][], fill: string) => {
    ctx.beginPath(); points.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); ctx.closePath();
    ctx.fillStyle = fill; ctx.fill(); ctx.strokeStyle = "#276380"; ctx.lineWidth = 3; ctx.stroke();
  };
  shape([[325, 295-lift], [379, 295-lift], [389, 522-lift], [323, 522-lift]], "#e3eff6");
  ctx.beginPath(); ctx.ellipse(350, 240-lift, 43, 52, 0, 0, Math.PI * 2); ctx.fillStyle = "#e3eff6"; ctx.fill(); ctx.stroke();
  const leftColor = area === "left-leg" ? "#a9d9f2" : "#e3eff6", rightColor = area === "right-leg" ? "#a9d9f2" : "#e3eff6";
  ctx.lineWidth = 22; ctx.strokeStyle = leftColor;
  ctx.beginPath(); ctx.moveTo(341, 515-lift); ctx.lineTo(332, 649-lift/2); ctx.lineTo(354, 781-lift); ctx.stroke();
  ctx.strokeStyle = rightColor;
  ctx.beginPath(); ctx.moveTo(371, 515-lift); ctx.lineTo(368, 649-lift/2); ctx.lineTo(379, 781-lift); ctx.stroke();
  shape([[348, 777-lift], [366, 777-lift], [403, 801], [414, 810], [348, 810-lift]], leftColor);
  shape([[372, 777-lift], [390, 777-lift], [427, 801], [438, 810], [372, 810-lift]], rightColor);
  ctx.lineWidth = 17; ctx.strokeStyle = "#276380";
  ctx.beginPath(); ctx.moveTo(372, 325-lift); ctx.lineTo(404, 411-lift/2); ctx.lineTo(490, 460); ctx.stroke();
  ctx.lineWidth = 11; ctx.strokeStyle = "#e3eff6"; ctx.stroke();
  ctx.restore();
}
export function VisualInstructor({ area, paused, step, resetKey = 0 }: { area: BodyArea; paused: boolean; step?: GuideStep; resetKey?: number }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const clock = useRef(0);
  const freeze = useRef(paused);
  useEffect(() => { freeze.current = paused; }, [paused]);
  useEffect(() => {
    const ctx = canvas.current?.getContext("2d");
    if (!ctx) return;
    let frame = 0, last = performance.now(), rendered = -Infinity;
    clock.current = 0;
    const tick = (now: number) => {
      const gap = now - last; last = now;
      if (!freeze.current && !document.hidden && gap <= 250) clock.current += gap / 1000;
      if (now - rendered >= 30) {
        if (step === "heel-raise") supportedHeels(ctx, clock.current, area);
        else {
          renderAvatar(ctx, null, instructorMotion(area, clock.current, step), emptyFades(), 0, area);
          if (area === "neck-head") neckArc(ctx);
        }
        canvas.current!.dataset.loopTime = clock.current.toFixed(2);
        rendered = now;
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [area, step, resetKey]);
  return <div className="stage-pane instructor-pane">
    <h3 className="pane-title">Follow the guide</h3>
    <div className="avatar-frame"><canvas ref={canvas} width={STAGE_WIDTH} height={HEIGHT} className="avatar-canvas" data-testid="instructor" data-area={area} data-step={step} data-neck-arrow={area === "neck-head"} aria-label={area === "neck-head" ? "Gentle sideways head tilts. A curved arrow shows rotation around the neck pivot, not a full neck circle." : step === "heel-raise" ? "Side view: holding a chair while raising and lowering heels, toes stay on the floor." : "Looping stretch demonstration, independent of your drawing."} /></div>
  </div>;
}
