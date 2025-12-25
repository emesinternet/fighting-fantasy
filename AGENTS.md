# Agent Instructions

This repository hosts a single-page web companion for Fighting Fantasy gamebooks. The app is intentionally small, with all logic in `index.html`, `app.js`, and `styles.css`, plus supporting image assets under `img/`.

## Core gameplay flows
- **New Game flow:** Prompt for a Fighting Fantasy title, then roll Skill (1D6 + 6), Stamina (2D6 + 12), and Luck (1D6 + 6). Each stat can be rerolled until accepted. After locking in rolls, require the player to choose exactly one potion (Skill, Strength, or Fortune). Finalized rolls set all max values and potions cannot be changed later.
- **Adventure sheet controls:** The main grid tracks current and maximum Skill, Stamina, Luck, plus Meals. Eating a meal heals 4 Stamina up to the max and decrements the meals counter by 1. Gold, Treasures, and Equipment are free-form multiline notes that must persist through saves and loads.
- **Potions and Game Over:** Potion of Skill restores current Skill to its max. Potion of Strength restores current Stamina to its max. Potion of Fortune restores current Luck, raises max Luck by 1, and then disables further potion use. Game Over ends the run without allowing rerolls or new rolls until a fresh New Game.
- **Luck testing:** Generic Luck tests roll 2D6 versus current Luck, then reduce current Luck by 1 if above 0. Combat hit/evade Luck tests apply standard Fighting Fantasy adjustments to damage and include the same decrement.
- **Monsters and combat:** Provide six monster boxes. Add Enemy and Escape Combat share a control row. Each attack round rolls 2D6 + Skill for both sides; the higher total deals 2 Stamina damage to the loser, and ties are no-ops. When an enemy reaches 0 Stamina, reset its stats to 0/0 and remove it automatically or via the Remove control. Escape Combat must confirm with the player and costs 2 Stamina.
- **Saving and loading:** The Save control (left of New Game) prompts for a page number, then downloads a JSON snapshot labeled with the page, selected book title, and a readable timestamp. Load restores stats, maxima, potion state, enemies, note fields, meals, and recent log history. Save filenames must be prefixed by the chosen book to keep runs organized.
- **Adventure log and art:** Keep the five most recent log entries visible in the UI while retaining the full log for saves. Action art overlays accompany key events (new game, hits, blocks, lucky/unlucky rolls, meals, potion use, combat defeat, and Game Over) and should be dismissible by clicking the overlay.

## UI and UX guidelines
- Keep the UI simple and emphasize gameplay controls (stats tracking, combat, luck, escaping, and meals). Remain on a single HTML entry point unless expansion is unavoidable.
- Maintain the custom dropdown caret alignment in `styles.css` to keep arrows centered in dark selects.
- Modal shells should max out at 800px wide, with compact modals capped at 480px.
- Preserve accessibility basics: label inputs, ensure buttons have clear text, and keep contrast high for dark backgrounds.

## Code structure and formatting
- JavaScript lives in `app.js`; avoid adding extra modules unless absolutely necessary. Keep logic well-commented, especially around combat math, roll generation, and save/load serialization.
- CSS stays in `styles.css`; prefer existing color tokens and spacing scales when adding rules. Maintain the custom select arrow drawing.
- HTML remains in `index.html`; keep markup semantic and lightweight. Component-like sections (controls, monsters, logs) should be grouped with clear comments.
- Use consistent indentation (2 spaces) across HTML, CSS, and JS. Avoid trailing whitespace and keep lines readable (soft wrap around 100–120 characters where possible).
- Never wrap imports in try/catch. Keep helper functions small and pure where practical.
- Do not update README.md unless a task explicitly requires it, but ensure this AGENTS.md stays accurate and detailed.

## Workflow reminders for agents
- Do not run automated tests or capture screenshots after changes unless explicitly requested.
- Follow all repository instructions, even for small maintenance updates.
- Keep helpful inline comments when touching gameplay logic, and add brief notes when introducing non-obvious decisions.

## Saving, loading, and storage details
- Save files must include: book title, page number, timestamp, current and max stats, potion choice and remaining eligibility, monsters (including defeated ones in a reset state), meals, notes, and recent log slice.
- Loading must fully restore both current state and historical context used by the log and UI (including whether potions are disabled after Fortune use).
- Downloads should use readable, file-system-safe timestamps and preserve JSON structure that can evolve without breaking old saves.

## Assets and art
- Image overlays live in `img/`; prefer reusing existing assets. If adding new art, keep file sizes lean and name files descriptively.
- Action art overlays should not block primary controls; ensure they are dismissible and layered above content without shifting layout.

## Additional guardrails
- Avoid introducing new dependencies without clear benefit. Stick to plain JS and DOM APIs.
- Respect mobile responsiveness; ensure controls remain usable on small viewports with reasonable tap targets.
- Consider localStorage impact if added later; keep save/load export as the primary persistence path.
