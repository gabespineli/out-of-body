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
      if (!canvas.current) return;
      const gap = now - last; last = now;
      if (!freeze.current && !document.hidden && gap <= 250) clock.current += gap / 1000;
      if (now - rendered >= 30) {
        renderAvatar(ctx, null, instructorMotion(area, clock.current, step), emptyFades(), 0, area);
        if (area === "neck-head") neckArc(ctx);
        canvas.current.dataset.loopTime = clock.current.toFixed(2);
        rendered = now;
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [area, step, resetKey]);
  return <div className="stage-pane instructor-pane">
    <h3 className="pane-title">Follow the guide</h3>
    <div className="avatar-frame"><canvas ref={canvas} width={STAGE_WIDTH} height={HEIGHT} className="avatar-canvas" data-testid="instructor" data-area={area} data-step={step} data-neck-arrow={area === "neck-head"} aria-label={area === "neck-head" ? "Gentle sideways head tilts. A curved arrow shows rotation around the neck pivot, not a full neck circle." : "Looping stretch demonstration, independent of your drawing."} /></div>
  </div>;
}
