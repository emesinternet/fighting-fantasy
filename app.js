(() => {
'use strict';

// Core player state is tracked separately from the inputs so we can enforce maxima and potion effects.
  const player = {
    skill: 0,
    stamina: 0,
    luck: 0,
    maxSkill: 0,
    maxStamina: 0,
    maxLuck: 0,
    meals: 10,
    potion: null,
    potionUsed: false
  };

  // Track the unmodifiable starting maxima so we can surface them alongside the inputs.
  const initialStats = {
    skill: 0,
    stamina: 0,
    luck: 0
  };

  let enemies = [];

  const logEl = document.getElementById('log');
  const potionStatus = document.getElementById('potionStatus');
  const usePotionButton = document.getElementById('usePotion');

  // Animation overlay elements for action highlights.
  const animationOverlay = document.getElementById('action-overlay');
  const animationImage = document.getElementById('action-image');
  const animationText = document.getElementById('action-text');
  const animationTimers = [];

  const inputs = {
    skill: document.getElementById('skill'),
    stamina: document.getElementById('stamina'),
    luck: document.getElementById('luck'),
    meals: document.getElementById('meals')
  };

  const startingBadges = {
    skill: document.getElementById('starting-skill'),
    stamina: document.getElementById('starting-stamina'),
    luck: document.getElementById('starting-luck')
  };

  // Utility helpers --------------------------------------------------------
  const rollDice = (count) => Array.from({ length: count }, () => Math.floor(Math.random() * 6) + 1)
    .reduce((sum, value) => sum + value, 0);

  const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

  // Format log entries with safe markup and lightweight emphasis to make combat updates easy to scan.
  const escapeHtml = (text) => text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

  const emphasizeLogTokens = (message) => {
    let safe = escapeHtml(message);
    safe = safe.replace(/\b(\d+)\b/g, '<span class="log-number">$1</span>');
    safe = safe.replace(/\b(Lucky!?|Unlucky!?|Skill|Stamina|Luck|damage|defeated|restored|increased|escape|escaped|potion)\b/gi,
      '<span class="log-key">$1</span>');
    return safe;
  };

  const logMessage = (message) => {
    const entry = document.createElement('div');
    entry.className = 'log-entry';

    const timestamp = document.createElement('span');
    timestamp.className = 'log-timestamp';
    timestamp.textContent = `[${new Date().toLocaleTimeString()}]`;

    const body = document.createElement('span');
    body.className = 'log-body';
    body.innerHTML = emphasizeLogTokens(message);

    entry.appendChild(timestamp);
    entry.appendChild(body);

    if (logEl.firstChild) {
      logEl.insertBefore(entry, logEl.firstChild);
    } else {
      logEl.appendChild(entry);
    }

    // Keep the adventure log focused on the latest moments by trimming to five lines.
    while (logEl.childElementCount > 5) {
      logEl.removeChild(logEl.lastChild);
    }
  };

  const updateInitialStatsDisplay = () => {
    const formatStat = (value) => (value ? value : '-');
    startingBadges.skill.textContent = formatStat(initialStats.skill);
    startingBadges.stamina.textContent = formatStat(initialStats.stamina);
    startingBadges.luck.textContent = formatStat(initialStats.luck);
  };

  // Handle the overlay animation lifecycle: fade/slide in image, then text, hold, fade everything out.
  const clearAnimationTimers = () => {
    while (animationTimers.length) {
      clearTimeout(animationTimers.pop());
    }
  };

  const resetAnimationClasses = () => {
    animationImage.classList.remove('animate-in', 'animate-out');
    animationText.classList.remove('animate-in', 'animate-out');
  };

  const fadeOutAnimation = () => {
    animationImage.classList.remove('animate-in');
    animationText.classList.remove('animate-in');
    animationImage.classList.add('animate-out');
    animationText.classList.add('animate-out');
    animationOverlay.classList.remove('is-visible');
    animationOverlay.setAttribute('aria-hidden', 'true');
  };

  // Allow the player to dismiss the overlay immediately without waiting for fades or timers.
  const closeAnimationOverlayInstantly = () => {
    clearAnimationTimers();
    resetAnimationClasses();

    const previousTransition = animationOverlay.style.transition;
    animationOverlay.style.transition = 'none';
    animationOverlay.classList.remove('is-visible');
    animationOverlay.setAttribute('aria-hidden', 'true');
    // Force style recalculation so the removal takes effect before restoring transitions.
    void animationOverlay.offsetHeight; // eslint-disable-line no-unused-expressions
    animationOverlay.style.transition = previousTransition;
  };

  const playActionAnimation = () => {
    clearAnimationTimers();
    resetAnimationClasses();

    // Restart keyframes reliably on consecutive plays.
    void animationImage.offsetWidth; // eslint-disable-line no-unused-expressions
    void animationText.offsetWidth; // eslint-disable-line no-unused-expressions

    animationOverlay.classList.add('is-visible');
    animationOverlay.setAttribute('aria-hidden', 'false');

    animationTimers.push(setTimeout(() => {
      animationImage.classList.add('animate-in');
    }, 40));

    animationTimers.push(setTimeout(() => {
      animationText.classList.add('animate-in');
    }, 220));

    const entryDurationMs = 900; // Covers image and text stagger.
    const holdDurationMs = 2000;
    const fadeDurationMs = 360;

    animationTimers.push(setTimeout(fadeOutAnimation, entryDurationMs + holdDurationMs));
    animationTimers.push(setTimeout(resetAnimationClasses, entryDurationMs + holdDurationMs + fadeDurationMs));
  };

  // Map game moments to inline action art so the overlay always reinforces the latest move.
  const actionVisuals = {
    newGame: {
      src: 'img/player-new-game.png',
      alt: 'An adventurer prepares for a fresh quest',
      subline: 'A new adventure begins.'
    },
    eatMeal: {
      src: 'img/player-eat-meal.png',
      alt: 'The hero takes time to eat and recover',
      subline: 'You regain strength from a meal.'
    },
    drinkPotion: {
      src: 'img/player-drink-potion.png',
      alt: 'The hero drinks a potion',
      subline: 'Potion power surges through you.'
    },
    escape: {
      src: 'img/player-escape-battle.png',
      alt: 'The hero slips away from battle',
      subline: 'You escape, losing 2 Stamina.'
    },
    blockEnemy: {
      src: 'img/player-block-enemy.png',
      alt: 'The hero blocks an enemy strike',
      subline: 'Lucky block, restore 1 stamina'
    },
    enemyHitYou: {
      src: 'img/player-fail-block-enemy.png',
      alt: 'The hero is struck by an enemy',
      subline: 'Unlocky block, lose 1 stamina.'
    },
    playerHitEnemy: {
      src: 'img/player-hit-enemy.png',
      alt: 'The hero lands a hit on an enemy',
      subline: 'Your strike land!'
    },
    playerMissEnemy: {
      src: 'img/player-miss-enemy.png',
      alt: 'The hero misses an enemy attack',
      subline: 'Your strike misses'
    },
    defeatEnemy: {
      src: 'img/player-defeat-enemy.png',
      alt: 'The hero fells an enemy',
      subline: 'Another foe is vanquished.'
    },
    loseCombat: {
      src: 'img/player-lose-combat.png',
      alt: 'The hero reels from combat',
      subline: 'You have been killed. Game Over.'
    },
    lose: {
      src: 'img/player-lose.png',
      alt: 'The hero collapses from defeat',
      subline: 'Game Over.'
    },
    win: {
      src: 'img/player-win.png',
      alt: 'The hero celebrates victory',
      subline: 'You completed the adventure!'
    },
    lucky: {
      src: 'img/player-lucky-general.png',
      alt: 'The hero is blessed by luck',
      subline: 'Luck smiles upon you.'
    },
    unlucky: {
      src: 'img/player-unlucky-general.png',
      alt: 'The hero suffers an unlucky turn',
      subline: 'Fortune turns away.'
    }
  };

  const animationTesterSelect = document.getElementById('animationScenario');

  // Human-friendly labels keep the animation tester dropdown aligned with how each image is used in-game.
  const actionVisualLabels = {
    newGame: 'New game setup',
    eatMeal: 'Eat Meal recovery',
    drinkPotion: 'Use Potion',
    escape: 'Escape Combat',
    blockEnemy: 'Player blocks enemy hit',
    enemyHitYou: 'Player takes a hit',
    playerHitEnemy: 'Player hits enemy',
    playerMissEnemy: 'Player misses enemy',
    defeatEnemy: 'Enemy defeated',
    loseCombat: 'Combat defeat (0 Stamina)',
    lose: 'Game Over (non-combat)',
    win: 'Player victory',
    lucky: 'Lucky roll',
    unlucky: 'Unlucky roll'
  };

  if (animationTesterSelect) {
    Object.entries(actionVisualLabels).forEach(([key, label]) => {
      const option = document.createElement('option');
      option.value = key;
      option.textContent = label;
      animationTesterSelect.appendChild(option);
    });
  }

  const showActionVisual = (key, overrides = {}) => {
    const visual = actionVisuals[key];
    if (!visual) {
      return;
    }
    const subline = overrides.subline || visual.subline;
    animationImage.src = visual.src;
    animationImage.alt = overrides.alt || visual.alt;
    animationText.textContent = subline;
    playActionAnimation();
  };

  animationOverlay.addEventListener('click', closeAnimationOverlayInstantly);

  // Lightweight modal scaffolding to keep dialog creation tidy.
  const createModal = (title, description) => {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    const modal = document.createElement('div');
    modal.className = 'modal';

    const heading = document.createElement('h3');
    heading.textContent = title;
    modal.appendChild(heading);

    if (description) {
      const desc = document.createElement('p');
      desc.textContent = description;
      modal.appendChild(desc);
    }

    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    return { overlay, modal, close: () => overlay.remove() };
  };

  const syncPlayerInputs = () => {
    inputs.skill.value = player.skill;
    inputs.stamina.value = player.stamina;
    inputs.luck.value = player.luck;
    inputs.meals.value = player.meals;
    renderPotionStatus();
  };

  const bindPlayerInputs = () => {
    // Allow manual adjustments while keeping track of maxima for restoration effects.
    inputs.skill.addEventListener('change', () => {
      player.skill = clamp(parseInt(inputs.skill.value, 10) || 0, 0, 999);
      player.maxSkill = Math.max(player.maxSkill, player.skill);
      inputs.skill.value = player.skill;
    });
    inputs.stamina.addEventListener('change', () => {
      player.stamina = clamp(parseInt(inputs.stamina.value, 10) || 0, 0, 999);
      player.maxStamina = Math.max(player.maxStamina, player.stamina);
      inputs.stamina.value = player.stamina;
    });
    inputs.luck.addEventListener('change', () => {
      player.luck = clamp(parseInt(inputs.luck.value, 10) || 0, 0, 999);
      player.maxLuck = Math.max(player.maxLuck, player.luck);
      inputs.luck.value = player.luck;
    });
    inputs.meals.addEventListener('change', () => {
      player.meals = clamp(parseInt(inputs.meals.value, 10) || 0, 0, 999);
      syncPlayerInputs();
    });
  };

  const renderPotionStatus = () => {
    if (!player.potion) {
      potionStatus.textContent = 'No potion selected.';
      usePotionButton.disabled = true;
      return;
    }
    const used = player.potionUsed ? ' (used)' : '';
    potionStatus.textContent = `${player.potion}${used}`;
    usePotionButton.disabled = player.potionUsed;
  };

  const statConfigs = {
    skill: {
      label: 'Skill',
      roll: () => {
        const dice = rollDice(1);
        const total = dice + 6;
        return { total, detail: `${dice} + 6 = ${total}` };
      },
      helper: 'Roll 1D6 + 6'
    },
    stamina: {
      label: 'Stamina',
      roll: () => {
        const dice = rollDice(2);
        const total = dice + 12;
        return { total, detail: `${dice} + 12 = ${total}` };
      },
      helper: 'Roll 2D6 + 12'
    },
    luck: {
      label: 'Luck',
      roll: () => {
        const dice = rollDice(1);
        const total = dice + 6;
        return { total, detail: `${dice} + 6 = ${total}` };
      },
      helper: 'Roll 1D6 + 6'
    }
  };

  // Allow the player to roll each stat multiple times before accepting the spread.
  const showStatRollDialog = (onComplete) => {
    const { modal, close } = createModal('Roll Your Stats', 'Roll each stat as many times as you like, then start your adventure.');

    const grid = document.createElement('div');
    grid.className = 'grid-three';
    const applyButton = document.createElement('button');
    applyButton.textContent = 'Start Adventure';
    applyButton.disabled = true;

    const cancelButton = document.createElement('button');
    cancelButton.textContent = 'Cancel';

    const currentRolls = { skill: null, stamina: null, luck: null };

    const updateApplyState = () => {
      applyButton.disabled = !Object.values(currentRolls).every((value) => value !== null);
    };

    Object.entries(statConfigs).forEach(([key, config]) => {
      const card = document.createElement('div');
      card.className = 'option-card';

      const title = document.createElement('h4');
      title.textContent = config.label;
      card.appendChild(title);

      const value = document.createElement('div');
      value.className = 'stat-value';
      value.textContent = '-';
      card.appendChild(value);

      const detail = document.createElement('p');
      detail.className = 'helper-text';
      detail.textContent = config.helper;
      card.appendChild(detail);

      const rollButton = document.createElement('button');
      rollButton.textContent = 'Roll';
      rollButton.addEventListener('click', () => {
        const result = config.roll();
        currentRolls[key] = result.total;
        value.textContent = result.total;
        detail.textContent = `Rolled ${result.detail}`;
        updateApplyState();
      });
      card.appendChild(rollButton);

      grid.appendChild(card);
    });

    modal.appendChild(grid);

    const actions = document.createElement('div');
    actions.className = 'modal-actions';
    actions.appendChild(cancelButton);
    actions.appendChild(applyButton);
    modal.appendChild(actions);

    cancelButton.addEventListener('click', () => {
      close();
    });

    applyButton.addEventListener('click', () => {
      close();
      onComplete(currentRolls);
    });
  };

  const potionOptions = [
    { name: 'Potion of Skill', description: 'Restores Skill to its starting maximum when used.' },
    { name: 'Potion of Strength', description: 'Restores Stamina to its starting maximum when used.' },
    { name: 'Potion of Fortune', description: 'Restores Luck and increases your maximum Luck by 1.' }
  ];

  const showPotionDialog = (onSelect, onCancel) => {
    const { modal, close } = createModal('Choose Your Potion', 'Pick one potion to bring on your adventure.');
    const grid = document.createElement('div');
    grid.className = 'grid-three';
    let selected = null;

    const cards = potionOptions.map((option) => {
      const card = document.createElement('div');
      card.className = 'option-card';

      const heading = document.createElement('h4');
      heading.textContent = option.name;
      card.appendChild(heading);

      const info = document.createElement('p');
      info.textContent = option.description;
      card.appendChild(info);

      const chooseButton = document.createElement('button');
      chooseButton.textContent = 'Select';
      chooseButton.addEventListener('click', () => {
        selected = option.name;
        cards.forEach((c) => c.card.classList.remove('selected'));
        card.classList.add('selected');
      });
      card.appendChild(chooseButton);

      return { card };
    });

    cards.forEach(({ card }) => grid.appendChild(card));
    modal.appendChild(grid);

    const actions = document.createElement('div');
    actions.className = 'modal-actions';
    const confirmButton = document.createElement('button');
    confirmButton.textContent = 'Confirm';
    const cancelButton = document.createElement('button');
    cancelButton.textContent = 'Cancel';

    cancelButton.addEventListener('click', () => {
      close();
      if (onCancel) {
        onCancel();
      }
    });
    confirmButton.addEventListener('click', () => {
      if (!selected) {
        alert('Please select a potion to continue.');
        return;
      }
      close();
      onSelect(selected);
    });

    actions.appendChild(cancelButton);
    actions.appendChild(confirmButton);
    modal.appendChild(actions);
  };

  // Offer context-aware Luck testing with clear options and enemy targeting.
  const showLuckDialog = () => {
    const { modal, close } = createModal('Test Your Luck', 'Choose when you want to apply Luck.');
    const grid = document.createElement('div');
    grid.className = 'grid-three';

    const enemySelect = document.createElement('select');
    enemySelect.style.width = '100%';

    if (enemies.length === 0) {
      const option = document.createElement('option');
      option.textContent = 'No enemies available';
      option.disabled = true;
      option.selected = true;
      enemySelect.appendChild(option);
      enemySelect.disabled = true;
    } else {
      enemies.forEach((enemy, index) => {
        const option = document.createElement('option');
        option.value = index;
        option.textContent = `Enemy ${index + 1} (Skill ${enemy.skill || 0}, Stamina ${enemy.stamina || 0})`;
        enemySelect.appendChild(option);
      });
    }

    const options = [
      {
        key: 'general',
        title: 'General Test',
        description: 'Roll Luck for a standard check with no combat adjustments.',
        content: null,
        handler: () => {
          testLuck();
          return true;
        }
      },
      {
        key: 'afterDamage',
        title: 'After Taking Damage',
        description: 'Attempt to soften or worsen damage you received.',
        content: null,
        handler: () => {
          testLuck({ type: 'playerHitByEnemy' });
          return true;
        }
      },
      {
        key: 'afterHit',
        title: 'After Hitting an Enemy',
        description: 'Try to amplify damage you just dealt.',
        content: enemySelect,
        handler: () => {
          if (!enemies.length || enemySelect.disabled) {
            alert('No enemy is available for this Luck test.');
            return false;
          }
          const targetIndex = parseInt(enemySelect.value, 10);
          if (Number.isNaN(targetIndex)) {
            alert('Select an enemy to continue.');
            return false;
          }
          testLuck({ type: 'playerHitEnemy', index: targetIndex });
          return true;
        }
      }
    ];

    const cards = options.map((option) => {
      const card = document.createElement('div');
      card.className = 'option-card';

      const heading = document.createElement('h4');
      heading.textContent = option.title;
      card.appendChild(heading);

      const description = document.createElement('p');
      description.textContent = option.description;
      card.appendChild(description);

      if (option.content) {
        const helper = document.createElement('p');
        helper.className = 'helper-text';
        helper.textContent = 'Select the enemy this Luck test applies to.';
        card.appendChild(helper);
        card.appendChild(option.content);
      }

      const chooseButton = document.createElement('button');
      chooseButton.textContent = 'Roll Luck';
      chooseButton.addEventListener('click', () => {
        const handled = option.handler();
        if (handled !== false) {
          close();
        }
      });
      if (option.key === 'afterHit' && enemySelect.disabled) {
        chooseButton.disabled = true;
      }
      card.appendChild(chooseButton);

      return { card };
    });

    cards.forEach(({ card }) => grid.appendChild(card));
    modal.appendChild(grid);

    const actions = document.createElement('div');
    actions.className = 'modal-actions';
    const cancelButton = document.createElement('button');
    cancelButton.textContent = 'Close';
    cancelButton.addEventListener('click', close);

    actions.appendChild(cancelButton);
    modal.appendChild(actions);
  };

  // Player interactions ----------------------------------------------------
  const handleEatMeal = () => {
    if (player.meals <= 0) {
      alert('No meals left.');
      return;
    }
    player.meals -= 1;
    player.stamina = clamp(player.stamina + 4, 0, player.maxStamina);
    syncPlayerInputs();
    logMessage('You eat a meal and regain 4 Stamina.');
    showActionVisual('eatMeal');
  };

  const escapeCombat = () => {
    if (!confirm('Are you sure you want to run away? You will lose 2 Stamina.')) {
      return;
    }
    player.stamina = clamp(player.stamina - 2, 0, player.maxStamina);
    syncPlayerInputs();
    logMessage('You escaped combat and lost 2 Stamina.');
    const defeatedFromEscape = player.stamina === 0;
    if (defeatedFromEscape) {
      logMessage('You have been killed. Game Over.');
      showActionVisual('loseCombat');
    } else {
      showActionVisual('escape', {
        subline: 'You escape, losing 2 Stamina.'
      });
    }
  };

  // Enemy handling --------------------------------------------------------
  function renderEnemies() {
    const container = document.getElementById('monsterList');
    container.innerHTML = '';

    enemies.forEach((enemy, index) => {
      const box = document.createElement('div');
      box.className = 'enemy-box';

      const title = document.createElement('strong');
      title.textContent = `Enemy ${index + 1}`;
      box.appendChild(title);

      const stats = document.createElement('div');
      stats.className = 'enemy-stats';

      const skillLabel = document.createElement('label');
      skillLabel.className = 'inline-label';
      skillLabel.textContent = 'Skill ';
      const skillInput = document.createElement('input');
      skillInput.type = 'number';
      skillInput.value = enemy.skill;
      skillInput.max = 999;
      skillInput.min = 0;
      skillInput.addEventListener('change', () => {
        const nextSkill = clamp(parseInt(skillInput.value, 10) || 0, 0, 999);
        enemy.skill = nextSkill;
        skillInput.value = nextSkill;
      });
      skillLabel.appendChild(skillInput);
      stats.appendChild(skillLabel);

      const staminaLabel = document.createElement('label');
      staminaLabel.className = 'inline-label';
      staminaLabel.textContent = 'Stamina ';
      const staminaInput = document.createElement('input');
      staminaInput.type = 'number';
      staminaInput.value = enemy.stamina;
      staminaInput.max = 999;
      staminaInput.min = 0;
      staminaInput.addEventListener('change', () => {
        const nextStamina = clamp(parseInt(staminaInput.value, 10) || 0, 0, 999);
        enemy.stamina = nextStamina;
        staminaInput.value = nextStamina;
      });
      staminaLabel.appendChild(staminaInput);
      stats.appendChild(staminaLabel);

      box.appendChild(stats);

      const actions = document.createElement('div');
      actions.className = 'enemy-actions';

      const attackButton = document.createElement('button');
      attackButton.textContent = 'Attack';
      attackButton.className = 'attack-button';
      attackButton.addEventListener('click', () => performAttack(index));
      actions.appendChild(attackButton);

      const removeButton = document.createElement('button');
      removeButton.textContent = 'Remove';
      removeButton.className = 'remove-button';
      removeButton.addEventListener('click', () => removeEnemy(index));
      actions.appendChild(removeButton);

      box.appendChild(actions);
      container.appendChild(box);
    });
  }

  function addEnemy(initial = { skill: 0, stamina: 0 }) {
    enemies.push({ ...initial });
    renderEnemies();
  }

  function removeEnemy(index) {
    enemies.splice(index, 1);
    renderEnemies();
  }

  // Luck handling ----------------------------------------------------------
  const testLuck = (context) => {
    if (player.luck <= 0) {
      alert('You have no Luck remaining.');
      return { outcome: 'none', lucky: false };
    }

    const roll = rollDice(2);
    const isLucky = roll <= player.luck;
    player.luck = Math.max(0, player.luck - 1);
    syncPlayerInputs();
    logMessage(`Testing Luck: rolled ${roll} vs Luck ${player.luck + 1}. ${isLucky ? 'Lucky!' : 'Unlucky.'}`);

    const isPlayerHittingEnemy = context?.type === 'playerHitEnemy';
    const isPlayerHitByEnemy = context?.type === 'playerHitByEnemy';

    let luckSubline = isLucky ? 'Luck holds firm.' : 'Luck slips away.';
    if (isPlayerHittingEnemy) {
      luckSubline = isLucky ? 'Extra damage lands true.' : 'The foe steadies.';
    } else if (isPlayerHitByEnemy) {
      luckSubline = isLucky ? 'You soften the blow.' : 'The wound deepens.';
    }

    // Only play the general luck animation when this is not a combat mitigation test, so the
    // combat-specific art can stay focused on the block and failed block outcomes.
    if (!isPlayerHitByEnemy) {
      showActionVisual(isLucky ? 'lucky' : 'unlucky', { subline: luckSubline });
    }

    if (!context) {
      return { outcome: 'general', lucky: isLucky };
    }

    if (context.type === 'playerHitEnemy') {
      const enemy = enemies[context.index];
      if (!enemy) {
        logMessage('The selected enemy is no longer present.');
        return { outcome: 'missing', lucky: isLucky };
      }

      const adjustment = isLucky ? -2 : 1;
      enemy.stamina = Math.max(0, enemy.stamina + adjustment);
      logMessage(isLucky ? 'Lucky strike! Enemy loses an additional 2 Stamina.' : 'Unlucky! Enemy regains 1 Stamina.');

      if (enemy.stamina === 0) {
        logMessage(`Enemy ${context.index + 1} is defeated.`);
        removeEnemy(context.index);
      } else {
        renderEnemies();
      }
    } else if (context.type === 'playerHitByEnemy') {
      const adjustment = isLucky ? 1 : -1;
      player.stamina = clamp(player.stamina + adjustment, 0, player.maxStamina);
      syncPlayerInputs();
      logMessage(isLucky ? 'Lucky! You reduce the damage by gaining 1 Stamina.' : 'Unlucky! You lose an additional 1 Stamina.');
      showActionVisual(isLucky ? 'blockEnemy' : 'enemyHitYou');
    }
    return { outcome: context.type, lucky: isLucky };
  };

  // Combat handling -------------------------------------------------------
  function performAttack(index) {
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
    const playerAttack = rollDice(2) + player.skill;

    logMessage(`Combat roll vs Enemy ${index + 1}: Monster ${monsterAttack} vs Player ${playerAttack}.`);

    if (monsterAttack === playerAttack) {
      logMessage('Standoff! No damage dealt.');
      return;
    }

    let defeated = false;
    if (playerAttack > monsterAttack) {
      enemy.stamina = Math.max(0, enemy.stamina - 2);
      logMessage('You hit the enemy for 2 damage.');
      showActionVisual('playerHitEnemy');
      defeated = enemy.stamina === 0;

      if (!defeated) {
        const wantsLuck = confirm('You wounded the enemy. Use Luck for extra damage?');
        if (wantsLuck) {
          testLuck({ type: 'playerHitEnemy', index });
          defeated = !enemies[index];
        }
      }
    } else {
      player.stamina = clamp(player.stamina - 2, 0, player.maxStamina);
      syncPlayerInputs();
      logMessage('The enemy hits you for 2 damage.');
      const wantsLuck = confirm('You took damage. Use Luck to reduce it?');
      if (wantsLuck) {
        testLuck({ type: 'playerHitByEnemy', index });
      }

      // Only trigger the combat defeat art once Luck adjustments settle on zero Stamina.
      if (player.stamina === 0) {
        logMessage('You have been killed. Game Over.');
        showActionVisual('loseCombat');
      }
    }

    if (defeated) {
      logMessage(`Enemy ${index + 1} is defeated.`);
      showActionVisual('defeatEnemy');
      removeEnemy(index);
    } else {
      renderEnemies();
    }
  }

  // Game setup ------------------------------------------------------------
  const applyPotion = () => {
    if (!player.potion || player.potionUsed) {
      alert('No potion available or it has already been used.');
      return;
    }
    let potionSubline = 'Potion restores your vigor.';
    if (player.potion === 'Potion of Skill') {
      player.skill = player.maxSkill;
      logMessage('Potion of Skill used. Skill restored to max.');
      potionSubline = 'Skill returns to its peak.';
    } else if (player.potion === 'Potion of Strength') {
      player.stamina = player.maxStamina;
      logMessage('Potion of Strength used. Stamina restored to max.');
      potionSubline = 'Stamina surges to full.';
    } else if (player.potion === 'Potion of Fortune') {
      player.maxLuck += 1;
      player.luck = player.maxLuck;
      logMessage('Potion of Fortune used. Luck increased and restored.');
      initialStats.luck = player.maxLuck;
      updateInitialStatsDisplay();
      potionSubline = 'Luck rises and refills.';
    }
    player.potionUsed = true;
    syncPlayerInputs();
    renderPotionStatus();
    showActionVisual('drinkPotion', { subline: potionSubline });
  };

  const selectPotion = (onSelected) => {
    showPotionDialog((choice) => {
      player.potion = choice;
      player.potionUsed = false;
      logMessage(`${player.potion} selected.`);
      renderPotionStatus();
      if (onSelected) {
        onSelected();
      }
    }, () => {
      alert('Choose a potion to start your adventure.');
      selectPotion(onSelected);
    });
  };

  const newGame = () => {
    showStatRollDialog((rolls) => {
      player.skill = player.maxSkill = rolls.skill;
      player.stamina = player.maxStamina = rolls.stamina;
      player.luck = player.maxLuck = rolls.luck;
      player.meals = 10;
      player.potion = null;
      player.potionUsed = false;

      initialStats.skill = rolls.skill;
      initialStats.stamina = rolls.stamina;
      initialStats.luck = rolls.luck;
      updateInitialStatsDisplay();

      document.getElementById('gold').value = '';
      document.getElementById('treasure').value = '';
      document.getElementById('equipment').value = '';
      document.getElementById('provisions').value = '';

      enemies = [];
      addEnemy();
      addEnemy();
      addEnemy();
      syncPlayerInputs();
      logMessage('New game started. Roll results applied.');
      renderPotionStatus();
      selectPotion(() => showActionVisual('newGame'));
    });
  };

  // Allow non-combat failures to showcase the dedicated defeat art without altering stats.
  const playGameOverVisual = () => {
    logMessage('Game Over triggered outside combat.');
    showActionVisual('lose');
  };

  // Wiring ----------------------------------------------------------------
  document.getElementById('eatMeal').addEventListener('click', handleEatMeal);
  document.getElementById('escape').addEventListener('click', escapeCombat);
  document.getElementById('testLuck').addEventListener('click', showLuckDialog);
  document.getElementById('newGame').addEventListener('click', newGame);
  document.getElementById('gameOver').addEventListener('click', playGameOverVisual);
  document.getElementById('usePotion').addEventListener('click', applyPotion);
  document.getElementById('testAnimation').addEventListener('click', () => {
    const scenario = animationTesterSelect ? animationTesterSelect.value : 'win';
    if (!scenario || !actionVisuals[scenario]) {
      alert('Select an action art scenario to preview.');
      return;
    }
    showActionVisual(scenario);
  });

  document.getElementById('addEnemy').addEventListener('click', () => addEnemy());
  bindPlayerInputs();
  addEnemy();
  addEnemy();
  addEnemy();

  updateInitialStatsDisplay();
  renderPotionStatus();
  syncPlayerInputs();
})();
