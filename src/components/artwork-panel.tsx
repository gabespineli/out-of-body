"use client";
import { useEffect, useRef, useState } from "react";
import { useArtwork } from "@/hooks/use-artwork";
import { WIDTH, HEIGHT, REGIONS, SEGMENTS } from "@/lib/rig";
import { DEFAULT_ALIGNMENT, regionHasBody } from "@/lib/artwork";

export type ArtworkController = ReturnType<typeof useArtwork>;

export function ArtworkPanel({ artwork }: { artwork: ArtworkController }) {
  const preview = useRef<HTMLCanvasElement>(null);
  const [adjusting, setAdjusting] = useState(false);
  const { art, alignment, region, regions, selectedRegion } = artwork;
  useEffect(() => {
    const ctx = preview.current?.getContext("2d");
    if (!ctx || !art) return;
    ctx.clearRect(0, 0, WIDTH, HEIGHT); ctx.setLineDash([]); ctx.drawImage(art.original, 0, 0);
    if (adjusting) {
      ctx.strokeStyle = "#b3523a"; ctx.lineWidth = 2.5; ctx.setLineDash([6, 5]);
      Object.values(SEGMENTS).forEach(d => ctx.stroke(new Path2D(d)));
      ctx.setLineDash([]);
    }
    regions.forEach((r, i) => {
      ctx.beginPath(); ctx.arc(r.x, r.y, r.radius, 0, Math.PI * 2);
      ctx.strokeStyle = i === selectedRegion ? "#b3523a" : "#225d85";
      ctx.lineWidth = i === selectedRegion ? 4 : 2; ctx.setLineDash([7, 5]); ctx.stroke();
      ctx.fillStyle = ctx.strokeStyle; ctx.font = "bold 28px Arial";
      ctx.fillText(String(i + 1), r.x - 8, r.y - r.radius + 26);
    });
  }, [art, regions, selectedRegion, adjusting]);

  const chooseRegion = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const point = { x: (event.clientX - rect.left) / rect.width * WIDTH, y: (event.clientY - rect.top) / rect.height * HEIGHT };
    if (regionHasBody(point)) artwork.setRegion({ ...point, radius: region.radius, label: "Your selection" });
  };
  return <section className="control-section" aria-labelledby="art-title">
    <h2 id="art-title">Drawing</h2>
    <input data-testid="art-upload" type="file" accept="image/jpeg,image/png,image/webp" aria-label="Upload your silhouette drawing" disabled={artwork.busy} onChange={event => { const file = event.target.files?.[0]; if (file) artwork.upload(file); event.target.value = ""; }} />
    <div className="upload-links"><a href="/drawing-sheet.svg" download="out-of-body-drawing-sheet.svg">Get the drawing sheet</a><button onClick={artwork.sample} disabled={artwork.busy}>Try an example</button></div>
    {artwork.busy && <p role="status">Loading image…</p>}
    {art && <div className="artwork-loaded">
      <canvas ref={preview} width={WIDTH} height={HEIGHT} onPointerDown={chooseRegion} aria-label="Your drawing. Click a colored area to select it; use the region buttons for keyboard selection." className="artwork-preview" data-testid="artwork-preview" />
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
    {art && <div className="region-picker"><span>Fade area — click the drawing or select:</span>
      <label className="field-label">Editing area<select aria-label="Selected fade area" value={selectedRegion} onChange={event => artwork.setSelectedRegion(+event.target.value)}>{regions.map((r, i) => <option value={i} key={i}>Area {i + 1}: {r.label}{art.regionPixels[i] < 40 ? " (no color)" : ""}</option>)}</select></label>
      <div className="segmented region-options">{REGIONS.map(r => <button key={r.label} aria-pressed={region.label === r.label} onClick={() => artwork.setRegion({ ...r })}>{r.label}</button>)}</div>
      {region.label === "Your selection" && <small className="selection-note">Custom area selected</small>}
      <label className="slider-label">Area size<input type="range" min="30" max="130" value={region.radius} aria-label="Selected area size" onChange={event => artwork.setRegion({ ...region, radius: +event.target.value })} /></label>
      <div className="button-row"><button onClick={artwork.addRegion} disabled={regions.length >= 5}>Add area</button><button onClick={artwork.removeRegion} disabled={regions.length === 1}>Remove area</button></div>
      <p>{regions.length} / 5 areas. Selected areas fade together.</p>
      {art.regionPixels[selectedRegion] < 40 && <p className="color-note">No strong color in this area yet. Select another area.</p>}
    </div>}
  </section>;
}
