# Agent Instructions

This repository hosts a minimal single-page companion app for the Fighting Fantasy gamebooks.

## App expectations
- **New Game flow:** Prompt rolls for Skill (1D6 + 6), Stamina (2D6 + 12), and Luck (1D6 + 6). Players can reroll each stat until they accept, then must choose one potion (Skill, Strength, or Fortune). Accepting locks max values based on the final rolls.
- **Adventure sheet controls:** The main grid tracks current Skill, Stamina, Luck, and Meals. Eating a meal restores 4 Stamina up to the max and decreases meals by 1. Gold, Treasures, Equipment, and Provisions are free-form text areas for notes.
- **Potions and Game Over:** Potion of Skill restores Skill to its max, Potion of Strength restores Stamina to its max, and Potion of Fortune restores Luck, raises max Luck by 1, and disables further potion use. Game Over ends the run without rerolls.
- **Luck testing:** Generic Luck tests roll 2D6 against current Luck, then decrement Luck by 1 (if above 0). Luck after combat hits/blocks applies the standard bonus/penalty adjustments.
- **Monsters and combat:** Six monster boxes are available; Add Enemy and Escape Combat share a control row. Each attack rolls 2D6 + Skill for both sides; higher result deals 2 Stamina damage to the loser. Ties do nothing. Defeated enemies reset to 0/0 and can be removed automatically or via Remove. Escape Combat confirms and costs 2 Stamina.
- **Saving and loading:** Save (left of New Game) prompts for a book page number, then downloads a JSON snapshot labeled with the page and a readable timestamp. Load restores stats, maxima, potion state, enemies, notes, meals, and recent log history.
- **Adventure log and art:** Log keeps the five most recent entries visible while preserving full history for saves. Action art overlays accompany key events (new game, hits, blocks, lucky/unlucky rolls, meals, potion use, combat defeat, and Game Over) and can be dismissed by clicking.

## Coding preferences
- Keep the UI simple and focused on the core gameplay logic (stats tracking, combat, luck, escaping, meals). Stay on a single HTML file unless expansion becomes necessary.
- Preserve or improve helpful comments alongside logic changes.
- Ensure README.md stays concise and up to date when behavior changes.

## Workflow reminders for agents
- Do not run automated tests or capture screenshots after making changes unless the user explicitly requests them.
- Follow all repository instructions even when performing small maintenance updates.
