"use client";
import { useEffect, useRef } from "react";
import type { BodyArea } from "@/lib/body-areas";
import { areaConfig } from "@/lib/body-areas";
import { guideInstruction, type GuideStep } from "@/lib/guided";
import { VisualInstructor } from "./visual-instructor";

type Props = { area: BodyArea; step: GuideStep; participant: React.ReactNode; name: string; paused: boolean; done: boolean; transitioning: boolean; resetKey: number;
  progress: number; status: string; fallback: boolean; recovery: boolean; ready: boolean; message: string;
  onSkip: () => void; onPause: () => void; onRestart: () => void; onEnd: () => void; onContinue: () => void; onPosition: () => void };
export function StretchStage(props: Props) {
  const prompt = useRef<HTMLDivElement>(null), returnFocus = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (props.recovery) { returnFocus.current = document.activeElement as HTMLElement; prompt.current?.focus(); }
    else if (returnFocus.current?.isConnected) { returnFocus.current.focus(); returnFocus.current = null; }
  }, [props.recovery]);
  return <section className="stretch-exhibit" data-testid="stretch-exhibit" aria-label="Stretching experience">
    <header className="stretch-header" inert={props.recovery}><div className="stretch-actions" aria-label="Stretch controls">
      <button className="quiet-action" disabled={props.done || props.transitioning || props.recovery} onClick={props.onSkip}><span aria-hidden="true">»</span> Skip Stretch</button>
      <button className="quiet-action" disabled={props.done || props.recovery} onClick={props.onPause}><span aria-hidden="true">{props.paused ? "▷" : "Ⅱ"}</span> {props.paused ? "Resume" : "Pause"}</button>
      <button className="quiet-action" onClick={props.onRestart}><span aria-hidden="true">↻</span> Restart</button>
    </div><div className="exhibit-wordmark">Out of Body</div><button className="quiet-action skip-turn" onClick={props.onEnd}>Skip Turn <span aria-hidden="true">→</span></button></header>
    <p className="exhibit-intro">Take your time. Follow your guide and watch your drawing change.</p>
    <div className="exhibit-panels" inert={props.recovery}>
      <div className="exhibit-guide"><h2>Your Guide</h2><div className="exhibit-panel-info"><p className="eyebrow">Now moving: {areaConfig(props.area).label}</p>
        <p data-testid="current-activity">{guideInstruction(props.area, props.step, props.fallback)}</p><span role="status" data-testid="guided-status">{props.status}</span></div>
        <VisualInstructor area={props.area} step={props.step} resetKey={props.resetKey} paused={props.paused || props.done} /></div>
      <div className="exhibit-drawing"><h2>{props.name || "Your drawing"}</h2><div className="exhibit-panel-info exhibit-progress"><progress aria-label="Activity progress" max="1" value={props.progress} /><span data-testid="guided-percent">{Math.round(props.progress * 100)}%</span></div>{props.participant}</div>
    </div>
    {props.recovery && <div className="tracking-shade"><div className="tracking-prompt" role="dialog" aria-modal="true" aria-labelledby="tracking-prompt-title" aria-describedby="tracking-prompt-description" tabIndex={-1} ref={prompt} data-testid="tracking-prompt"
      onKeyDown={event => { if (event.key === "Tab") { const buttons = prompt.current?.querySelectorAll<HTMLButtonElement>("button:not(:disabled)"); if (!buttons?.length) { event.preventDefault(); return; } const first = buttons[0], last = buttons[buttons.length - 1]; if (event.shiftKey && (document.activeElement === first || document.activeElement === prompt.current)) { event.preventDefault(); last.focus(); } else if (!event.shiftKey && (document.activeElement === last || document.activeElement === prompt.current)) { event.preventDefault(); first.focus(); } } }}>
      <h2 id="tracking-prompt-title">Let’s check your position</h2><p id="tracking-prompt-description">We can’t see you clearly. Your progress is paused.</p><p role="status">{props.ready ? "You’re back in position. Continue when you’re ready." : props.message}</p>
      <button className="primary-action" onClick={props.onContinue} disabled={!props.ready}>Continue</button><button className="quiet-action" onClick={props.onPosition}>Check position</button>
    </div></div>}
  </section>;
}
