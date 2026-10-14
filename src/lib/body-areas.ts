import type { SEGMENTS } from "./rig";

export type BodyArea = "neck-head" | "torso" | "left-upper-arm" | "left-forearm" | "right-upper-arm" | "right-forearm" | "left-leg" | "right-leg";
export type SegmentKey = keyof typeof SEGMENTS;
type AreaConfig = { id: BodyArea; label: string; instruction: string; holding: string; framing: string; fadeLabel: string; segments: SegmentKey[] };
const arm = (side: "left" | "right", forearm: boolean): AreaConfig => ({
  id: `${side}-${forearm ? "forearm" : "upper-arm"}`, label: `${side === "left" ? "Left" : "Right"} ${forearm ? "forearm / hand" : "upper arm"}`,
  instruction: forearm ? `Gently bend your ${side} elbow, keeping your upper arm still.` : `Gently raise your ${side} hand above your shoulder.`,
  holding: forearm ? `keep your ${side} elbow gently bent` : `keep your ${side} arm raised`,
  framing: `Keep your ${side} shoulder, elbow and wrist in view.`, fadeLabel: `${side} ${forearm ? "forearm and hand" : "upper arm"}`,
  segments: [forearm ? `${side}Lower` : `${side}Upper`],
});
const leg = (side: "left" | "right"): AreaConfig => ({
  id: `${side}-leg`, label: `${side === "left" ? "Left" : "Right"} leg / foot`,
  instruction: `Gently extend your ${side} leg out to the side. Keep your hips facing the camera.`,
  holding: `keep your ${side} leg extended sideways`, framing: `Keep shoulders, hips and your ${side} knee, ankle and foot in view.`,
  fadeLabel: `${side} leg and foot`, segments: [`${side}Thigh`, `${side}Shin`],
});
export const BODY_AREAS: AreaConfig[] = [
  { id: "neck-head", label: "Neck / head", instruction: "Tilt your head gently to either side. Keep your shoulders still.", holding: "keep your head gently tilted", framing: "Face the camera with both ears and shoulders visible.", fadeLabel: "head and neck", segments: ["head"] },
  { id: "torso", label: "Torso / back", instruction: "With hands on your hips, gently lean to either side.", holding: "keep a gentle side lean", framing: "Keep shoulders and both hips in view.", fadeLabel: "torso and pelvis", segments: ["torso", "pelvis"] },
  arm("left", false), arm("left", true), arm("right", false), arm("right", true), leg("left"), leg("right"),
];
export const AREA_IDS = BODY_AREAS.map(area => area.id);
export const COLOR_PIXEL_MIN = 40;
export const areaConfig = (id: BodyArea) => BODY_AREAS.find(area => area.id === id)!;
export const segmentArea = (key: SegmentKey) => BODY_AREAS.find(area => area.segments.includes(key))?.id;
export type AreaFades = Record<BodyArea, number>;
export const areaSide = (area: BodyArea): "left" | "right" => area.startsWith("right-") ? "right" : "left";
export const isLegArea = (area: BodyArea) => area === "left-leg" || area === "right-leg";
export const isArmArea = (area: BodyArea) => area.endsWith("upper-arm") || area.endsWith("forearm");
export const emptyFades = (): AreaFades => Object.fromEntries(AREA_IDS.map(id => [id, 0])) as AreaFades;
export function coloredAreas(areas: Record<BodyArea, { coloredPixels: number }>): BodyArea[] {
  return AREA_IDS.filter(id => areas[id].coloredPixels >= COLOR_PIXEL_MIN);
}
