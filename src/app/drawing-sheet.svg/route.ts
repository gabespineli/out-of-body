import { silhouetteSvg } from "@/lib/rig";
export const dynamic = "force-static";
export function GET() {
  return new Response(silhouetteSvg(), { headers: {
    "Content-Type": "image/svg+xml; charset=utf-8",
    "Content-Disposition": "attachment; filename=out-of-body-drawing-sheet.svg",
  } });
}
