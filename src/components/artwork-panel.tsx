"use client";
import { useEffect, useRef, useState } from "react";
import { useArtwork } from "@/hooks/use-artwork";
import { WIDTH, HEIGHT, SEGMENTS } from "@/lib/rig";
import { DEFAULT_ALIGNMENT } from "@/lib/artwork";
import { areaConfig, type BodyArea } from "@/lib/body-areas";

export type ArtworkController = ReturnType<typeof useArtwork>;

export function ArtworkPanel({ artwork, area }: { artwork: ArtworkController; area: BodyArea }) {
  const preview = useRef<HTMLCanvasElement>(null);
  const [adjusting, setAdjusting] = useState(false);
  const { art, alignment } = artwork;
  useEffect(() => {
    const ctx = preview.current?.getContext("2d");
    if (!ctx || !art) return;
    ctx.clearRect(0, 0, WIDTH, HEIGHT); ctx.setLineDash([]); ctx.drawImage(art.original, 0, 0);
    if (adjusting) {
      ctx.strokeStyle = "#b3523a"; ctx.lineWidth = 2.5; ctx.setLineDash([6, 5]);
      Object.values(SEGMENTS).forEach(d => ctx.stroke(new Path2D(d)));
      ctx.setLineDash([]);
    }
    ctx.strokeStyle = "#b3523a"; ctx.lineWidth = 4; ctx.setLineDash([7, 5]);
    for (const key of areaConfig(area).segments) ctx.stroke(new Path2D(SEGMENTS[key]));
  }, [art, area, adjusting]);

  return <section className="control-section" aria-labelledby="art-title">
    <h2 id="art-title">Drawing</h2>
    <input data-testid="art-upload" type="file" accept="image/jpeg,image/png,image/webp" aria-label="Upload your silhouette drawing" disabled={artwork.busy} onChange={event => { const file = event.target.files?.[0]; if (file) artwork.upload(file); event.target.value = ""; }} />
    <div className="upload-links"><a href="/drawing-sheet.svg" download="out-of-body-drawing-sheet.svg">Get the drawing sheet</a><button onClick={artwork.sample} disabled={artwork.busy}>Try an example</button></div>
    {artwork.busy && <p role="status">Loading image…</p>}
    {art && <div className="artwork-loaded">
      <canvas ref={preview} width={WIDTH} height={HEIGHT} aria-label="Your drawing. The dashed outline shows the active body area." className="artwork-preview" data-testid="artwork-preview" />
      <div className="artwork-details"><span data-testid="art-source">{artwork.kind === "sample" ? "Example artwork" : "Uploaded drawing"}</span><span className="filename" title={artwork.name}>{artwork.name}</span>
        <button aria-expanded={adjusting} onClick={() => setAdjusting(!adjusting)}>{adjusting ? "Done aligning" : "Align photo"}</button>
      </div>
    </div>}
    {artwork.error && <p className="error-message" role="alert">{artwork.error}</p>}
    {art && adjusting && <div className="alignment-controls">
      {([
        ["scale", "Zoom", .5, 3, .01], ["x", "Horizontal", -250, 250, 1],
        ["y", "Vertical", -400, 400, 1], ["rotation", "Rotation", -30, 30, 1],
      ] as const).map(([key, label, min, max, step]) => <label className="slider-label" key={key}>{label}<input type="range" aria-label={`Photo ${label.toLowerCase()}`} min={min} max={max} step={step} value={alignment[key]} onChange={event => artwork.setAlignment({ ...alignment, [key]: +event.target.value })} /></label>)}
      <button onClick={() => artwork.setAlignment({ ...DEFAULT_ALIGNMENT })}>Reset alignment</button>
    </div>}
    {art && art.areas[area].coloredPixels < 40 && <p className="color-note">No strong color in this body area. Add a colored mark on the template or align the photo.</p>}
  </section>;
}
