# Agent Instructions

This repository hosts a single-page Fighting Fantasy companion app. Keep edits lean, well-commented, and inside the existing HTML/CSS footprint.

## Core functionality
- **Book setup:** New Game prompts for a Fighting Fantasy title before rolling stats; the selected book prefixes save filenames and is stored with the run.
- **Stat rolling:** Roll Skill (1D6 + 6), Stamina (2D6 + 12), and Luck (1D6 + 6) with rerolls before accepting. Books may add Magic (2D6 + 6) and spell limits. Accepted rolls set current and maximum values.
- **Potions:** Choose one potion (Skill, Strength, or Fortune) when allowed. Potion of Skill restores Skill to max, Potion of Strength restores Stamina to max, and Potion of Fortune restores Luck, increases max Luck by 1, and disables further potion use.
- **Adventure sheet:** Grid tracks current Skill, Stamina, Luck, Magic (when present), and Meals. Eating a meal restores 4 Stamina (to max) and reduces meals by 1. Gold, Treasures, and Equipment are free-form note areas.
- **Combat and enemies:** Six enemy slots; each enemy supports Attack, Modifier, and Remove. Combat rolls 2D6 + Skill for both sides; higher result deals 2 Stamina damage (modified by player/enemy deltas). Ties cause no damage. Escape Combat confirms and costs 2 Stamina. Copied creatures can attack other enemies.
- **Luck tests:** General Luck tests roll 2D6 against current Luck, then decrement Luck. Post-hit Luck can add damage to enemies; post-damage Luck can reduce damage taken.
- **Spells:** Books with spells allow preparation and casting (e.g., Creature Copy, Stamina, Luck). Prepared counts decrement on cast; Creature Copy creates an allied enemy entry.
- **Visibility rules:** Book settings can disable potions or meals and hide spells; UI updates accordingly.
- **Logs and overlays:** Adventure Log shows recent entries while keeping full history for saves. Decision Log supports add/edit flows without timestamps in the UI. Action art overlays accompany key events (new game, hits, blocks, luck results, meals, potions, spells, combat defeat, escape, Game Over) and are dismissible.
- **Saving/loading:** Save prompts for page number and downloads JSON with book, stats, maxima, potion state, enemies, notes, meals, spells, modifiers, and log history. Load restores the full state.
- **Keyboard shortcuts:** D (Add Decision), A (Add Enemy), 1–9 (Attack slots), R (General Roll), T (Test Luck), F5 (Save), F9 (Load).

## Coding preferences
- Keep the UI simple and focused on the core gameplay logic; stay within the single HTML file unless expansion is necessary.
- Preserve or improve helpful comments alongside logic changes.
- Keep README.md adjustments purposeful and tied to real feature updates.

## Workflow reminders
- Do not run automated tests or capture screenshots after making changes unless explicitly requested.
- Follow all repository and AGENTS instructions for any files in this repo.

## Code layout
- App boots from `js/app.js` (ES module) and uses helpers in `js/config.js`, `js/logic/`, `js/state/`, and `js/ui/`.
- Keep new logic contained in those folders so the single-page HTML stays lean.

## Recent UI notes
- Dropdown caret alignment is custom drawn in `styles.css` to keep arrows centered inside dark selects.
- Modal shells are capped at 800px wide; compact modals are capped at 480px.
