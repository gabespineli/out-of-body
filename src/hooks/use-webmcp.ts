"use client";
import { useEffect, useRef } from "react";
import { flushSync } from "react-dom";
import type { ManualPose } from "@/components/motion-panel";
import { AREA_IDS, type BodyArea } from "@/lib/body-areas";

type Bindings = {
  state: () => object;
  setManual: (pose: ManualPose) => void;
  restore: () => void;
  setArea: (area: BodyArea) => void;
  startGuided: () => void;
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
        name: "start_guided_session", title: "Start guided stretching",
        description: "Start or restart the sequence selected by colored regions. Requires a loaded drawing with at least one detected colored region. Resets progress and manual joints; never enables the camera. Gentle movement builds progress; rest preserves it.",
        inputSchema: { type: "object", properties: {}, additionalProperties: false },
        annotations: { readOnlyHint: false, untrustedContentHint: false },
        execute(input) { emptyInput(input); flushSync(() => latest.current.startGuided()); return latest.current.state(); },
      },
      {
        name: "select_body_area", title: "Select body area",
        description: "Switch to individual stretches and select one of the eight regions using Body area. Switching experience clears progress. Restarts unfinished holds, resets the manual joints, and preserves completed fades in other areas.",
        inputSchema: { type: "object", properties: { area: { type: "string", enum: AREA_IDS } }, required: ["area"], additionalProperties: false },
        annotations: { readOnlyHint: false, untrustedContentHint: false },
        execute(input) {
          if (!input || typeof input !== "object" || Array.isArray(input) || Object.keys(input).length !== 1 || !("area" in input) || !AREA_IDS.includes(input.area as BodyArea)) throw new Error("Supply one supported body region.");
          flushSync(() => latest.current.setArea(input.area as BodyArea)); return latest.current.state();
        },
      },
      {
        name: "get_installation_state", title: "Read installation state",
        description: "Read the drawing source type, mode, body area, each area’s fade progress, guided sequence activity/progress, timing, pause and fade status. Does not return photos, file names or camera frames.",
        inputSchema: { type: "object", properties: {}, additionalProperties: false },
        annotations: { readOnlyHint: true, untrustedContentHint: false },
        execute(input) { emptyInput(input); return latest.current.state(); },
      },
      {
        name: "configure_manual_pose", title: "Configure manual pose",
        description: "Switch to manual simulation. Set arm heights (0–1), lean (-1–1), optional leg swings (-1–1), knee bends (0–1) hipTilt and headTilt (-1–1), heelRaise and independent leftElbow/rightElbow bends (0–1). Omitted controls reset to rest. Positive left leg / negative right leg moves outward. Hip rotation keeps the pelvis pivot fixed at the stage center. Releases the camera and uses the visible rig and hold timer.",
        inputSchema: { type: "object", properties: { left: { type: "number", minimum: 0, maximum: 1 }, right: { type: "number", minimum: 0, maximum: 1 }, lean: { type: "number", minimum: -1, maximum: 1 }, leftLeg: { type: "number", minimum: -1, maximum: 1 }, rightLeg: { type: "number", minimum: -1, maximum: 1 }, leftKnee: { type: "number", minimum: 0, maximum: 1 }, rightKnee: { type: "number", minimum: 0, maximum: 1 }, hipTilt: { type: "number", minimum: -1, maximum: 1 }, headTilt: { type: "number", minimum: -1, maximum: 1 }, heelRaise: { type: "number", minimum: 0, maximum: 1 }, leftElbow: { type: "number", minimum: 0, maximum: 1 }, rightElbow: { type: "number", minimum: 0, maximum: 1 } }, required: ["left", "right", "lean"], additionalProperties: false },
        annotations: { readOnlyHint: false, untrustedContentHint: false },
        execute(input) {
          if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("Use an object of manual pose controls.");
          const ranges = { left: [0, 1], right: [0, 1], lean: [-1, 1], leftLeg: [-1, 1], rightLeg: [-1, 1], leftKnee: [0, 1], rightKnee: [0, 1], hipTilt: [-1, 1], headTilt: [-1, 1], heelRaise: [0, 1], leftElbow: [0, 1], rightElbow: [0, 1] } as const;
          const value = input as Record<string, unknown>;
          if (Object.keys(value).some(key => !Object.hasOwn(ranges, key)) || ["left", "right", "lean"].some(key => !Object.hasOwn(value, key))) throw new Error("Supply left, right and lean; optional controls are leftLeg, rightLeg, leftKnee, rightKnee, hipTilt, headTilt, heelRaise, leftElbow and rightElbow.");
          const pose = {} as ManualPose;
          for (const key of Object.keys(ranges) as (keyof ManualPose)[]) {
            const number = Object.hasOwn(value, key) ? value[key] : 0;
            const [min, max] = ranges[key];
            if (typeof number !== "number" || !Number.isFinite(number) || number < min || number > max) throw new Error(`${key} must be a number from ${min} to ${max}.`);
            pose[key] = number;
          }
          flushSync(() => latest.current.setManual(pose));
          return latest.current.state();
        },
      },
      {
        name: "restore_artwork_colors", title: "Restore artwork colors",
        description: "Restore the loaded artwork's original colors and reset the gesture timer, Reset the selected colored regions and return to the first activity. Requires a loaded drawing.",
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
