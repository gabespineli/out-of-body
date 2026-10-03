"use client";
import { useEffect, useRef } from "react";
import { flushSync } from "react-dom";
import type { ManualPose } from "@/components/motion-panel";

type Bindings = {
  state: () => object;
  setManual: (pose: ManualPose) => void;
  restore: () => void;
};
type Tool = {
  name: string; title: string; description: string; inputSchema: object;
  annotations: { readOnlyHint: boolean; untrustedContentHint: boolean };
  execute: (input: unknown) => object;
};
type ContextDocument = Document & { modelContext?: { registerTool: (tool: Tool, options: { signal: AbortSignal }) => void | Promise<void> } };

export function useWebMcp(bindings: Bindings) {
  const latest = useRef(bindings);
  useEffect(() => { latest.current = bindings; });
  useEffect(() => {
    const context = (document as ContextDocument).modelContext;
    if (!context?.registerTool) return;
    const lifecycle = new AbortController();
    const emptyInput = (input: unknown) => {
      if (!input || typeof input !== "object" || Array.isArray(input) || Object.keys(input).length) throw new Error("This action accepts an empty object.");
    };
    const tools: Tool[] = [
      {
        name: "get_installation_state", title: "Read installation state",
        description: "Read the drawing source type, mode, gesture, timing, pause and fade status. Does not return photos, file names or camera frames.",
        inputSchema: { type: "object", properties: {}, additionalProperties: false },
        annotations: { readOnlyHint: true, untrustedContentHint: false },
        execute(input) { emptyInput(input); return latest.current.state(); },
      },
      {
        name: "configure_manual_pose", title: "Configure manual pose",
        description: "Switch to the visible manual simulation and set left/right arm heights (0–1) and lean (-1–1). Releases any active camera. Preserves pause state and runs the same rig and gesture timer as the manual controls.",
        inputSchema: { type: "object", properties: { left: { type: "number", minimum: 0, maximum: 1 }, right: { type: "number", minimum: 0, maximum: 1 }, lean: { type: "number", minimum: -1, maximum: 1 } }, required: ["left", "right", "lean"], additionalProperties: false },
        annotations: { readOnlyHint: false, untrustedContentHint: false },
        execute(input) {
          const value = input as ManualPose;
          if (!value || typeof value !== "object" || Array.isArray(value) || Object.keys(value).some(key => !["left", "right", "lean"].includes(key)) || ![value.left, value.right, value.lean].every(Number.isFinite) || value.left < 0 || value.left > 1 || value.right < 0 || value.right > 1 || value.lean < -1 || value.lean > 1) throw new Error("Use left/right heights from 0 to 1 and a lean from -1 to 1.");
          flushSync(() => latest.current.setManual({ left: value.left, right: value.right, lean: value.lean }));
          return latest.current.state();
        },
      },
      {
        name: "restore_artwork_colors", title: "Restore artwork colors",
        description: "Restore the loaded artwork's original colors and reset the gesture timer, using the same action as Restore colors. Requires a loaded drawing.",
        inputSchema: { type: "object", properties: {}, additionalProperties: false },
        annotations: { readOnlyHint: false, untrustedContentHint: false },
        execute(input) { emptyInput(input); flushSync(() => latest.current.restore()); return latest.current.state(); },
      },
    ];
    for (const tool of tools) {
      try { void Promise.resolve(context.registerTool(tool, { signal: lifecycle.signal })).catch(() => { /* Native controls remain available if registration is unsupported. */ }); }
      catch { /* A browser without a usable WebMCP registry still runs the complete MVP. */ }
    }
    return () => lifecycle.abort();
  }, []);
}
