// Dice utilities used across combat, stat rolling, and general checks.
export const rollDice = (count) => Array.from({ length: count }, () => Math.floor(Math.random() * 6) + 1)
  .reduce((sum, value) => sum + value, 0);

export const rollDieWithSides = (sides) => Math.floor(Math.random() * sides) + 1;

export const rollCustomDice = (count, sides) => {
  const values = Array.from({ length: count }, () => rollDieWithSides(sides));
  const total = values.reduce((sum, value) => sum + value, 0);
  return { total, values };
};

export const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

// Keep numeric parsing consistent when restoring a save file or clamping manual input.
export const parseNumber = (value, fallback = 0, min = 0, max = 999) => {
  const parsed = parseInt(value, 10);
  if (Number.isFinite(parsed)) {
    return clamp(parsed, min, max);
  }
  return fallback;
};
