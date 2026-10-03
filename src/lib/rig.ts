export const WIDTH = 600;
export const HEIGHT = 900;
// Extra horizontal space lets rotated arms extend past the original paper edges.
export const STAGE_WIDTH = 840;
export type Point = { x: number; y: number };
export type Region = Point & { radius: number; label: string };
export const REGIONS: Region[] = [
  { x: 232, y: 268, radius: 65, label: "Shoulder" },
  { x: 300, y: 385, radius: 80, label: "Torso" },
  { x: 422, y: 414, radius: 58, label: "Arm" },
];

// The printable sheet, texture masks and joint geometry share this single definition.
export const SEGMENTS = {
  lower: "M224 461 Q300 485 376 461 L382 522 L370 780 Q389 787 392 806 L315 806 L306 550 L294 550 L285 806 L208 806 Q211 787 230 780 L218 522 Z",
  torso: "M269 201 L269 211 Q243 207 219 225 L226 307 L232 386 L224 478 Q300 504 376 478 L368 386 L374 307 L381 225 Q357 207 331 211 L331 201 Z",
  head: "M300 83 C266 83 253 111 255 140 Q257 177 278 185 L277 215 Q300 229 323 215 L322 185 Q343 177 345 140 C347 111 334 83 300 83 Z",
  leftUpper: "M217 222 Q198 218 190 241 L162 342 Q158 363 179 369 Q201 375 207 351 L235 247 Q241 228 217 222 Z",
  leftLower: "M180 344 Q163 340 158 360 L138 447 Q127 462 138 479 Q148 493 160 480 L177 461 L201 368 Q204 348 180 344 Z",
  rightUpper: "M383 222 Q402 218 410 241 L438 342 Q442 363 421 369 Q399 375 393 351 L365 247 Q359 228 383 222 Z",
  rightLower: "M420 344 Q437 340 442 360 L462 447 Q473 462 462 479 Q452 493 440 480 L423 461 L399 368 Q396 348 420 344 Z",
} as const;
export const JOINTS = {
  hip: { x: 300, y: 480 },
  leftShoulder: { x: 216, y: 238 },
  rightShoulder: { x: 384, y: 238 },
  leftElbow: { x: 182, y: 356 },
  rightElbow: { x: 418, y: 356 },
  leftWrist: { x: 156, y: 464 },
  rightWrist: { x: 444, y: 464 },
};

export function silhouetteSvg(sample = false) {
  const shapes = Object.values(SEGMENTS).map(d => `<path d="${d}"/>`).join("");
  const marks = sample ? `<g clip-path="url(#body)" fill="none" stroke-linecap="round" stroke-linejoin="round">
    <path d="M272 121 Q299 100 326 136 M269 137 Q298 117 329 150" stroke="#e5b543" stroke-width="15"/>
    <path d="M205 242 Q231 247 251 270 M193 254 Q218 279 243 293 M195 277 L229 310" stroke="#da7461" stroke-width="22"/>
    <path d="M262 335 Q340 301 346 363 Q266 341 260 401 Q319 367 350 414 M260 425 Q310 409 348 441" stroke="#548d89" stroke-width="18"/>
    <path d="M404 383 L434 408 M398 409 L440 434 M401 436 L450 457" stroke="#a198bd" stroke-width="14"/>
    <path d="M229 599 Q252 582 278 613 M228 619 Q251 604 277 638 M324 708 Q349 681 367 716 M323 729 Q342 712 364 743" stroke="#7399b4" stroke-width="17"/>
    <path d="M266 281 L315 268 M276 293 L334 279" stroke="#e5b543" stroke-width="7"/>
  </g>` : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="900" viewBox="0 0 600 900"><rect width="600" height="900" fill="#faf8f3"/><defs><clipPath id="body">${shapes}</clipPath></defs><g fill="#faf8f3" stroke="#807c72" stroke-width="1.7">${shapes}</g>${marks}<g stroke="#807c72" stroke-width="1" fill="none"><path d="M28 48 V28 H48 M552 28 H572 V48 M28 852 V872 H48 M552 872 H572 V852"/></g><text x="300" y="855" text-anchor="middle" font-family="sans-serif" font-size="10" letter-spacing="3" fill="#807c72">OUT OF BODY · DRAWING SHEET</text></svg>`;
}
