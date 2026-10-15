"use client";
import { useEffect, useState, type CSSProperties } from "react";

// Remounted for each earned completion; skipping never creates a celebration.
export function StretchCelebration() {
  const [visible, setVisible] = useState(true);
  useEffect(() => { const timer = setTimeout(() => setVisible(false), 1150); return () => clearTimeout(timer); }, []);
  if (!visible) return null;
  return <div className="stretch-celebration" data-testid="stretch-celebration">
    <p role="status" className="celebration-message">Stretch complete!</p>
    <div className="confetti-pieces" aria-hidden="true">{Array.from({ length: 32 }, (_, i) => <i key={i} style={{
      "--x": `${(i % 2 ? 1 : -1) * (60 + i * 12)}px`, "--turn": `${120 + i * 37}deg`,
      "--delay": `${(i % 5) * 25}ms`, "--color": ["#ff3eb5", "#a2eaf2", "#fff0b8", "#bba6e2"][i % 4],
    } as CSSProperties} />)}</div>
  </div>;
}
