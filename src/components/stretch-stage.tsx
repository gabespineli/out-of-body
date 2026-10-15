"use client";
import { useEffect, useRef } from "react";
import type { BodyArea } from "@/lib/body-areas";
import { areaConfig } from "@/lib/body-areas";
import { guideInstruction, type GuideStep } from "@/lib/guided";
import { VisualInstructor } from "./visual-instructor";
import { BrandLogo, DesignIcon } from "./design-brand";

type Props = { area: BodyArea; step: GuideStep; participant: React.ReactNode; name: string; paused: boolean; done: boolean; transitioning: boolean; resetKey: number;
  progress: number; status: string; recovery: boolean; ready: boolean; message: string; homeOpen: boolean;
  onSkip: () => void; onPause: () => void; onRestart: () => void; onEnd: () => void; onRequestHome: () => void; onCancelHome: () => void };
export function StretchStage(props: Props) {
  const home = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (props.homeOpen && home.current && !home.current.open) home.current.showModal();
    else if (!props.homeOpen && home.current?.open) home.current.close();
  }, [props.homeOpen]);
  return <section className="stretch-exhibit" data-testid="stretch-exhibit" aria-label="Stretching experience">
    <header className="stretch-header"><div className="stretch-actions" aria-label="Stretch controls">
      <button className="quiet-action exhibit-button" disabled={props.done || props.transitioning || props.recovery} onClick={props.onSkip}><DesignIcon name="skip" />Skip Stretch</button>
      <button className="quiet-action exhibit-button" disabled={props.done || props.recovery} onClick={props.onPause}><DesignIcon name={props.paused ? "skip" : "pause"} />{props.paused ? "Resume" : "Pause"}</button>
      <button className="quiet-action exhibit-button" onClick={props.onRestart}><DesignIcon name="restart" />Restart</button>
    </div><div className="exhibit-wordmark"><BrandLogo /></div><button className="quiet-action exhibit-button skip-turn" onClick={props.onRequestHome}><DesignIcon name="home" />Back to home</button></header>
    <p className="exhibit-intro">Relax. Follow your guide and watch as the tension in your body is finally relieved.</p>
    <div className="exhibit-panels">
      <div className="exhibit-guide"><h2>Your Guide</h2><div className="exhibit-panel-info"><p className="eyebrow">Now Relieving: <span>{props.area === "neck-head" ? "Head & neck" : areaConfig(props.area).label}</span></p>
        <p data-testid="current-activity">{guideInstruction(props.area, props.step)}</p><span className="exhibit-live-status" role="status" data-testid="guided-status">{props.status}</span></div>
        <VisualInstructor area={props.area} step={props.step} resetKey={props.resetKey} paused={props.paused || props.done} /></div>
      <div className="exhibit-drawing"><h2 title={props.name || "Your drawing"}>{props.name || "Your drawing"}</h2><div className="exhibit-panel-info exhibit-progress"><progress aria-label="Activity progress" max="1" value={props.progress} /><span data-testid="guided-percent">{Math.round(props.progress * 100)}%</span></div>{props.participant}</div>
    </div>
    {props.recovery && <div className="tracking-notice" role="status" data-testid="tracking-notice"><strong>Progress paused.</strong> Step back into view and hold steady to resume automatically.<span>{props.message}</span></div>}
    <dialog ref={home} className="ticket-cancel-dialog" aria-labelledby="session-home-title" aria-describedby="session-home-description" onCancel={event => { event.preventDefault(); props.onCancelHome(); }}>
      <h2 id="session-home-title">End your turn?</h2><p id="session-home-description">Going home ends this session without saving a finished drawing. The next person can take their turn.</p>
      <div className="mobile-primary-actions"><button className="secondary-action" autoFocus onClick={props.onCancelHome}>Keep stretching</button><button className="primary-action" onClick={props.onEnd}>End turn and go home</button></div>
    </dialog>
  </section>;
}
