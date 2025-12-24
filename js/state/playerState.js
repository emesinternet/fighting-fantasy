import { clamp, parseNumber } from '../logic/dice.js';

// Core player state is tracked separately from the inputs so we can enforce maxima and potion effects.
export const player = {
  skill: 0,
  stamina: 0,
  luck: 0,
  magic: 0,
  maxSkill: 0,
  maxStamina: 0,
  maxLuck: 0,
  maxMagic: 0,
  meals: 10,
  potion: null,
  potionUsed: false
};

// Light-weight knobs for tailoring how the player trades blows in combat.
export const playerModifiers = {
  damageDone: 0,
  damageReceived: 0,
  skillBonus: 0
};

// Track the unmodifiable starting maxima so we can surface them alongside the inputs.
export const initialStats = {
  skill: 0,
  stamina: 0,
  luck: 0,
  magic: 0
};

export let preparedSpells = {};
export let preparedSpellLimit = 0;

let currentBook = '';

export const setCurrentBook = (bookName) => {
  currentBook = bookName || '';
};

export const getCurrentBook = () => currentBook;

export const resetPreparedSpells = () => {
  preparedSpells = {};
  preparedSpellLimit = 0;
};

export const setPreparedSpells = (spells = {}, limit = 0) => {
  preparedSpells = { ...spells };
  preparedSpellLimit = Math.max(0, limit);
};

export const resetPlayerModifiers = () => {
  playerModifiers.damageDone = 0;
  playerModifiers.damageReceived = 0;
  playerModifiers.skillBonus = 0;
};

// Reset all player-facing state for fresh games or tests.
export const resetPlayerState = () => {
  player.skill = 0;
  player.stamina = 0;
  player.luck = 0;
  player.magic = 0;
  player.maxSkill = 0;
  player.maxStamina = 0;
  player.maxLuck = 0;
  player.maxMagic = 0;
  player.meals = 10;
  player.potion = null;
  player.potionUsed = false;

  initialStats.skill = 0;
  initialStats.stamina = 0;
  initialStats.luck = 0;
  initialStats.magic = 0;

  resetPlayerModifiers();
  resetPreparedSpells();
  setCurrentBook('');
};

export const hydratePlayerState = (savedPlayer = {}, savedInitial = {}) => {
  const safeMaxSkill = parseNumber(
    savedPlayer.maxSkill,
    parseNumber(savedPlayer.skill, player.maxSkill || 0, 0, 999),
    0,
    999
  );
  const safeMaxStamina = parseNumber(
    savedPlayer.maxStamina,
    parseNumber(savedPlayer.stamina, player.maxStamina || 0, 0, 999),
    0,
    999
  );
  const safeMaxLuck = parseNumber(
    savedPlayer.maxLuck,
    parseNumber(savedPlayer.luck, player.maxLuck || 0, 0, 999),
    0,
    999
  );
  const safeMaxMagic = parseNumber(
    savedPlayer.maxMagic,
    parseNumber(savedPlayer.magic, player.maxMagic || 0, 0, 999),
    0,
    999
  );

  player.maxSkill = safeMaxSkill;
  player.maxStamina = safeMaxStamina;
  player.maxLuck = safeMaxLuck;
  player.maxMagic = safeMaxMagic;

  player.skill = clamp(parseNumber(savedPlayer.skill, player.skill || safeMaxSkill, 0, 999), 0, player.maxSkill || 999);
  player.stamina = clamp(parseNumber(savedPlayer.stamina, player.stamina || safeMaxStamina, 0, 999), 0, player.maxStamina || 999);
  player.luck = clamp(parseNumber(savedPlayer.luck, player.luck || safeMaxLuck, 0, 999), 0, player.maxLuck || 999);
  player.magic = clamp(parseNumber(savedPlayer.magic, player.magic || safeMaxMagic, 0, 999), 0, player.maxMagic || 999);
  player.meals = parseNumber(savedPlayer.meals, player.meals, 0, 999);

  player.potion = typeof savedPlayer.potion === 'string' ? savedPlayer.potion : null;
  player.potionUsed = Boolean(savedPlayer.potionUsed);

  initialStats.skill = parseNumber(savedInitial.skill, initialStats.skill || 0, 0, 999);
  initialStats.stamina = parseNumber(savedInitial.stamina, initialStats.stamina || 0, 0, 999);
  initialStats.luck = parseNumber(savedInitial.luck, initialStats.luck || 0, 0, 999);
  initialStats.magic = parseNumber(savedInitial.magic, initialStats.magic || 0, 0, 999);
};

export const setStartingStatsFromRolls = (rolls, { enableMeals, potionChoice, enablePotions }) => {
  player.skill = player.maxSkill = rolls.skill;
  player.stamina = player.maxStamina = rolls.stamina;
  player.luck = player.maxLuck = rolls.luck;
  player.magic = player.maxMagic = rolls.magic || 0;
  player.meals = enableMeals ? 10 : 0;
  player.potion = enablePotions ? potionChoice : null;
  player.potionUsed = false;

  initialStats.skill = rolls.skill;
  initialStats.stamina = rolls.stamina;
  initialStats.luck = rolls.luck;
  initialStats.magic = rolls.magic || 0;
};
