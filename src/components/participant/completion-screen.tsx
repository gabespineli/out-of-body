"use client";
import type { InstallationResult } from "@/components/installation";
export function CompletionScreen({ result, onNext, busy }: { result: InstallationResult; onNext: () => void; busy: boolean }) {
  return <section className="participant-completion" aria-labelledby="completion-title" data-testid="participant-completion">
    <h1 id="completion-title">{result.skipped.length ? "Session finished" : "Stretching complete!"}</h1>
    <p>{result.skipped.length ? `${result.skipped.length} activities skipped. Only earned colors faded.` : "Your drawing reflects the movement you completed."}</p>
    <p>Remember to look after your body.</p>
    <div className="button-row"><a href={result.snapshot} download="out-of-body-completed.png">Save your drawing</a><button onClick={onNext} disabled={busy}>{busy ? "Preparing next session…" : "Next participant"}</button></div>
    <p className="participant-note">Fading is symbolic progress, not proof of medical relief.</p>
  </section>;
}
