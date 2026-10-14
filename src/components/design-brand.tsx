// Local exports from the Out of Body Figma file. Dynamic body art stays on canvas.
export function BrandLogo({ className = "" }: { className?: string }) {
  return <img className={`brand-logo ${className}`} src="/design/logo.webp" width="107" height="107" alt="Out of Body" draggable={false} />;
}
const icons = { skip: "skip.svg", pause: "pause.svg", restart: "restart.svg", turn: "skip-turn.svg", camera: "camera.svg", home: "home.svg" };
export function DesignIcon({ name }: { name: keyof typeof icons }) {
  return <img className={`design-icon design-icon-${name}`} src={`/design/${icons[name]}`} alt="" aria-hidden="true" draggable={false} />;
}
