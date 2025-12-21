# Fighting Fantasy Companion

Single-page web sheet for Fighting Fantasy gamebooks. Track player stats, manage monsters, log outcomes, and save or load progress as JSON in the browser.

## Saving and loading
- **Save:** Button left of New Game. Prompts for book page number, then downloads a JSON snapshot named with the page and a readable timestamp.
- **Load:** Pick a saved JSON file to restore stats, notes, potions, enemies, meals, adventure log entries, and decision log entries.

## Logs
- **Adventure Log:** Scrollable list sized for five entries with visible timestamps to keep recent actions easy to follow.
- **Decision Log:** Use the **+** button beside the header to record a page number and decision; timestamps remain in the save file for reference but stay hidden in the UI when browsing entries.

## Dice rolls
- **Test Your Luck:** Opens a dialog to spend Luck on general tests, softening incoming damage, or amplifying your hits.
- **Roll:** Sits beside Test Your Luck and opens a modal to roll 1D6, 1D4, 1D2, 2D6, or a percent die (1-100) and log the result.

## Interface
- Dropdown menus and other form controls stay styled for the dark theme, keeping expanded options readable.

## Enemies
- Add monsters when you encounter them; the list starts empty and shows a prompt until you create one.
- Enemy names remain fixed to their creation order so combat log references do not change when other foes fall.
- Skill and Stamina inputs sit beside the enemy name to keep each card compact during combat.
