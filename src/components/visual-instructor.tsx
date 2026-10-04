"use client";
import { useEffect, useRef } from "react";
import { instructorMotion } from "@/lib/guided";
import { emptyFades, type BodyArea } from "@/lib/body-areas";
import { renderAvatar } from "@/lib/render";
import { STAGE_WIDTH, HEIGHT } from "@/lib/rig";

export function VisualInstructor({ area, paused }: { area: BodyArea; paused: boolean }) {
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
        renderAvatar(ctx, null, instructorMotion(area, clock.current), emptyFades(), 0, area);
        canvas.current!.dataset.loopTime = clock.current.toFixed(2);
        rendered = now;
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [area]);
  return <div className="stage-pane instructor-pane">
    <h3 className="pane-title">Follow the guide</h3>
    <div className="avatar-frame"><canvas ref={canvas} width={STAGE_WIDTH} height={HEIGHT} className="avatar-canvas" data-testid="instructor" data-area={area} aria-label="Looping stretch demonstration. This guide is independent of your drawing." /></div>
  </div>;
}
