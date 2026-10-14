# Out of Body design assets

Source: [Out of Body Figma design, stretching frame 6:40](https://www.figma.com/design/wQ74UCu4zL8ZPM7Zmu5cxa/Out-of-Body?node-id=6-40).

These are local source exports used by the application. No runtime asset depends on a temporary connector URL. The guide and participant drawing remain live canvases; static example bodies from Figma are not substituted for them.

| Runtime file | Figma source | Preparation |
|---|---|---|
| `exhibit-texture.webp` | Background image fill in `6:40` | 4096px texture resized to 2048px, lossless WebP; source opacity retained by the CSS cream overlay |
| `mobile-background.webp` | Background and overlay in `16:86` | Exact paint-only 430 × 932 export, including image transform and pink overlay, lossless WebP |
| `completion-background.webp` | Shader fill in `16:87` | Exact paint-only 1440 × 1024 still export, lossless WebP; user approved the still in place of animation |
| `logo.webp` | Shared pink logo image in the six source frames | Original transparent image resized to 608px, lossless WebP |
| `body-template.webp` | `16:130` in capture frame `16:121` | Original sheet image resized to 1264px tall, lossless WebP; used before camera activation |
| `camera.svg` | `16:118` / `16:162` | Native SVG export, original root geometry retained |
| `home.svg` | `68:57` / `68:56` | Native SVG export, original root geometry retained |
| `pause.svg` | `68:19` | Native SVG export, original root geometry retained |
| `restart.svg` | `68:17` | Native SVG export, original root geometry retained |
| `skip-turn.svg` | `68:11` | Native SVG export, original root geometry retained |
| `skip.svg` | `68:13` | Native SVG export, original root geometry retained |

The mobile landing, capture, ticket, About, stretching and completion screens reference frames `16:86`, `16:121`, `16:144`, `16:164`, `6:40` and `16:87`. Functional additions include optional participant names, ticket status/cancellation, image alignment and cleanup, camera positioning/recovery and save/next-participant actions. Responsive layouts adapt beyond the source frames' fixed dimensions.

## Fonts

Hatch Sans files were supplied by the user in the repository's `fonts/` folder. The five used weights/styles are copied without modification into `public/fonts/` and declared in `src/app/figma.css`. No additional right to redistribute those supplied files is asserted here.

Urbanist normal and italic variable fonts come from the [Google Fonts source repository](https://github.com/google/fonts/tree/main/ofl/urbanist), with the SIL Open Font License retained as `public/fonts/Urbanist-OFL.txt`. [Urbanist's author repository](https://github.com/coreyhu/Urbanist) provides the original font project.

All assets and fonts are served locally. No database migration, server image-processing step or environment variable was added for this design update.
