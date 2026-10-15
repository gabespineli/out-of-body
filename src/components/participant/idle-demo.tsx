"use client";
import { useEffect, useRef, useState } from "react";
import { useArtwork } from "@/hooks/use-artwork";
import { emptyFades } from "@/lib/body-areas";
import { instructorMotion } from "@/lib/guided";
import { renderAvatar } from "@/lib/render";
import { STAGE_WIDTH, HEIGHT } from "@/lib/rig";
import { BrandLogo } from "../design-brand";
import { VisualInstructor } from "../visual-instructor";

export function IdleDemo() {
  const artwork = useArtwork(), canvas = useRef<HTMLCanvasElement>(null);
  const [progress, setProgress] = useState(0), [reduced, setReduced] = useState(false);
  useEffect(() => { artwork.sample(); }, [artwork.sample]);
  useEffect(() => {
    const media = matchMedia("(prefers-reduced-motion: reduce)"), update = () => setReduced(media.matches);
    update(); media.addEventListener("change", update); return () => media.removeEventListener("change", update);
  }, []);
  useEffect(() => {
    const node = canvas.current, ctx = node?.getContext("2d");
    if (!node || !ctx || !artwork.art) return;
    let frame = 0, elapsed = 0, last = performance.now(), rendered = -Infinity;
    const tick = (now: number) => {
      const gap = now - last; last = now;
      if (!document.hidden && !reduced && gap <= 250) elapsed += gap / 1000;
      if (now - rendered >= 80) {
        const fade = reduced ? 0 : Math.min(1, Math.max(0, (elapsed % 12 - 2) / 8));
        renderAvatar(ctx, artwork.art, instructorMotion("neck-head", reduced ? 0 : elapsed, "tilt"), { ...emptyFades(), "neck-head": fade });
        node.dataset.demoFade = fade.toFixed(3); node.dataset.loopTime = elapsed.toFixed(2);
        setProgress(fade); rendered = now;
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick); return () => cancelAnimationFrame(frame);
  }, [artwork.art, reduced]);
  return <main className="installation-demo" data-testid="installation-welcome">
    <section className="stretch-exhibit idle-exhibit" data-testid="idle-demo" aria-label="Example stretching experience">
      <header className="stretch-header"><div className="exhibit-wordmark"><BrandLogo /></div></header>
      <p className="exhibit-intro">Your drawing, in motion.<br /><span>Scan the printed QR to join.</span></p>
      <div className="exhibit-panels">
        <div className="exhibit-guide"><h2>Your Guide</h2><div className="exhibit-panel-info"><p className="eyebrow">Sample stretch: <span>Head &amp; neck</span></p><p className="demo-instruction">Gently tilt your head side to side.</p></div>
          <VisualInstructor area="neck-head" step="tilt" paused={reduced} /></div>
        <div className="exhibit-drawing"><h2>Sample drawing</h2><div className="exhibit-panel-info exhibit-progress"><progress aria-label="Example fading progress" max={1} value={progress} /><span>{Math.round(progress * 100)}%</span></div>
          <div className="stage-pane participant-pane"><div className="avatar-frame"><canvas ref={canvas} width={STAGE_WIDTH} height={HEIGHT} className="avatar-canvas" data-testid="demo-drawing" aria-label="Sample drawing moves with the guide. Its head colors fade, then reset for the next demonstration." /></div></div></div>
      </div>
      <p className="demo-caption">A looping example. Your session starts from your phone.</p>
    </section>
  </main>;
}
