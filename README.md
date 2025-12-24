# Fighting Fantasy Companion

Single-page web sheet for Fighting Fantasy gamebooks. Track player stats, manage monsters, log outcomes, and save or load progress as JSON in the browser.

## Saving and loading
- **Save:** Button left of New Game. Prompts for book page number, then downloads a JSON snapshot that includes the current book name and prefixes the file with it alongside the page and timestamp.
- **Load:** Pick a saved JSON file to restore stats, notes, potions, enemies, meals, spell prep, adventure log entries, and decision log entries.

## Logs
- **Adventure Log:** Scrollable list sized for four entries with visible timestamps to keep recent actions easy to follow.
- **Decision Log:** Use the **+** button beside the header to record a page number and decision; timestamps remain in the save file for reference but stay hidden in the UI when browsing entries. Hover a Decision Log entry to reveal a pencil icon for quick edits.
