import assert from 'node:assert/strict';
import { clamp, parseNumber, rollCustomDice, rollDice } from '../js/logic/dice.js';
import {
  player,
  initialStats,
  playerModifiers,
  preparedSpells,
  preparedSpellLimit,
  resetPlayerState,
  setCurrentBook,
  getCurrentBook,
  setPreparedSpells,
  setStartingStatsFromRolls,
  hydratePlayerState
} from '../js/state/playerState.js';
import {
  enemies,
  addEnemy,
  resetEnemies,
  calculateDamageToEnemy,
  calculateDamageToPlayer,
  createDefaultEnemyModifiers,
  normalizeEnemyModifiers,
  getEnemyDamageProfile
} from '../js/logic/combat.js';
import { logHistory, decisionLogHistory, logMessage, addDecisionLogEntry, applyLogState, applyDecisionLogState } from '../js/logic/logs.js';
import { buildSavePayload } from '../js/logic/persistence.js';

const results = [];

const test = async (name, fn) => {
  try {
    await fn();
    results.push({ name, status: 'passed' });
  } catch (error) {
    results.push({ name, status: 'failed', error });
  }
};

// Dice utilities ------------------------------------------------------------
await test('rollDice returns sum within expected range', () => {
  const total = rollDice(3);
  assert.ok(total >= 3 && total <= 18);
});

await test('rollCustomDice returns matching count and total', () => {
  const result = rollCustomDice(2, 6);
  assert.equal(result.values.length, 2);
  assert.equal(result.total, result.values[0] + result.values[1]);
});

await test('clamp bounds values', () => {
  assert.equal(clamp(5, 1, 10), 5);
  assert.equal(clamp(-1, 0, 10), 0);
  assert.equal(clamp(11, 0, 10), 10);
});

await test('parseNumber respects bounds and fallback', () => {
  assert.equal(parseNumber('12', 0, 0, 10), 10);
  assert.equal(parseNumber('abc', 3, 0, 10), 3);
});

// Player state --------------------------------------------------------------
await test('setCurrentBook and getters work', () => {
  setCurrentBook('Test Book');
  assert.equal(getCurrentBook(), 'Test Book');
});

await test('resetPlayerState clears stats and prepared spells', () => {
  resetPlayerState();
  assert.equal(player.skill, 0);
  assert.equal(player.potion, null);
  assert.equal(preparedSpellLimit, 0);
  assert.equal(Object.keys(preparedSpells).length, 0);
});

await test('setStartingStatsFromRolls assigns maxima and potion', () => {
  resetPlayerState();
  setStartingStatsFromRolls({ skill: 10, stamina: 20, luck: 12, magic: 8 }, {
    enableMeals: true,
    potionChoice: 'Potion of Skill',
    enablePotions: true
  });
  assert.equal(player.skill, 10);
  assert.equal(player.maxSkill, 10);
  assert.equal(player.meals, 10);
  assert.equal(player.potion, 'Potion of Skill');
});

await test('hydratePlayerState clamps and applies maxima', () => {
  resetPlayerState();
  hydratePlayerState({
    skill: 20,
    stamina: 30,
    luck: 40,
    magic: 5,
    maxSkill: 18,
    maxStamina: 24,
    maxLuck: 15,
    maxMagic: 8,
    meals: 2,
    potion: 'Potion of Strength',
    potionUsed: true
  }, {
    skill: 18,
    stamina: 24,
    luck: 15,
    magic: 8
  });
  assert.equal(player.skill, 18);
  assert.equal(player.stamina, 24);
  assert.equal(player.luck, 15);
  assert.equal(player.magic, 5);
  assert.equal(player.meals, 2);
  assert.equal(player.potion, 'Potion of Strength');
  assert.equal(player.potionUsed, true);
  assert.equal(initialStats.skill, 18);
});

await test('setPreparedSpells stores spells and limits', () => {
  resetPlayerState();
  setPreparedSpells({ fire: 2 }, 3);
  assert.equal(preparedSpellLimit, 3);
  assert.equal(preparedSpells.fire, 2);
});

// Combat utilities ----------------------------------------------------------
await test('normalizeEnemyModifiers respects delta mode', () => {
  const normalized = normalizeEnemyModifiers({ damageDealt: 3, damageReceived: -1, mode: 'delta' });
  assert.equal(normalized.damageDealt, 3);
  assert.equal(normalized.damageReceived, -1);
});

await test('addEnemy and resetEnemies manage roster', () => {
  resetEnemies();
  addEnemy({ skill: 5, stamina: 6 });
  assert.equal(enemies.length, 1);
  resetEnemies();
  assert.equal(enemies.length, 0);
});

await test('damage profiles apply modifiers', () => {
  resetEnemies();
  const modifiers = createDefaultEnemyModifiers();
  addEnemy({ skill: 7, stamina: 10, modifiers });
  const profile = getEnemyDamageProfile(enemies[0], { damageDone: 1, damageReceived: -1, skillBonus: 0 });
  assert.equal(profile.damageToEnemy, 3); // base 2 + 1
  assert.equal(profile.damageToPlayer, 1); // base 2 -1
});

await test('calculate damage helpers match profile', () => {
  resetEnemies();
  addEnemy({ skill: 6, stamina: 8, modifiers: { damageReceived: 1, mode: 'delta' } });
  const enemy = enemies[0];
  assert.equal(calculateDamageToEnemy(enemy, playerModifiers), 3);
  assert.equal(calculateDamageToPlayer(enemy, playerModifiers), 2);
});

// Logs ----------------------------------------------------------------------
await test('logMessage stores capped history', () => {
  logHistory.length = 0;
  for (let i = 0; i < 5; i += 1) {
    logMessage(`entry ${i}`, 'info');
  }
  assert.equal(logHistory.length, 5);
  assert.equal(logHistory[0].message, 'entry 4');
});

await test('addDecisionLogEntry formats messages', () => {
  decisionLogHistory.length = 0;
  addDecisionLogEntry(120, 'Turn west');
  assert.equal(decisionLogHistory[0].message, 'Page 120: Turn west');
});

await test('applyLogState hydrates safely', () => {
  logHistory.length = 0;
  applyLogState([{ message: 'hello', tone: 'action', timestamp: '2023-01-01' }]);
  assert.equal(logHistory.length, 1);
  assert.equal(logHistory[0].tone, 'action');
});

await test('applyDecisionLogState hydrates safely', () => {
  decisionLogHistory.length = 0;
  applyDecisionLogState([{ pageNumber: 5, decision: 'Open door', timestamp: '2023-01-01' }]);
  assert.equal(decisionLogHistory.length, 1);
  assert.equal(decisionLogHistory[0].pageNumber, 5);
});

// Persistence ---------------------------------------------------------------
await test('buildSavePayload captures core fields', () => {
  resetPlayerState();
  resetEnemies();
  const payload = buildSavePayload({
    pageNumber: '1',
    book: 'Test Book',
    player,
    initialStats,
    playerModifiers,
    notes: { gold: '5', treasure: '', equipment: '' },
    enemies,
    logHistory,
    decisionLogHistory,
    spells: { prepared: {}, limit: 0 }
  });
  assert.equal(payload.book, 'Test Book');
  assert.equal(payload.player.meals, player.meals);
  assert.deepEqual(payload.enemies, []);
  assert.equal(payload.spells.limit, 0);
});

// Report --------------------------------------------------------------------
const failed = results.filter((result) => result.status === 'failed');
results.forEach((result) => {
  if (result.status === 'passed') {
    console.log(`✅ ${result.name}`);
  } else {
    console.error(`❌ ${result.name}: ${result.error?.message}`);
  }
});

if (failed.length) {
  process.exit(1);
} else {
  console.log(`\nAll ${results.length} tests passed.`);
}
