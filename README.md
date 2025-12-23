# Fighting Fantasy Companion

Single-page web sheet for Fighting Fantasy gamebooks. Track player stats, manage monsters, log outcomes, and save or load progress as JSON in the browser.

## Saving and loading
- **Save:** Button left of New Game. Prompts for book page number, then downloads a JSON snapshot named with the page and a readable timestamp.
- **Load:** Pick a saved JSON file to restore stats, notes, potions, enemies, meals, adventure log entries, and decision log entries.

## Logs
- **Adventure Log:** Scrollable list sized for four entries with visible timestamps to keep recent actions easy to follow.
- **Decision Log:** Use the **+** button beside the header to record a page number and decision; timestamps remain in the save file for reference but stay hidden in the UI when browsing entries.

## Keyboard shortcuts
- **D:** Open Add Decision (Enter saves; Shift+Enter adds a newline in the decision text).
- **A:** Add Enemy.
- **1–9:** Attack the corresponding enemy slot.
- **R:** Open the General Roll dialog for custom dice.
- **T:** Test Luck.
- **F10:** Save game.
- **F12:** Load game.
