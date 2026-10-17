"use client";
import { useEffect, useState, type CSSProperties } from "react";

// Remounted for each earned completion; skipping never creates a celebration.
export function StretchCelebration() {
  const [visible, setVisible] = useState(true);
  useEffect(() => { const timer = setTimeout(() => setVisible(false), 1150); return () => clearTimeout(timer); }, []);
  if (!visible) return null;
  return <div className="stretch-celebration" data-testid="stretch-celebration">
    <p role="status" className="celebration-message">Stretch complete!</p>
    <div className="confetti-pieces" aria-hidden="true">{(["left", "right"] as const).map(side =>
      <div className="confetti-emitter" data-side={side} key={side}>{Array.from({ length: 56 }, (_, i) => {
        const direction = side === "left" ? 1 : -1, distance = 18 + (i * 17 % 49);
        return <i key={i} style={{
          "--x": `${direction * distance}vw`, "--mid-x": `${direction * distance * .65}vw`,
          "--rise": `${-(18 + i * 13 % 39)}vh`, "--fall": `${18 + i * 7 % 28}vh`,
          "--turn": `${direction * (240 + i * 47)}deg`, "--start-y": `${(i % 9 - 4) * 5}px`,
          "--size": `${7 + i % 8}px`, "--delay": `${(i % 7) * 15}ms`,
          "--color": ["#ff35b0", "#38e2ff", "#ffe049", "#fffaf0", "#b285ff", "#ff985c"][i % 6],
        } as CSSProperties} />;
      })}</div>)}</div>
  </div>;
}
