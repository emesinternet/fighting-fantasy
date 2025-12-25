# Fighting Fantasy Companion

Single-page web sheet for Fighting Fantasy gamebooks. Track player stats, manage monsters, log outcomes, and save or load progress as JSON in the browser.

<img width="1212" height="816" alt="{B1A56B98-B977-412D-BFB7-EB23FE28DA9B}" src="https://github.com/user-attachments/assets/c7aed55c-c38b-4b9a-a151-74f734c9dd82" />

## New game flow
- Choose your book before rolling stats. The book is saved with the adventure and prefixes downloaded save files so campaigns stay organized.
- Roll Skill (1D6 + 6), Stamina (2D6 + 12), and Luck (1D6 + 6) with rerolls until accepted. Books can introduce additional stats; **Citadel of Chaos** adds Magic (2D6 + 6) to the rolling dialog.
- Pick a potion (Skill, Strength, or Fortune) to carry into the run unless the chosen book disables potions.
- When a book supports spellcasting, you will select spells immediately after rolling stats, capped by the stat limit defined for that book.
- The stat rolling modal keeps a three-column layout unless your chosen book introduces Magic, keeping non-magical runs compact.

## Saving and loading
- **Save:** Button left of New Game. Prompts for book page number, then downloads a JSON snapshot that includes the current book name and prefixes the file with it alongside the page and timestamp.
- **Load:** Pick a saved JSON file to restore stats, notes, potions, enemies, meals, spell prep, adventure log entries, and decision log entries.

## Logs
- **Adventure Log:** Scrollable list sized for four entries with visible timestamps to keep recent actions easy to follow.
- **Decision Log:** Use the **+** button beside the header to record a page number and decision; timestamps remain in the save file for reference but stay hidden in the UI when browsing entries.
- Hover a Decision Log entry to reveal a pencil icon for quick edits if you need to fix a recorded choice.

## Map sketchpad
- Click **Map** (or press **M**) to open a sliding modal with a large 16:10 off-white canvas for quick maps or notes.
- Choose from the lighter ink palette or the eraser swatch; the cursor outlines the current brush size (with a larger halo for the eraser). **Save** (Enter works here too) keeps the drawing in your current adventure and future JSON saves; **Download PNG** exports the current canvas, and **Cancel** dismisses without changing the last saved sketch.
- Saved sketches reload automatically when you load a save file so mapping progress sticks with your run.

## Spells
- When a book supports magic, the Spells badge shows how many prepared casts you have left. Click it to reopen the spell selection dialog without resetting your adventure so you can correct your prepared list.

## Keyboard shortcuts
- **D:** Open Add Decision (Enter saves; Shift+Enter adds a newline in the decision text).
- **A:** Add Enemy.
- **1–9:** Attack the corresponding enemy slot.
- **R:** Open the General Roll dialog for custom dice.
- **M:** Open the Map sketchpad.
- **T:** Test Luck.
- **F5:** Save game.
- **F9:** Load game.
- **Enter:** Activate Save/Apply/Confirm buttons in dialogs (where available); Shift+Enter continues to add a newline in decision text fields.

## Code structure
- `js/utils.js` holds shared helpers for dice rolls, clamping, formatting, and rendering log entries.
- `js/constants.js` contains static data such as book rules, spell definitions, and UI art references.
- `js/state.js` initializes the shared state container so the main `app.js` script can focus on UI flows and gameplay logic.
