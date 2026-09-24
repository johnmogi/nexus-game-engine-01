# Nexus Dungeon Master Asset Plan

Source visual reference: `references/ui/nexus-dm-workbench-reference.png`

Project notes:

- Current UI is a React/Vite lab app under `apps/lab-ui`.
- Existing graphics are served from `/graphics/*`; this new DM kit is staged under `assets/` to avoid architecture or rules changes.
- The current code has card/table art hooks but no finalized DM workbench asset layer yet.
- P0 focuses on a small reusable visual language for the workbench, module panels, topology icons, elemental glyphs, one adventure image, and subtle CRT overlays.

| Asset ID | Filename | Category | Purpose | Screen/Module | Dimensions / Aspect | Transparent | Priority | Generation Status | Imagen Prompt | Notes |
|---|---|---|---|---|---:|---|---|---|---|---|
| brand-nexus-symbol | assets/brand/nexus-symbol-v01.png | brand | Textless Nexus emblem | Header / loading / favicon source | 1024 square | yes | P0 | generated | Master prefix + textless angular gate/atlas nexus symbol, mint/cyan line art, brass accent, transparent background | No lettering |
| brand-adam-maker-mark | assets/brand/adam-maker-mark-v01.png | brand | Adam Douglas maker mark | Credits / tiny signature mark | 1024 square | yes | P0 | generated | Master prefix + small personal maker emblem, initials implied abstractly but no letters, notebook-to-terminal mark, transparent background | No readable AD text |
| module-map | assets/modules/module-map-v01.png | modules | Workbench panel illustration | MAP | 1536x1024 | no | P0 | generated | Master prefix + Mesahara map, frozen dunes, mountains, ruins, connected route nodes, technical cartography | No UI labels |
| module-hero | assets/modules/module-hero-v01.png | modules | Workbench panel illustration | HERO / CHARACTERS | 1536x1024 | no | P0 | generated | Master prefix + lone explorer silhouette, field-guide character drawing, crescent and ruins | No fixed protagonist |
| module-npc | assets/modules/module-npc-v01.png | modules | Workbench panel illustration | NPC | 1536x1024 | no | P0 | generated | Master prefix + mysterious Mesahara archivist/traveler portrait, technical study plate | Mature, not cartoon |
| module-enemy | assets/modules/module-enemy-v01.png | modules | Workbench panel illustration | ENEMY / MONSTERS | 1536x1024 | no | P0 | generated | Master prefix + elemental guardian, scarab/feline/serpentine hints, field-guide creature plate | Original creature |
| module-items | assets/modules/module-items-v01.png | modules | Workbench panel illustration | ITEMS | 1536x1024 | no | P0 | generated | Master prefix + chest, relic, vessel, blade, compass, inventory study | No labels |
| module-story | assets/modules/module-story-v01.png | modules | Workbench panel illustration | STORY | 1536x1024 | no | P0 | generated | Master prefix + open chronicle, scrolls, route marks, prophecy symbols, candlelike amber | No words |
| room-entrance | assets/room-types/room-entrance-v01.png | room-types | Topology icon | Dungeon map | 1024 square | yes | P0 | generated | Master prefix + beginning threshold doorway icon, mint/cyan line art, transparent | Positive start |
| room-exit | assets/room-types/room-exit-gate-green-v01.png | room-types | Topology icon | Dungeon map | 1024 square | yes | P0 | generated | Master prefix + green/mint exit gate portal completion icon, safe progression, transparent | Never red X |
| room-combat | assets/room-types/room-combat-v01.png | room-types | Room icon | Dungeon map | 1024 square | yes | P0 | generated | Master prefix + crossed blade/spear with danger motif, transparent | Amber/red only as combat accent |
| room-treasure | assets/room-types/room-treasure-v01.png | room-types | Room icon | Dungeon map | 1024 square | yes | P0 | generated | Master prefix + relic chest/gem cache icon, transparent | Brass accent |
| room-puzzle | assets/room-types/room-puzzle-v01.png | room-types | Room icon | Dungeon map | 1024 square | yes | P0 | generated | Master prefix + geometric lock/astral mechanism icon, transparent | No question mark text |
| room-npc | assets/room-types/room-npc-v01.png | room-types | Room icon | Dungeon map | 1024 square | yes | P0 | generated | Master prefix + hooded traveler bust icon, transparent | No face text |
| room-story | assets/room-types/room-story-v01.png | room-types | Room icon | Dungeon map | 1024 square | yes | P0 | generated | Master prefix + open book/chronicle icon, transparent | No writing |
| room-rest | assets/room-types/room-rest-v01.png | room-types | Room icon | Dungeon map | 1024 square | yes | P0 | generated | Master prefix + safe camp moon/shelter icon, transparent | Calm |
| room-shop | assets/room-types/room-shop-v01.png | room-types | Room icon | Dungeon map | 1024 square | yes | P0 | generated | Master prefix + small market stall/relic scales icon, transparent | No sign text |
| room-mystery | assets/room-types/room-mystery-v01.png | room-types | Room icon | Dungeon map | 1024 square | yes | P0 | generated | Master prefix + veiled glyph/unknown portal icon, transparent | Avoid question mark |
| room-special | assets/room-types/room-special-v01.png | room-types | Room icon | Dungeon map | 1024 square | yes | P0 | generated | Master prefix + rare star-mechanism shrine icon, transparent | Distinct from puzzle |
| room-boss | assets/room-types/room-boss-v01.png | room-types | Boss room icon | Dungeon map | 1024 square | yes | P0 | generated | Master prefix + looming guardian mask/crown hazard icon, transparent | Separate from Exit |
| element-air | assets/elements/element-air-v01.png | elements | Element glyph | Cards / rooms / UI filters | 1024 square | yes | P0 | generated | Master prefix + air glyph, wind currents, feather, spiral geometry, pale cyan, transparent | Small readable |
| element-fire | assets/elements/element-fire-v01.png | elements | Element glyph | Cards / rooms / UI filters | 1024 square | yes | P0 | generated | Master prefix + fire glyph, ember, heat fractures, amber/orange, transparent | Restrained |
| element-water | assets/elements/element-water-v01.png | elements | Element glyph | Cards / rooms / UI filters | 1024 square | yes | P0 | generated | Master prefix + water glyph, vessel/waves/reflection, cyan-blue, transparent | Small readable |
| element-earth | assets/elements/element-earth-v01.png | elements | Element glyph | Cards / rooms / UI filters | 1024 square | yes | P0 | generated | Master prefix + earth glyph, stone root crystal, green/ochre, transparent | Stable silhouette |
| adventure-frozen-gate | assets/adventures/adventure-frozen-gate-v01.webp | adventures | Wide adventure image | Adventure panel | 2048x1152 | no | P0 | generated | Master prefix + cinematic Frozen Gate, frozen dunes, ancient dimensional gate, ruined citadel, mint portal light | Richer atmosphere |
| crt-scanlines | assets/crt/crt-scanlines-v01.png | crt | Subtle scanline overlay | Terminal/workbench | 1024 square tile | yes | P0 | generated | Fine transparent CRT scanlines, subtle analog texture, no text | Can be CSS opacity |
| crt-noise | assets/crt/crt-noise-v01.png | crt | Screen noise overlay | Terminal/workbench | 1024 square tile | yes | P0 | generated | Subtle transparent phosphor noise speckle, no text | Extremely restrained |
| crt-vignette | assets/crt/crt-vignette-v01.png | crt | Soft edge mask | Workbench shell | 2048x1152 | yes | P0 | generated | Transparent soft CRT vignette edge darkening, no text | Optional |
| hero-air | assets/characters/hero-air-v01.png | characters | Elemental hero portrait | Character select | 1024x1536 | yes | P1 | not started | Master prefix + mature air archetype portrait, etched terminal plate | Later |
| npc-desert-archivist | assets/npcs/npc-desert-archivist-v01.png | npcs | NPC portrait | NPC panels | 1024x1536 | yes | P1 | not started | Master prefix + desert archivist portrait | Later |
| monster-ember-scarab | assets/monsters/monster-scarab-fire-common-v01.png | monsters | Common monster | Encounter panels | 1024 square | yes | P1 | not started | Master prefix + ember scarab common creature | Later |
| item-sandsteel-blade | assets/items/item-sandsteel-blade-v01.png | items | Equipment object | Inventory | 1024 square | yes | P1 | not started | Master prefix + sandsteel blade isolated object | Later |
| sigil-gate | assets/sigils/sigil-gate-v01.png | sigils | Gate sigil | Progression / adventure | 1024 square | yes | P1 | not started | Master prefix + gate sigil | Later |
| scroll-reveal-room | assets/scrolls/scroll-reveal-room-v01.png | scrolls | Scroll item | Inventory | 1024 square | yes | P1 | not started | Master prefix + reveal-room scroll without writing | Later |
| decoration-divider | assets/decoration/divider-technical-fantasy-v01.png | decoration | Divider motif | Panels | 1536x256 | yes | P1 | not started | Master prefix + small fantasy technical divider motif | Later |
| adventure-sunken-library | assets/adventures/adventure-sunken-library-v01.webp | adventures | Wide adventure image | Adventure panel | 2048x1152 | no | P1 | not started | Master prefix + Sunken Library | Later |
| adventure-scarab-observatory | assets/adventures/adventure-scarab-observatory-v01.webp | adventures | Wide adventure image | Adventure panel | 2048x1152 | no | P2 | not started | Master prefix + Scarab Observatory | Later |
| adventure-dunes-remember | assets/adventures/adventure-dunes-remember-v01.webp | adventures | Wide adventure image | Adventure panel | 2048x1152 | no | P2 | not started | Master prefix + The Dunes Remember | Later |
| adventure-buried-shrine | assets/adventures/adventure-buried-shrine-v01.webp | adventures | Wide adventure image | Adventure panel | 2048x1152 | no | P2 | not started | Master prefix + The Buried Shrine | Later |

## P0 Generation Notes

- Generated the P0 Imagen kit on 2026-09-24 using the master style prefix in `docs/ART_DIRECTION.md`.
- Room and element icon families were generated as coherent sheets, then cropped into individual transparent PNG files.
- Module art was generated as a coherent six-panel sheet, then cropped into individual dashboard panel images.
- `room-mystery-v01_REJECTED_question-mark.png` was rejected because it used a literal question mark; replacement `room-mystery-v01.png` uses a veiled portal instead.
- `room-exit-gate-green-v01.png` passed the map correction: green/mint positive portal, not a red X.
- CRT overlays are restrained utility textures created as transparent PNG overlays for functional UI use.
- Contact sheet for P0 review: `assets/contact-sheet-p0-v01.png`.

## P0 Approval Watch List

- Brand marks are slightly more polished than the module-panel line art; approve or request stricter monochrome/terminal replacements.
- Some icons are detailed; final UI should test them at intended small sizes before mass content generation.
- No P1/P2 content art should be generated until this P0 visual language is approved.
