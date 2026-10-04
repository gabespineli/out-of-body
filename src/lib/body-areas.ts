import type { SEGMENTS } from "./rig";

export type BodyArea = "neck-head" | "arms-back" | "legs-feet";
export type SegmentKey = keyof typeof SEGMENTS;
export const BODY_AREAS: { id: BodyArea; label: string; instruction: string; holding: string; framing: string; fadeLabel: string; segments: SegmentKey[] }[] = [
  { id: "neck-head", label: "Neck / head", instruction: "Tilt your head gently to either side. Keep your shoulders still.", holding: "keep your head gently tilted", framing: "Face the camera with both ears and shoulders visible.", fadeLabel: "head and neck", segments: ["head"] },
  { id: "arms-back", label: "Arms / back", instruction: "Raise both hands above your shoulders. Keep elbows near shoulder height.", holding: "keep both arms raised", framing: "Keep shoulders, elbows and both hands in view. Legs can be out of frame.", fadeLabel: "arms and torso", segments: ["torso", "leftUpper", "leftLower", "rightUpper", "rightLower"] },
  { id: "legs-feet", label: "Legs / feet", instruction: "Gently extend either leg out to the side. Keep your hips facing the camera.", holding: "keep that leg extended sideways", framing: "Step back so shoulders, hips, knees and ankles are visible.", fadeLabel: "both legs and feet", segments: ["leftThigh", "leftShin", "rightThigh", "rightShin"] },
];
export const AREA_IDS = BODY_AREAS.map(area => area.id);
export const areaConfig = (id: BodyArea) => BODY_AREAS.find(area => area.id === id)!;
export const segmentArea = (key: SegmentKey) => BODY_AREAS.find(area => area.segments.includes(key))?.id;
export type AreaFades = Record<BodyArea, number>;
export const emptyFades = (): AreaFades => ({ "neck-head": 0, "arms-back": 0, "legs-feet": 0 });
