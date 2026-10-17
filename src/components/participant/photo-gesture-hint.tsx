"use client";
import { useEffect, useRef, useState } from "react";
import Image from "next/image";

export function PhotoGestureHint({ onDismiss }: { onDismiss: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [hidden, setHidden] = useState(false);
  useEffect(() => {
    const layer = dialog.current;
    layer?.showModal();
    return () => layer?.close();
  }, []);
  useEffect(() => {
    const change = () => setHidden(document.hidden);
    change(); document.addEventListener("visibilitychange", change);
    return () => document.removeEventListener("visibilitychange", change);
  }, []);
  return <dialog ref={dialog} className="photo-gesture-layer" data-testid="photo-gesture-cue" data-hidden={hidden}
    aria-labelledby="photo-onboarding-title" onClick={onDismiss} onCancel={event => { event.preventDefault(); onDismiss(); }}>
    <div className="photo-gesture-cue">
      <p id="photo-onboarding-title">Two fingers to move and zoom</p>
      <div className="gesture-hand-frames" aria-hidden="true">
        <Image className="gesture-hand gesture-hand-closed" src="/design/gestures/pinch-closed-filled-pink.png" alt="" width={256} height={256} sizes="220px" loading="eager" />
        <Image className="gesture-hand gesture-hand-open" src="/design/gestures/pinch-open-filled-pink.png" alt="" width={256} height={256} sizes="220px" loading="eager" />
      </div>
      <button type="button" className="gesture-continue" autoFocus onClick={onDismiss}>Tap to continue</button>
    </div>
  </dialog>;
}
