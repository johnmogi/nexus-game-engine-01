# Graphics drop box

Compressed art lives in git. Drop **new originals** in `_source/` (gitignored) or `inbox/`, then we compress into the folders below.

| Put it here | What it is |
|---|---|
| `branding/` | Splash, poster, logos |
| `characters/` | The Wise, Daydreamer, Lucid Dreamer, Sheman (`{id}.jpg`) + `four-aspects.jpg` strip |
| `cards/sunlight/roses` `vines` `vessels` `crystals` | Sun minor ranks |
| `cards/moonlight/air` `fire` `water` `earth` | Moon minor ranks |
| `cards/majors/` | 20 Majors: `{id}.jpg` e.g. `SUN-MAJ-02.jpg`. Rank 0 Nexus; #1 and #3 are characters |
| `ui/` | Lab / HUD chrome + layout mocks |
| `inbox/` | Unsorted; do not leave files here long |

**Filenames (Lab resolves these):**

- Minors / courts: `{rank}-{lineage}.png` e.g. `1-roses.png`, `J-vines.png`, `3-fire.png`
- Majors: `{id}.png` / `.jpg` under `cards/majors/`
- Characters: also `characters/{id}.png`

Lab serves `/graphics/*` from this folder (dev + build). SVG frames over the art supply title + rank — keep plate art plain when you can.

**`cards/call_*.png`:** opaque OpenAI dump names. Do **not** commit or map until renamed into the folders above.
