"use client";
import { useEffect, useRef } from "react";
export function useVisiblePoll(callback: (signal: AbortSignal) => Promise<void>, interval: number, enabled = true) {
  const latest = useRef(callback); latest.current = callback;
  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController(); let timer: ReturnType<typeof setTimeout> | undefined, running = false, failures = 0;
    const tick = async () => {
      if (controller.signal.aborted || document.hidden || running) return;
      running = true;
      try { await latest.current(controller.signal); failures = 0; } catch { failures = Math.min(4, failures + 1); }
      finally { running = false; if (!controller.signal.aborted && !document.hidden) timer = setTimeout(tick, Math.min(60_000, interval * 2 ** failures)); }
    };
    const visibility = () => { clearTimeout(timer); if (!document.hidden) void tick(); };
    document.addEventListener("visibilitychange", visibility); void tick();
    return () => { controller.abort(); clearTimeout(timer); document.removeEventListener("visibilitychange", visibility); };
  }, [interval, enabled]);
}
