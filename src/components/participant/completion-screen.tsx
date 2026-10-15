"use client";
import type { InstallationResult } from "@/components/installation";
import { BrandLogo, DesignIcon } from "../design-brand";
export function CompletionScreen({ result, onNext, busy, saving = false, onRetry }: { result: InstallationResult; onNext: () => void; busy: boolean; saving?: boolean; onRetry?: () => void }) {
  return <section className="participant-completion" aria-labelledby="completion-title" data-testid="participant-completion">
    <BrandLogo className="completion-logo" />
    <div className="completion-copy">
    <h1 id="completion-title">{result.skipped.length ? "Session finished" : "Stretching complete!"}</h1>
    <p className="care-card-message">Please take home a care card.<br />Always remember to look after your body!</p>
    <p>{result.skipped.length ? `${result.skipped.length} ${result.skipped.length === 1 ? "activity" : "activities"} skipped. Only earned colors faded.` : "Your drawing reflects the movement you completed."}</p>
    </div>
    <p>Save your finished drawing from your phone.</p>
    <div className="button-row completion-actions">{saving
      ? <button className="primary-action" onClick={onRetry} disabled={busy || !onRetry}>{busy ? "Saving your drawing…" : "Retry saving drawing"}</button>
      : <button className="primary-action" onClick={onNext} disabled={busy}><DesignIcon name="home" />{busy ? "Loading…" : "Back to home"}</button>}</div>
    {saving && !busy && <p role="status">Your session is kept here. Retry saving to continue.</p>}
    <p className="participant-note">Fading is symbolic progress, not proof of medical relief.</p>
  </section>;
}
