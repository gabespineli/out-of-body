"use client";
import { useEffect, useRef, useState } from "react";
import Image from "next/image";

export function PhotoGestureHint({ onDismiss }: { onDismiss: () => void }) {
  const proceed = useRef<HTMLButtonElement>(null);
  const [hidden, setHidden] = useState(false);
  useEffect(() => {
    proceed.current?.focus({ preventScroll: true });
  }, []);
  useEffect(() => {
    const change = () => setHidden(document.hidden);
    change(); document.addEventListener("visibilitychange", change);
    return () => document.removeEventListener("visibilitychange", change);
  }, []);
  return <div role="group" className="photo-gesture-layer" data-testid="photo-gesture-cue" data-hidden={hidden}
    aria-labelledby="photo-onboarding-title" onPointerDown={event => event.stopPropagation()}
    onClick={event => { event.stopPropagation(); onDismiss(); }}
    onKeyDown={event => { if (event.key === "Escape") { event.stopPropagation(); onDismiss(); } }}>
    <div className="photo-gesture-cue">
      <p id="photo-onboarding-title">Two fingers to move and zoom</p>
      <div className="gesture-hand-frames" aria-hidden="true">
        <Image className="gesture-hand gesture-hand-closed" src="/design/gestures/pinch-closed-filled-pink.png" alt="" width={256} height={256} sizes="220px" loading="eager" />
        <Image className="gesture-hand gesture-hand-open" src="/design/gestures/pinch-open-filled-pink.png" alt="" width={256} height={256} sizes="220px" loading="eager" />
      </div>
      <button ref={proceed} type="button" className="gesture-continue">Tap to continue</button>
    </div>
  </div>;
}
