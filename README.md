# Fighting Fantasy Companion

Single-page web sheet for Fighting Fantasy gamebooks. Track player stats, manage monsters, log outcomes, and save or load progress as JSON in the browser.

<img width="1212" height="816" alt="{B1A56B98-B977-412D-BFB7-EB23FE28DA9B}" src="https://github.com/user-attachments/assets/c7aed55c-c38b-4b9a-a151-74f734c9dd82" />

## New game flow
- Choose your book before rolling stats. The book is saved with the adventure and prefixes downloaded save files so campaigns stay organized.
- Roll Skill (1D6 + 6), Stamina (2D6 + 12), and Luck (1D6 + 6) with rerolls until accepted. Books can introduce additional stats; **Citadel of Chaos** adds Magic (2D6 + 6) to the rolling dialog.
- Pick a potion (Skill, Strength, or Fortune) to carry into the run unless the chosen book disables potions.
- When a book supports spellcasting, you will select spells immediately after rolling stats, capped by the stat limit defined for that book.

## Saving and loading
- **Save:** Button left of New Game. Prompts for book page number, then downloads a JSON snapshot that includes the current book name and prefixes the file with it alongside the page and timestamp.
- **Load:** Pick a saved JSON file to restore stats, notes, potions, enemies, meals, spell prep, adventure log entries, and decision log entries.

## Logs
- **Adventure Log:** Scrollable list sized for four entries with visible timestamps to keep recent actions easy to follow.
- **Decision Log:** Use the **+** button beside the header to record a page number and decision; timestamps remain in the save file for reference but stay hidden in the UI when browsing entries.

## Book-specific rules
- **Citadel of Chaos:** Adds a Magic stat to the character sheet. After rolling stats you may prepare spells up to your Magic score, then cast them directly from the spells list beneath Treasures. Potions and meals are not available for this book, so those controls stay hidden, and spells such as Luck and Skill restore stats according to their descriptions while logging the cast in the Adventure Log.

## Refinements
- Spell preparation uses a compact grid with centered quantity controls and a remaining-spells summary card for easier allocation; prepared spells show how many casts remain and are triggered directly from the adventure sheet.
- Spells now mirror stat chips for remaining casts and use compact inline headers so descriptions can stretch the full card width.
- Creature Copy now duplicates a selected enemy into an orange-highlighted ally that can be directed via a dropdown target picker.
- Creature Copy now prompts for a source enemy even when stats still need to be filled in, and spell log entries keep apostrophes readable with “Spell” highlighted in the adventure log.
- Creature Copy now triggers its dedicated effect handler so casting reliably opens the selection modal and spawns the ally.
- Copied creatures retain their orange outline, and spell buttons pick up a soft orange hover state.
- Treasures sits alongside Gold and Equipment to keep adventure notes aligned on one row.
- Spell casts always show the spell overlay art with contextual subtext when triggered.
- Enemy stat inputs now share the same clamped number handling, making quick edits more consistent.
- Action overlays scale down on narrower screens while keeping the art and text legible.
- Spellcasting overlays now draw from the PNG action art to match the rest of the animations.
- Scrollbars use a thinner style throughout the app to stay out of the way while browsing logs or spells.
- Panels and chips use shared radius and shadow tokens for a more unified look.
- Dropdown carets are centered on custom selects for clearer alignment with the label text.
- Standard modals cap at 800px wide (480px for compact dialogs), with the Magic stat rolling dialog widening to 1180px for four-stat layouts.
- The main layout widens to 1400px so four stats sit comfortably on a single row.

## Keyboard shortcuts
- **D:** Open Add Decision (Enter saves; Shift+Enter adds a newline in the decision text).
- **A:** Add Enemy.
- **1–9:** Attack the corresponding enemy slot.
- **R:** Open the General Roll dialog for custom dice.
- **T:** Test Luck.
- **F5:** Save game.
- **F9:** Load game.
