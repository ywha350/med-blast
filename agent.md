# UI Design Specification

## Language
- Default language: **English**
- All UI text, labels, and placeholder content must be written in English

---

## Icons
- Use **lucide-react** exclusively for all icons
- Do **not** use emoji anywhere in the UI (not in labels, buttons, tooltips, or decorative elements)
- Import icons from `lucide-react` by name, e.g. `import { Syringe, Shield } from "lucide-react"`

---

## Visual Theme

### Concept
**Doctor vs. Germs** — a minimal, pixelated dot-art aesthetic. The visual language should feel like a retro medical game: clean clinical structure with pixel-level detail.

### Style Directives
- **Pixel art / dot image style**: Use pixelated rendering. Apply `image-rendering: pixelated` where applicable. Prefer blocky, low-resolution visual motifs over smooth or gradient-heavy designs.
- **Minimal**: Remove all decorative noise. Every element must earn its place. Favor whitespace, clear hierarchy, and restraint.
- **Thematic palette**: Draw from clinical/medical color language — whites, cool grays, antiseptic greens, sterile blues — with sharp accent colors for germs (e.g. sickly yellow-green or toxic purple).

### Motif Reference
| Element | Visual Direction |
|---------|-----------------|
| Player / Hero | Doctor silhouette, pixel art, white coat suggested |
| Enemies | Germ / bacteria shapes, pixel blobs, irregular edges |
| Background | Clean grid or graph-paper pattern, minimal |
| UI chrome | Sharp corners, monospaced or pixel font, clinical feel |
| Accents | Biohazard warning tones — muted yellow-green, alert red |

---

## Typography
- Prefer a **monospaced or pixel-style font** consistent with the retro-medical aesthetic (e.g. `Press Start 2P`, `Courier New`, or similar)
- No rounded, friendly, or humanist fonts — keep it clinical and precise

---

## Do Nots
- No emoji
- No gradients (unless used sparingly to suggest a pixel dither effect)
- No soft drop shadows or blur-heavy glassmorphism
- No generic "AI aesthetic" choices (purple gradients, Inter font, rounded blobs)

