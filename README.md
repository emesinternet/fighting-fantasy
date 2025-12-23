# Fighting Fantasy Companion

Single-page web sheet for Fighting Fantasy gamebooks. Track player stats, manage monsters, log outcomes, and save or load progress as JSON in the browser.

## Saving and loading
- **Save:** Button left of New Game. Prompts for book page number, then downloads a JSON snapshot named with the page and a readable timestamp.
- **Load:** Pick a saved JSON file to restore stats, notes, potions, enemies, meals, adventure log entries, and decision log entries.

## Combat modifiers
- **Player:** A **Modifier** button beside Test Your Luck opens options for damage done, damage received, and bonus Skill to attack rolls. Active boosts appear with emoji cues beside the stats.
- **Enemies:** Each enemy has a **Modifier** button beside Attack to tune how much damage it deals, how much it takes, and any extra adjustments when you trade blows. Emoji badges on the enemy show the current values.

## Logs
- **Adventure Log:** Scrollable list sized for five entries with visible timestamps to keep recent actions easy to follow.
- **New Game:** Starting a new adventure clears the Adventure Log so prior runs do not linger.
- **Decision Log:** Use the **+** button beside the header to record a page number and decision; timestamps remain in the save file for reference but stay hidden in the UI when browsing entries.
