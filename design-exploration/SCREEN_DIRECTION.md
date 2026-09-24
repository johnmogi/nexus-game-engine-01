# Nexus Dungeon Master Screen Direction

Generated on 2026-09-24. This pass pauses isolated asset generation and uses complete screens to establish product context first.

## Screen 01 - Boot / Splash

File: `screen-01-splash/screen-01-splash-v01.png`

- Composition attempted: CRT boot screen with centered Nexus/Pangea mark, diagnostics, Mesahara realm data, seed/build info, faint map and gate traces.
- What worked: Strong Adam-owned workstation mood; boot diagnostics feel functional; Pangea/Nexus mark communicates divided world reconnecting better than the earlier globe-like mark.
- What drifted: Side sticky-note text and desk props are useful for concept mood but should not become required production UI.
- Palette observations: Good dark charcoal/black-green base with restrained mint and subtle amber.
- P0 assets still fit: CRT overlays, module art direction, Frozen Gate adventure tone.
- P0 assets to replace: `assets/brand/nexus-symbol-v01.png` should be replaced by a Pangea/reconnection mark derived from this screen or the brand exploration.

## Screen 02 - Workbench Home

File: `screen-02-workbench/screen-02-workbench-v01.png`

- Composition attempted: Left navigation, top metadata strip, 2x3 module grid, large Adventure panel, persistent lower terminal.
- What worked: This is the strongest product-context screen. It preserves dense workstation hierarchy while embedding fantasy line art inside modules. Terminal is first-class, not decorative.
- What drifted: Some labels and stats are concept-level placeholders and should be rebuilt in HTML/CSS.
- Palette observations: Best match to the approved reference; restrained mint/cyan with amber status accents.
- P0 assets still fit: `module-map`, `module-hero`, `module-npc`, `module-items`, `module-story`, Frozen Gate adventure art, CRT overlays.
- P0 assets to replace: Existing `module-enemy-v01.png` may be too creature-featured if final home screen favors threat silhouettes; evaluate after UI layout.

## Screen 03 - Map / Dungeon Editor

File: `screen-03-map/screen-03-map-v01.png`

- Composition attempted: Technical dungeon grid with coordinates and room IDs, room inspector, validation checks, active terminal.
- What worked: Functional map editor direction is clear. The map remains programmatic rather than becoming a fantasy painting. Exit is green/mint and separate from boss.
- What drifted: It introduced extra room vocabulary such as trap/lore/event and a question-mark marker. Final implementation should return to the approved room vocabulary unless rules change later.
- Palette observations: Good technical restraint; slightly cleaner and more app-like than the reference, but still in-world.
- P0 assets still fit: Room icon family direction, especially green exit and boss separation.
- P0 assets to replace: `room-mystery-v01.png` should stay non-question-mark; any `?` mystery visual should be rejected.

## Screen 04 - Character / Party Builder

File: `screen-04-characters/screen-04-characters-v01.png`

- Composition attempted: Party roster, selected portrait as scanned field-study plate, structured character sheet, terminal generation history.
- What worked: Avoids modern RPG select screen. Feels like Adam's database/workstation with notebook art inserted into it.
- What drifted: The portrait panel contains handwritten-style text; production portraits should avoid baked text unless used as non-critical texture.
- Palette observations: Strong monochrome/mint workstation base; parchment plate is acceptable because it is contained inside a database panel.
- P0 assets still fit: Element icon visual system and CRT overlays.
- P0 assets to replace: Future hero portraits should be less polished and more technical/etched than ordinary fantasy character art.

## Screen 05 - Entity Library

File: `screen-05-library/screen-05-library-v01.png`

- Composition attempted: Reusable content editor with NPC / Monster / Item categories, selected Ash Scarab, visual study, schema editor, terminal history.
- What worked: Strong reusable editor model; center art reads as a generated study inside software rather than a collectible card.
- What drifted: The parchment study is richer than the terminal panels and includes some baked descriptive text. Final entity artwork should avoid readable labels.
- Palette observations: Slightly warmer and parchment-heavy, but contained enough to preserve the 70 percent workstation ratio.
- P0 assets still fit: Enemy/module study direction and item/module study direction.
- P0 assets to replace: Earlier item/brand assets with saturated gold or jewel-tone rendering should be toned down if derived for this screen.

## Screen 06 - Test Lab

File: `screen-06-test-lab/screen-06-test-lab-v01.png`

- Composition attempted: Technical validation harness with run controls, dungeon preview, checks, counts, party summary, terminal, debug/test log.
- What worked: Best technical screen. It feels like Adam testing his own system, not a hacker dashboard. Green exit and separate boss are clear.
- What drifted: Includes a few extra test fields and possible implementation details that should remain flexible.
- Palette observations: Excellent restraint; mostly workstation with only small fantasy schematics.
- P0 assets still fit: CRT overlays, room topology icons, terminal visual language.
- P0 assets to replace: None immediately; this screen mostly validates the restrained technical direction.

## Brand Pangea Exploration

File: `brand-pangea/brand-pangea-exploration-v01.png`

- Composition attempted: Three textless Nexus/Pangea mark concepts: joined continental masses, broken cartographic globe reconnecting, separated fragments converging.
- What worked: Concept A and C most directly communicate separation, reconnection, and one world.
- What drifted: Concept B is closest to a conventional world/globe mark and should be treated cautiously.
- Palette observations: Good dark workstation presentation with restrained luminous seam.
- P0 assets still fit: Adam maker mark can remain as a secondary seal if toned down in UI.
- P0 assets to replace: Primary Nexus symbol should be replaced with a simplified Pangea/reconnection mark.

## Overall Direction

- The strongest visual direction is Screen 02 plus Screen 06: practical workstation first, fantasy studies embedded inside the tool.
- Screen 01 clarifies the corrected Nexus/Pangea brand idea.
- Screen 03 confirms the map should stay programmatic and technical, with green Exit and separate Boss.
- Screens 04 and 05 show how parchment/notebook studies can work if contained inside structured database panels.

## Derived Asset Guidance For Later

- Derive assets from full-screen needs, not isolated fantasy object desire.
- Keep final UI text in HTML/CSS.
- Replace the primary Nexus emblem with a simpler Pangea mark.
- Keep room icons simpler than the generated concept screens when used at small grid sizes.
- Avoid question marks for Mystery.
- Avoid red or X language for Exit.
- Continue treating terminal as a core UI component across screens.
