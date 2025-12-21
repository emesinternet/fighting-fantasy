# Agent Instructions

This repository hosts a minimal single-page companion app for the Fighting Fantasy gamebooks.

## App expectations
- New Game walks the player through rolling initial Skill (1D6 + 6), Stamina (2D6 + 12), and Luck (1D6 + 6), then asks them to pick exactly one potion (Skill, Strength, or Fortune). Max values are set from these rolls.
- The adventure sheet includes numeric trackers for Skill, Stamina, and Luck plus free-form text areas for Gold, Treasures, Equipment, and Provisions notes. Meals start at 10; eating a meal spends 1 meal and restores 4 Stamina up to the max.
- Six monster boxes allow setting enemy Skill and Stamina and launching attacks. A combat round rolls 2D6 + Skill for both sides; the higher score deals 2 Stamina damage to the loser. Ties deal no damage. Enemies that reach 0 Stamina reset to 0 Skill and 0 Stamina.
- Escape Combat confirms the action and then removes 2 Stamina from the player.
- Luck tests roll 2D6 versus current Luck, then reduce Luck by 1 (if any remains). Using Luck after hitting an enemy applies +2 or +0/-1 adjustments as per Fighting Fantasy rules; after taking damage it can mitigate or worsen it. Potion of Fortune raises max Luck by 1 and restores Luck when used.
- Potion of Skill restores Skill to its max; Potion of Strength restores Stamina to its max. The Use Potion control consumes the chosen potion once.

## Coding preferences
- Keep the UI simple and focused on the core gameplay logic (stats tracking, combat, luck, escaping, meals). Stay on a single HTML file unless expansion becomes necessary.
- Preserve or improve helpful comments alongside logic changes.
- Ensure README.md stays concise and up to date when behavior changes.

## Workflow reminders for agents
- Do not run automated tests or capture screenshots after making changes unless the user explicitly requests them.
- Follow all repository instructions even when performing small maintenance updates.
