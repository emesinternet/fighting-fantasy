import { BASE_ENEMY_DAMAGE } from '../config.js';
import { clamp, parseNumber, rollDice } from './dice.js';

export const enemies = [];
export let nextEnemyId = 1;

export const createDefaultEnemyModifiers = () => ({
  damageDealt: 0,
  damageReceived: 0,
  playerDamageBonus: 0,
  playerDamageTakenBonus: 0,
  mode: 'delta'
});

export const normalizeEnemyModifiers = (modifiers = {}) => {
  const parseDelta = (value) => parseNumber(value, 0, -99, 99);
  const parseLegacyValue = (value) => parseNumber(value, BASE_ENEMY_DAMAGE, 0, 99) - BASE_ENEMY_DAMAGE;
  const isDeltaModel = modifiers.mode === 'delta';

  return {
    damageDealt: isDeltaModel ? parseDelta(modifiers.damageDealt) : parseLegacyValue(modifiers.damageDealt),
    damageReceived: isDeltaModel ? parseDelta(modifiers.damageReceived) : parseLegacyValue(modifiers.damageReceived),
    playerDamageBonus: parseDelta(modifiers.playerDamageBonus),
    playerDamageTakenBonus: parseDelta(modifiers.playerDamageTakenBonus),
    mode: 'delta'
  };
};

export const getEnemyModifiers = (enemy) => normalizeEnemyModifiers(enemy?.modifiers || createDefaultEnemyModifiers());

export const formatEnemyName = (enemy) => {
  if (!enemy) {
    return 'Enemy';
  }
  if (enemy.name) {
    return enemy.name;
  }
  if (Number.isFinite(enemy.id)) {
    return `Enemy ${enemy.id}`;
  }
  return 'Enemy';
};

export const formatEnemyOptionLabel = (enemy) => `${formatEnemyName(enemy)} (Skill ${enemy.skill || 0}, Stamina ${enemy.stamina || 0})`;

export const getEnemyDamageProfile = (enemy, playerModifiers) => {
  const modifiers = getEnemyModifiers(enemy);
  const damageToEnemy = Math.max(
    0,
    BASE_ENEMY_DAMAGE
      + modifiers.damageReceived
      + playerModifiers.damageDone
      + modifiers.playerDamageBonus
  );
  const damageToPlayer = Math.max(
    0,
    BASE_ENEMY_DAMAGE
      + modifiers.damageDealt
      + playerModifiers.damageReceived
      + modifiers.playerDamageTakenBonus
  );

  return { modifiers, damageToEnemy, damageToPlayer };
};

export const summarizeEnemyModifiers = (enemy) => {
  const modifiers = getEnemyModifiers(enemy);
  const pieces = [];

  if (modifiers.damageDealt) {
    const prefix = modifiers.damageDealt > 0 ? '+' : '';
    pieces.push(`🗡️${prefix}${modifiers.damageDealt}`);
  }

  if (modifiers.damageReceived) {
    if (modifiers.damageReceived > 0) {
      pieces.push(`💀+${modifiers.damageReceived}`);
    } else {
      pieces.push(`🛡️+${Math.abs(modifiers.damageReceived)}`);
    }
  }

  return pieces.join(' ');
};

export const calculateDamageToEnemy = (enemy, playerModifiers) => getEnemyDamageProfile(enemy, playerModifiers).damageToEnemy;
export const calculateDamageToPlayer = (enemy, playerModifiers) => getEnemyDamageProfile(enemy, playerModifiers).damageToPlayer;

const findEnemyIndexById = (id) => enemies.findIndex((enemy) => enemy.id === id);

export const removeEnemyById = (id) => {
  const index = findEnemyIndexById(id);
  if (index >= 0) {
    removeEnemy(index);
  }
};

export const addEnemy = (initial = { skill: 0, stamina: 0 }, options = {}) => {
  const atTop = Boolean(options.atTop);
  const safeId = Number.isFinite(initial?.id) ? initial.id : nextEnemyId++;
  nextEnemyId = Math.max(nextEnemyId, safeId + 1);

  const enemy = {
    id: safeId,
    name: typeof initial?.name === 'string' && initial.name.trim() ? initial.name : `Enemy ${safeId}`,
    skill: parseNumber(initial.skill, 0, 0, 999),
    stamina: parseNumber(initial.stamina, 0, 0, 999),
    modifiers: normalizeEnemyModifiers(initial.modifiers || createDefaultEnemyModifiers()),
    isCopy: Boolean(initial.isCopy),
    copiedFromId: Number.isFinite(initial.copiedFromId) ? initial.copiedFromId : null
  };

  if (atTop) {
    enemies.unshift(enemy);
  } else {
    enemies.push(enemy);
  }
};

export const removeEnemy = (index) => {
  enemies.splice(index, 1);
};

// Clear enemies for a fresh state (useful in tests or new games).
export const resetEnemies = () => {
  enemies.length = 0;
  nextEnemyId = 1;
};

export const applyEnemiesState = (savedEnemies = []) => {
  let restored = [];
  let maxId = 0;
  nextEnemyId = 1;

  if (Array.isArray(savedEnemies)) {
    restored = savedEnemies.map((enemy) => {
      const safeId = Number.isFinite(enemy?.id) ? enemy.id : nextEnemyId++;
      const safeName = typeof enemy?.name === 'string' && enemy.name.trim()
        ? enemy.name
        : `Enemy ${safeId}`;

      maxId = Math.max(maxId, safeId);

      return {
        id: safeId,
        name: safeName,
        skill: parseNumber(enemy.skill, 0, 0, 999),
        stamina: parseNumber(enemy.stamina, 0, 0, 999),
        modifiers: normalizeEnemyModifiers(enemy.modifiers),
        isCopy: Boolean(enemy.isCopy),
        copiedFromId: Number.isFinite(enemy.copiedFromId) ? enemy.copiedFromId : null
      };
    });
  }

  enemies.length = 0;
  enemies.push(...restored);
  nextEnemyId = Math.max(maxId + 1, nextEnemyId);
};

export const createCopiedEnemyFrom = (sourceEnemy) => ({
  name: `Copy of ${formatEnemyName(sourceEnemy)}`,
  skill: parseNumber(sourceEnemy?.skill, 0, 0, 999),
  stamina: parseNumber(sourceEnemy?.stamina, 0, 0, 999),
  modifiers: createDefaultEnemyModifiers(),
  isCopy: true,
  copiedFromId: Number.isFinite(sourceEnemy?.id) ? sourceEnemy.id : null
});

export const resolveCopiedCreatureAttack = (copyIndex, targetIndex, {
  logMessage,
  renderEnemies
}) => {
  const copied = enemies[copyIndex];
  const target = enemies[targetIndex];

  if (!copied || !target) {
    alert('One of the selected creatures is no longer available.');
    return;
  }

  if (copied.skill <= 0 || copied.stamina <= 0) {
    alert('Set Skill and Stamina for the copied creature before attacking.');
    return;
  }

  if (target.skill <= 0 || target.stamina <= 0) {
    alert('Set Skill and Stamina for the target before attacking.');
    return;
  }

  const copyRoll = rollDice(2) + copied.skill;
  const targetRoll = rollDice(2) + target.skill;
  logMessage(`${formatEnemyName(copied)} attacks ${formatEnemyName(target)}: ${copyRoll} vs ${targetRoll}.`, 'action');

  if (copyRoll === targetRoll) {
    logMessage('The copied creature trades feints with no damage dealt.', 'info');
    return;
  }

  const copyId = copied.id;
  const targetId = target.id;
  const damage = BASE_ENEMY_DAMAGE;

  if (copyRoll > targetRoll) {
    target.stamina = Math.max(0, target.stamina - damage);
    logMessage(`${formatEnemyName(target)} takes ${damage} damage from the copied creature.`, 'success');
    if (target.stamina === 0) {
      logMessage(`${formatEnemyName(target)} is defeated by the copied creature.`, 'success');
      removeEnemyById(targetId);
      return;
    }
  } else {
    copied.stamina = Math.max(0, copied.stamina - damage);
    logMessage(`${formatEnemyName(copied)} takes ${damage} damage.`, 'danger');
    if (copied.stamina === 0) {
      logMessage(`${formatEnemyName(copied)} is destroyed.`, 'warning');
      removeEnemyById(copyId);
      return;
    }
  }

  renderEnemies();
};

export const commandCopyAttack = async (copyIndex, { showEnemySelectModal, renderEnemies, logMessage }) => {
  const copied = enemies[copyIndex];
  if (!copied) {
    alert('Copied creature not found.');
    return;
  }

  const targetIndex = await showEnemySelectModal({
    title: 'Direct Copied Creature',
    description: `Choose a target for ${formatEnemyName(copied)}.`,
    filter: (enemy, index) => index !== copyIndex && !enemy.isCopy && enemy.stamina > 0,
    emptyMessage: 'No valid enemies to attack.',
    confirmLabel: 'Attack'
  });

  if (targetIndex === null) {
    return;
  }

  resolveCopiedCreatureAttack(copyIndex, targetIndex, { logMessage, renderEnemies });
};

export const handleCreatureCopySpell = async ({ showEnemySelectModal, renderEnemies, logMessage }) => {
  const targetIndex = await showEnemySelectModal({
    title: 'Creature Copy',
    description: 'Select an enemy to duplicate as your ally.',
    filter: (enemy) => !enemy.isCopy,
    emptyMessage: 'No eligible enemies to copy. Add a foe first.'
  });

  if (targetIndex === null) {
    return false;
  }

  const enemyToCopy = enemies[targetIndex];
  if (!enemyToCopy) {
    alert('That enemy is no longer available.');
    return false;
  }

  addEnemy(createCopiedEnemyFrom(enemyToCopy), { atTop: true });
  logMessage(`Creature Copy creates an ally from ${formatEnemyName(enemyToCopy)}.`, 'success');
  renderEnemies();
  return true;
};

export const escapeCombat = ({
  player,
  syncPlayerInputs,
  renderEnemies,
  showActionVisual,
  logMessage
}) => {
  if (!confirm('Are you sure you want to run away? You will lose 2 Stamina.')) {
    return;
  }
  player.stamina = clamp(player.stamina - 2, 0, player.maxStamina);
  syncPlayerInputs();
  logMessage('You escaped combat and lost 2 Stamina.', 'warning');
  const defeatedFromEscape = player.stamina === 0;
  if (defeatedFromEscape) {
    logMessage('You have been killed. Game Over.', 'danger');
    showActionVisual('loseCombat');
  } else {
    showActionVisual('escape', {
      subline: 'You escape, losing 2 Stamina.'
    });
  }
  renderEnemies();
};

export const performAttack = async (index, {
  player,
  playerModifiers,
  logMessage,
  showActionVisual,
  showActionVisualAndWait,
  promptLuckAfterPlayerHit,
  testLuck,
  syncPlayerInputs,
  renderEnemies
}) => {
  const enemy = enemies[index];
  if (!enemy) {
    alert('Enemy not found.');
    return;
  }

  if (enemy.skill <= 0 || enemy.stamina <= 0) {
    alert('Set enemy Skill and Stamina before attacking.');
    return;
  }

  const monsterAttack = rollDice(2) + enemy.skill;
  const playerAttack = rollDice(2) + Math.max(0, player.skill + playerModifiers.skillBonus);

  const enemyLabel = formatEnemyName(enemy);
  logMessage(`Combat vs ${enemyLabel}: Monster ${monsterAttack} vs Player ${playerAttack}.`, 'action');

  if (monsterAttack === playerAttack) {
    logMessage('Standoff! No damage dealt.', 'info');
    return;
  }

  let defeated = false;
  if (playerAttack > monsterAttack) {
    const damageToEnemy = calculateDamageToEnemy(enemy, playerModifiers);
    enemy.stamina = Math.max(0, enemy.stamina - damageToEnemy);
    logMessage(`You hit ${enemyLabel} for ${damageToEnemy} damage.`, 'success');
    showActionVisual('playerHitEnemy');
    defeated = enemy.stamina === 0;

    if (!defeated) {
      const wantsLuck = await promptLuckAfterPlayerHit(enemyLabel);
      if (wantsLuck) {
        testLuck({ type: 'playerHitEnemy', index });
        defeated = !enemies[index];
      }
    }
  } else {
    const damageToPlayer = calculateDamageToPlayer(enemy, playerModifiers);
    player.stamina = clamp(player.stamina - damageToPlayer, 0, player.maxStamina);
    syncPlayerInputs();
    logMessage(`${enemyLabel} hits you for ${damageToPlayer} damage.`, 'danger');

    await showActionVisualAndWait('playerFailAttack');

    const wantsLuck = confirm('You took damage. Use Luck to reduce it?');
    if (wantsLuck) {
      testLuck({ type: 'playerHitByEnemy', index });
    }

    if (player.stamina === 0) {
      logMessage('You have been killed. Game Over.', 'danger');
      showActionVisual('loseCombat');
    }
  }

  const enemyRemovedByLuck = !enemies.includes(enemy);

  if (defeated) {
    logMessage(`${enemyLabel} is defeated.`, 'success');
    showActionVisual('defeatEnemy');
    if (enemies.includes(enemy)) {
      removeEnemy(index);
    }
  } else if (enemyRemovedByLuck) {
    showActionVisual('defeatEnemy');
  } else {
    renderEnemies();
  }
};
