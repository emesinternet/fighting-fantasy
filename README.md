# Fighting Fantasy Companion

A minimal HTML, CSS, and JavaScript adventure sheet for Fighting Fantasy books. Track player Skill, Stamina, and Luck, inventory notes, meals, and potions, manage monster encounters, and resolve combat and luck tests in the browser. Save/Load buttons in the header let you download a JSON snapshot (with a page-number prompt) and reload it later.

New games start with a single modal that lets you re-roll each stat before locking them in, followed by a potion picker that explains each option. Cancelling the potion dialog now simply closes it and keeps your current adventure running so you can restart later without surprise alerts. Starting Skill, Stamina, and Luck are pinned beside their inputs (only a Potion of Fortune can raise Luck), while potion status and usage controls live next to Meals and disable once the potion is spent. The New Game and Game Over buttons sit in the top-right header with the title, Luck tests live alongside the other stats in a compact grid, and Add Enemy/Escape Combat share a two-button row under Monster Encounters. Monster boxes start at three, can be added or removed freely (defeated enemies disappear automatically), and a Luck modal offers clear choices for general tests or combat damage adjustments without extra confirmation clicks.

## UI and assets
- **Dark-first styling:** `styles.css` drives a flat, minimal monochrome theme with light serif fantasy headings, compact sans-serif body text, and a monospace log for a terminal feel. Dialogs, dropdowns, and cards all stay grayscale for contrast in dark mode, while buttons share a unified shape and pick up green or red hover states based on whether they advance or cancel an action.
- **Tightened controls:** Number inputs are capped at three digits with slimmer widths, Add Enemy sits beside Escape Combat, and modal action buttons fill their cards. Enemy actions now bias 75/25 toward Attack while keeping Remove wide enough to read, enemy cards mirror the Monster Encounters border, and inline controls like Test Luck, Meals, Potions, Save, and Load align to the right of their rows.
- **Compact notes:** Gold Pieces, Treasures, Equipment, and Provisions sit in a 2x2 grid that collapses to a single column on small screens to save space without sacrificing readability.
- **Focused adventure log:** The log keeps the five most recent updates visible and now pairs emoji with color-coded tones so key actions stay easy to scan. Log history is kept internally so it can be restored from a save file.
- **Script separation:** All gameplay logic lives in `app.js`, which wires the HTML controls, modals, combat handling, and logging.

## Action art and animation
- Each key action triggers matching art from `img/`: New Game, Eat Meal, Use Potion, Escape Combat, combat hits/blocks/defeats, and Lucky/Unlucky rolls all display short sublines alongside their illustrations. Luck checks after landing a blow now reuse the hit/miss art instead of the generic luck images for clearer feedback. The New Game animation fires right after you pick your potion so the art marks the true start of the adventure.
- When you lose an exchange and test Luck, the successful check shows "Lucky block, restore 1 stamina" while a failed check shows "Unlocky block, lose 1 stamina." Combat defeat art with "You have been killed. Game Over." only appears when Stamina hits 0, and a separate Game Over button in the header triggers the non-combat defeat image.
- The overlay darkens and softly blurs the full viewport, then fades/slides the centered image in before the subline text (now using the same fantasy heading font for consistency), holds a little longer, and fades away. Clicking anywhere on the overlay dismisses it immediately if you want to skip the rest of the timing.

## Saving and loading
- Click **Save** (left of New Game) to open a quick prompt asking for the book page number. The app downloads a JSON file labeled with that page and a readable date stamp (for example, `2024-06-17_14-30`). The save includes player stats/maxima, notes, meals, potion status, enemies, and recent log history.
- Click **Load** to select a previously saved JSON file. The adventure sheet, enemies, potions, notes, and log entries restore automatically, and a log entry confirms the loaded page number if provided.

## Development notes
- Follow the instructions in `AGENTS.md`; agents should avoid running automated tests or capturing screenshots unless explicitly requested.
