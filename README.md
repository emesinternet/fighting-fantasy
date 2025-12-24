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

## Spells
- When a book supports magic, the Spells badge shows how many prepared casts you have left. Click it to reopen the spell selection dialog without resetting your adventure so you can correct your prepared list.

## Keyboard shortcuts
- **D:** Open Add Decision (Enter saves; Shift+Enter adds a newline in the decision text).
- **A:** Add Enemy.
- **1–9:** Attack the corresponding enemy slot.
- **R:** Open the General Roll dialog for custom dice.
- **T:** Test Luck.
- **F5:** Save game.
- **F9:** Load game.
