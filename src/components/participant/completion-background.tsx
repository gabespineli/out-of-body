"use client";

import { useEffect, useRef } from "react";

// Minimal host types; the unmodified Figma source owns the GPU rendering details.
interface Device {
  lost: Promise<unknown>;
  destroy(): void;
  pushErrorScope(filter: "validation"): void;
  popErrorScope(): Promise<unknown>;
  addEventListener(name: string, listener: () => void): void;
}
interface CanvasContext {
  configure(options: { device: Device; format: string; alphaMode: "opaque" }): void;
  unconfigure(): void;
  getCurrentTexture(): unknown;
}
interface BrowserGPU {
  requestAdapter(options: { powerPreference: "low-power" }): Promise<{ requestDevice(): Promise<Device> } | null>;
  getPreferredCanvasFormat(): string;
}

// Exact shader controls from Figma completion frame 16:87, source version 625.
const params = {
  intensity: 2.1399998664855957,
  gradient: { stops: [
    { position: 0.048076923936605453, color: { r: 0.9272648692131042, g: 0.22319625318050385, b: 0.6787700653076172, a: 1 } },
    { position: 0.32692307233810425, color: { r: 0.9882352948188782, g: 0.7686274647712708, b: 0.9921568632125854, a: 1 } },
    { position: 0.5432692170143127, color: { r: 0.47843137383461, g: 0.843137264251709, b: 0.9254902005195618, a: 1 } },
    { position: 0.7644230723381042, color: { r: 0.9921568632125854, g: 0.9843137264251709, b: 0.886274516582489, a: 1 } },
    { position: 1, color: { r: 0.9843137264251709, g: 0.6470588445663452, b: 0.21568627655506134, a: 1 } },
  ] },
  gradientBalance: 0, material: 0, morphSpeed: 1.959999918937683,
  detail: 1.6299999952316284, twist: 0, zoom: 32,
  gradientMethod: 1, warp: 0, rotationSpeed: 10,
};

export function CompletionBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = canvasRef.current!;
    const motion = matchMedia("(prefers-reduced-motion: reduce)");
    const gpu = (navigator as Navigator & { gpu?: BrowserGPU }).gpu;
    let disposed = false;
    let release: (() => void) | undefined;
    let generation = 0;

    const reset = () => {
      generation++;
      release?.(); release = undefined;
      canvas.dataset.motion = "still";
    };
    const start = async () => {
      reset();
      if (!gpu || motion.matches || disposed || document.hidden) return;
      const current = generation;
      let device: Device | undefined;
      let context: CanvasContext | undefined;
      let animation = 0;
      let observer: ResizeObserver | undefined;
      let stopped = false;
      const cleanup = () => {
        if (stopped) return;
        stopped = true;
        cancelAnimationFrame(animation);
        observer?.disconnect();
        context?.unconfigure();
        device?.destroy();
      };
      const stale = () => disposed || current !== generation;
      try {
        const adapter = await gpu.requestAdapter({ powerPreference: "low-power" });
        if (!adapter || stale()) return;
        device = await adapter.requestDevice();
        if (stale()) { cleanup(); return; }
        release = cleanup;
        const shader = await import("@/lib/figma/completion-gradient");
        if (stale()) return;
        context = canvas.getContext("webgpu") as unknown as CanvasContext | null ?? undefined;
        if (!context) { cleanup(); return; }
        context.configure({ device, format: gpu.getPreferredCanvasFormat(), alphaMode: "opaque" });
        const resize = () => {
          const bounds = canvas.getBoundingClientRect();
          const scale = Math.min(1, 1280 / Math.max(1, bounds.width), 900 / Math.max(1, bounds.height));
          canvas.width = Math.max(1, Math.round(bounds.width * scale));
          canvas.height = Math.max(1, Math.round(bounds.height * scale));
        };
        resize();
        const frame = { state: {}, output: context.getCurrentTexture(), time: 0, params };
        device.pushErrorScope("validation");
        shader.setup(device, frame);
        shader.render(device, frame);
        const error = await device.popErrorScope();
        if (stale()) return;
        if (error) { reset(); return; }
        canvas.dataset.motion = "running";
        observer = new ResizeObserver(resize); observer.observe(canvas);
        void device.lost.then(() => { if (!stale()) reset(); });
        device.addEventListener("uncapturederror", () => { if (!stale()) reset(); });
        let previous = performance.now();
        const tick = (now: number) => {
          if (stale() || stopped) return;
          if (now - previous >= 1000 / 24) {
            frame.time += Math.min(now - previous, 100); previous = now;
            try {
              frame.output = context!.getCurrentTexture();
              shader.render(device, frame);
            } catch { reset(); return; }
          }
          animation = requestAnimationFrame(tick);
        };
        animation = requestAnimationFrame(tick);
      } catch {
        cleanup();
        if (!stale()) canvas.dataset.motion = "still";
      }
    };
    const refresh = () => { void start(); };
    refresh();
    motion.addEventListener("change", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      disposed = true; reset();
      motion.removeEventListener("change", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, []);
  return <canvas ref={canvasRef} className="completion-background" data-motion="still" aria-hidden="true" />;
}
