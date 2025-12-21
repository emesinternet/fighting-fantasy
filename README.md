# Fighting Fantasy Companion

A minimal HTML, CSS, and JavaScript adventure sheet for Fighting Fantasy books. Track player Skill, Stamina, and Luck, inventory notes, meals, and potions, manage monster encounters, and resolve combat and luck tests in the browser.

New games start with a single modal that lets you re-roll each stat before locking them in, followed by a potion picker that explains each option. Starting Skill, Stamina, and Luck are pinned beside their inputs (only a Potion of Fortune can raise Luck), while potion status and usage controls live next to Meals and disable once the potion is spent. The New Game button sits in the top-right header, Luck tests are tucked beneath the Luck field, and escaping combat sits under the Monster Encounters heading. Monster boxes start at three, can be added or removed freely (defeated enemies disappear automatically), and a Luck modal offers clear choices for general tests or combat damage adjustments.

## UI and assets
- **Dark-first styling:** `styles.css` drives a minimal dark theme with light serif fantasy headings, clean sans-serif body text, and a monospace log for a terminal feel.
- **Script separation:** All gameplay logic lives in `app.js`, which wires the HTML controls, modals, combat handling, and logging.
