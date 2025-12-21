# Fighting Fantasy Companion

A minimal HTML, CSS, and JavaScript adventure sheet for Fighting Fantasy books. Track player Skill, Stamina, and Luck, inventory notes, meals, and potions, manage monster encounters, and resolve combat and luck tests in the browser.

New games start with a single modal that lets you re-roll each stat before locking them in, followed by a potion picker that explains each option. Starting Skill, Stamina, and Luck are pinned beside their inputs (only a Potion of Fortune can raise Luck), while potion status and usage controls live next to Meals and disable once the potion is spent. The New Game button sits in the top-right header with the title, Luck tests live alongside the other stats in a compact grid, and Add Enemy/Escape Combat share a two-button row under Monster Encounters. Monster boxes start at three, can be added or removed freely (defeated enemies disappear automatically), and a Luck modal offers clear choices for general tests or combat damage adjustments without extra confirmation clicks.

## UI and assets
- **Dark-first styling:** `styles.css` drives a flat, minimal monochrome theme with light serif fantasy headings, compact sans-serif body text, and a monospace log for a terminal feel. Dialogs, dropdowns, and cards all stay grayscale for contrast in dark mode.
- **Tightened controls:** Number inputs are capped at three digits with slimmer widths, Add Enemy sits beside Escape Combat, and modal action buttons fill their cards. Enemy actions now bias 75/25 toward Attack while keeping Remove wide enough to read, enemy cards mirror the Monster Encounters border, and inline controls like Test Luck, Meals, and Potions align to the right of their rows.
- **Compact notes:** Gold Pieces, Treasures, Equipment, and Provisions sit in a 2x2 grid that collapses to a single column on small screens to save space without sacrificing readability.
- **Script separation:** All gameplay logic lives in `app.js`, which wires the HTML controls, modals, combat handling, and logging.

## Development notes
- Follow the instructions in `AGENTS.md`; agents should avoid running automated tests or capturing screenshots unless explicitly requested.
