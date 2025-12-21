# Fighting Fantasy Companion

Single-page web sheet for Fighting Fantasy gamebooks. Track player stats, manage monsters, log outcomes, and save or load progress as JSON in the browser.

## Core actions
- **New Game:** Roll Skill (1D6+6), Stamina (2D6+12), Luck (1D6+6), then pick one potion. Max values lock in after selection.
- **Adventure sheet:** Adjust Skill, Stamina, Luck, meals, and notes (Gold Pieces, Treasures, Equipment, Provisions). Meal restores 4 Stamina up to max and reduces meals by 1.
- **Monsters:** Up to six enemy cards; set Skill and Stamina, attack, and remove defeated foes. Escape Combat confirms and costs 2 Stamina.
- **Luck tests and potions:** Run generic luck checks or apply luck to combat. Potion of Skill restores Skill to max, Strength restores Stamina to max, Fortune restores and raises Luck by 1 (once per game).

## Saving and loading
- **Save:** Button left of New Game. Prompts for book page number, then downloads a JSON snapshot named with the page and a readable timestamp.
- **Load:** Pick a saved JSON file to restore stats, notes, potions, enemies, meals, and adventure log entries.

## Development
- All logic lives in `app.js` with styles in `styles.css` and markup in `index.html`.
- Main controls and the adventure log stay centered within a 1000px column for easier reading on wide screens.
- Follow `AGENTS.md` for behavior expectations and workflow reminders.
