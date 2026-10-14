"use client";
import type { InstallationResult } from "@/components/installation";
import { BrandLogo } from "../design-brand";
export function CompletionScreen({ result, onNext, busy }: { result: InstallationResult; onNext: () => void; busy: boolean }) {
  return <section className="participant-completion" aria-labelledby="completion-title" data-testid="participant-completion">
    <BrandLogo className="completion-logo" />
    <div className="completion-copy">
    <h1 id="completion-title">{result.skipped.length ? "Session finished" : "Stretching complete!"}</h1>
    <p className="care-card-message">Please take home a care card.<br />Always remember to look after your body!</p>
    <p>{result.skipped.length ? `${result.skipped.length} ${result.skipped.length === 1 ? "activity" : "activities"} skipped. Only earned colors faded.` : "Your drawing reflects the movement you completed."}</p>
    </div>
    <div className="button-row completion-actions"><a className="quiet-action" href={result.snapshot} download="out-of-body-completed.png">Save your drawing</a><button className="primary-action" onClick={onNext} disabled={busy}>{busy ? "Preparing next session…" : "Next participant"}</button></div>
    <p className="participant-note">Fading is symbolic progress, not proof of medical relief.</p>
  </section>;
}
