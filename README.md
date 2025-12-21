# Fighting Fantasy Companion

Single-page web sheet for Fighting Fantasy gamebooks. Track player stats, manage monsters, log outcomes, and save or load progress as JSON in the browser.

## Saving and loading
- **Save:** Button left of New Game. Prompts for book page number, then downloads a JSON snapshot named with the page and a readable timestamp.
- **Load:** Pick a saved JSON file to restore stats, notes, potions, enemies, meals, adventure log entries, and decision log entries.

## Logs
- **Adventure Log:** Scrollable list sized for five entries; timestamps stay in the save file but are hidden in the UI, and the font is slightly smaller for readability next to the decisions.
- **Decision Log:** Use the **+** button beside the header to record a page number and decision; entries persist in save files and load with the rest of your progress.

## Combat and Luck
- When you hit an enemy, the hit animation plays first, then a modal asks whether to spend Luck for extra damage.
