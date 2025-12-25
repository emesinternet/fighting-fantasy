(() => {
  'use strict';

  const {
    rollDice,
    clamp,
    parseNumber
  } = window.ffApp.utils;
  const {
    BOOK_OPTIONS,
    BOOK_RULES,
    potionOptions,
    generalRollOptions,
    baseStatConfigs
  } = window.ffApp.constants;
  const {
    bindDefaultEnterAction,
    createModal,
    showActionVisual,
    showActionVisualAndWait
  } = window.ffApp.ui;
  const {
    getMapDrawing,
    setMapDrawing,
    resetMapDrawing,
    showMapDialog
  } = window.ffApp.map;
  const { onClick, byId } = window.ffApp.dom;
  const logs = window.ffApp.logs;
  const { logMessage } = logs;
  const { showSaveDialog, handleLoadFile } = window.ffApp.persistence;
  const spellsModule = window.ffApp.spells;
  const state = window.ffApp.state;
  const { player, playerModifiers, initialStats, logHistory, decisionLogHistory } = state;

  // Preserve stable enemy identifiers so names do not shift when the list changes.
  let enemies = state.enemies;
  let nextEnemyId = state.nextEnemyId;
  let preparedSpells = state.preparedSpells;
  let preparedSpellLimit = state.preparedSpellLimit;
  let currentBook = state.currentBook || '';
  // Keep state mutations in sync with the shared container used across dialogs.
  const syncEnemies = () => {
    state.enemies = enemies;
    state.nextEnemyId = nextEnemyId;
  };
  const syncPreparedSpells = () => {
    state.preparedSpells = preparedSpells;
    state.preparedSpellLimit = preparedSpellLimit;
  };
  const syncCurrentBook = () => {
    state.currentBook = currentBook;
  };

  const logEl = document.getElementById('log');
  const LOG_HISTORY_LIMIT = 1000;
  const decisionLogEl = document.getElementById('decisionLog');
  const DECISION_LOG_HISTORY_LIMIT = 1000;
  const loadFileInput = document.getElementById('loadFileInput');
  const potionStatus = document.getElementById('potionStatus');
  const usePotionButton = document.getElementById('usePotion');
  const playerModifierChip = document.getElementById('playerModifierChip');
  const mealControls = document.getElementById('mealControls');
  const potionControls = document.getElementById('potionControls');
  const spellsWrapper = document.getElementById('spellsWrapper');
  const spellsPanel = document.getElementById('spellsPanel');
  const spellsTable = document.getElementById('spellsTable');
  const spellsRemaining = document.getElementById('spellsRemaining');

  const inputs = {
    skill: document.getElementById('skill'),
    stamina: document.getElementById('stamina'),
    luck: document.getElementById('luck'),
    magic: document.getElementById('magic'),
    meals: document.getElementById('meals')
  };

  const startingBadges = {
    skill: document.getElementById('starting-skill'),
    stamina: document.getElementById('starting-stamina'),
    luck: document.getElementById('starting-luck'),
    magic: document.getElementById('starting-magic')
  };

  const notes = {
    gold: document.getElementById('gold'),
    treasure: document.getElementById('treasure'),
    equipment: document.getElementById('equipment')
  };

  // Keep note fields tidy with a shared reset helper for new games.
  const resetNotes = () => {
    Object.values(notes).forEach((field) => {
      field.value = '';
    });
  };

  // Standard Fighting Fantasy combat deals 2 Stamina damage per successful hit.
  const BASE_ENEMY_DAMAGE = 2;

  const createDefaultEnemyModifiers = () => ({
    damageDealt: 0,
    damageReceived: 0,
    playerDamageBonus: 0,
    playerDamageTakenBonus: 0,
    mode: 'delta'
  });

  const normalizeEnemyModifiers = (modifiers = {}) => {
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

  const getEnemyModifiers = (enemy) => normalizeEnemyModifiers(enemy?.modifiers || createDefaultEnemyModifiers());

  const findEnemyIndexById = (id) => enemies.findIndex((enemy) => enemy.id === id);

  const removeEnemyById = (id) => {
    const index = findEnemyIndexById(id);
    if (index >= 0) {
      removeEnemy(index);
    }
  };

  // Keep enemy naming consistent for logs, defaulting to a stable identifier if a custom name is missing.
  const formatEnemyName = (enemy) => {
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
  const formatEnemyOptionLabel = (enemy) => `${formatEnemyName(enemy)} (Skill ${enemy.skill || 0}, Stamina ${enemy.stamina || 0})`;

  const updateInitialStatsDisplay = () => {
    const formatStat = (value) => (value ? value : '-');
    if (startingBadges.skill) startingBadges.skill.textContent = formatStat(initialStats.skill);
    if (startingBadges.stamina) startingBadges.stamina.textContent = formatStat(initialStats.stamina);
    if (startingBadges.luck) startingBadges.luck.textContent = formatStat(initialStats.luck);
    if (startingBadges.magic) startingBadges.magic.textContent = formatStat(initialStats.magic);
  };

  const updateStatVisibility = () => {
    const hasMagic = Boolean(activeStatConfigs().magic);
    const magicLabel = document.getElementById('magic-stat');
    if (magicLabel) {
      magicLabel.classList.toggle('hidden', !hasMagic);
    }
  };

  const setCurrentBook = (bookName) => {
    currentBook = bookName || '';
    syncCurrentBook();
  };

  const renderCurrentBook = () => {
    const baseTitle = 'Fighting Fantasy Companion';
    document.title = currentBook ? `${currentBook} | ${baseTitle}` : baseTitle;
  };

  const getActiveBookRules = () => BOOK_RULES[currentBook] || {};
  const potionsEnabled = () => getActiveBookRules().supportsPotions !== false;
  const mealsEnabled = () => getActiveBookRules().supportsMeals !== false;
  const activeSpells = () => Array.isArray(getActiveBookRules().spells) ? getActiveBookRules().spells : [];
  const activeStatConfigs = () => ({ ...baseStatConfigs, ...(getActiveBookRules().extraStats || {}) });
  const activeSpellLimitStat = () => getActiveBookRules().spellLimitStat;
  window.ffApp.getActiveSpells = activeSpells;
  window.ffApp.getActiveSpellLimitStat = activeSpellLimitStat;

  const getNotesState = () => ({
    gold: notes.gold.value,
    treasure: notes.treasure.value,
    equipment: notes.equipment.value
  });

  const applyNotesState = (savedNotes = {}) => {
    Object.entries(notes).forEach(([key, element]) => {
      element.value = savedNotes[key] || '';
    });
  };

  const getMapState = () => ({
    image: getMapDrawing() || null
  });

  const applyMapState = (savedMap = {}) => {
    setMapDrawing(typeof savedMap.image === 'string' ? savedMap.image : '');
  };

  const renderSpellsPanel = () => {
    if (!spellsPanel || !spellsTable) {
      return;
    }
    const spellsAvailable = activeSpells();
    const supportsSpells = spellsAvailable.length > 0;
    if (spellsRemaining) {
      spellsRemaining.textContent = '-';
      spellsRemaining.title = supportsSpells
        ? 'Edit prepared spells'
        : 'Spells are unavailable for this adventure.';
    }
    if (spellsWrapper) {
      spellsWrapper.classList.toggle('hidden', !supportsSpells);
    }
    spellsPanel.classList.toggle('hidden', !supportsSpells);
    spellsTable.innerHTML = '';

    if (!supportsSpells) {
      preparedSpells = {};
      preparedSpellLimit = 0;
      if (spellsRemaining) {
        spellsRemaining.textContent = '-';
      }
      return;
    }

    const activePrepared = Object.entries(preparedSpells)
      .map(([key, count]) => {
        const spellDef = spellsAvailable.find((spell) => spell.key === key);
        return spellDef ? { ...spellDef, count } : null;
      })
      .filter((entry) => entry && entry.count > 0);

    if (!activePrepared.length) {
      const empty = document.createElement('p');
      empty.className = 'spells-empty';
      empty.textContent = 'No spells prepared.';
      spellsTable.appendChild(empty);
    } else {
      activePrepared.forEach((spell) => {
        const row = document.createElement('button');
        row.className = 'spell-row';
        row.type = 'button';
        row.setAttribute('aria-label', `Cast ${spell.name} (${spell.count} remaining)`);
        row.addEventListener('click', () => castSpell(spell.key));

        const header = document.createElement('div');
        header.className = 'spell-row-header';

        const text = document.createElement('div');
        text.className = 'spell-row-body';
        const title = document.createElement('h5');
        title.textContent = spell.name;
        header.appendChild(title);

        const description = document.createElement('p');
        description.textContent = spell.description;
        description.title = spell.description;

        const count = document.createElement('div');
        count.className = 'spell-count';
        count.textContent = `x${spell.count}`;

        header.appendChild(count);
        text.appendChild(header);
        text.appendChild(description);

        row.appendChild(text);
        spellsTable.appendChild(row);
      });
    }

    // Keep spells hidden for books that do not support them while surfacing remaining casts for active adventures.
    const remainingTotal = activePrepared.reduce((sum, spell) => sum + (spell.count || 0), 0);

    if (spellsRemaining) {
      spellsRemaining.textContent = `${remainingTotal} left`;
      spellsRemaining.title = 'Edit prepared spells';
    }
  };

  const resetSpells = () => {
    preparedSpells = {};
    preparedSpellLimit = 0;
    syncPreparedSpells();
    renderSpellsPanel();
  };

  const applySpellsState = (savedSpells = {}) => {
    preparedSpellLimit = parseNumber(savedSpells.limit, initialStats.magic || player.magic || 0, 0, 999);
    preparedSpells = {};
    const allowed = new Set(activeSpells().map((spell) => spell.key));
    if (savedSpells.prepared && typeof savedSpells.prepared === 'object') {
      Object.entries(savedSpells.prepared).forEach(([key, value]) => {
        const amount = parseNumber(value, 0, 0, 999);
        if (amount > 0 && allowed.has(key)) {
          preparedSpells[key] = amount;
        }
      });
    }
    syncPreparedSpells();
    renderSpellsPanel();
  };

  // Let players correct spell prep without restarting the adventure.
  const managePreparedSpells = () => {
    const spellsAvailable = activeSpells();
    if (!spellsAvailable.length) {
      alert('No spells are available for this adventure.');
      return;
    }
    const limitStat = activeSpellLimitStat();
    const statLimit = limitStat ? parseNumber(player[limitStat], 0, 0, 999) : 0;
    const startingLimit = limitStat ? parseNumber(initialStats[limitStat], statLimit, 0, 999) : 0;
    const usableLimit = Math.max(preparedSpellLimit, statLimit, startingLimit, 0);
    showSpellSelectionDialog({
      limit: usableLimit,
      spells: spellsAvailable,
      initialSelection: preparedSpells,
      onConfirm: (selection, limitValue) => {
        preparedSpells = { ...selection };
        preparedSpellLimit = Math.max(0, limitValue ?? usableLimit);
        syncPreparedSpells();
        renderSpellsPanel();
        logs.logMessage('Prepared spells updated.', 'info');
      },
      onCancel: () => logs.logMessage('Spell update cancelled.', 'warning')
    });
  };

  const applyEnemiesState = (savedEnemies = []) => {
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

    enemies = restored;
    nextEnemyId = Math.max(maxId + 1, nextEnemyId);
    syncEnemies();
    renderEnemies();
  };

  const applyPlayerState = (savedPlayer = {}, savedInitial = {}) => {
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
    updateInitialStatsDisplay();

    renderPotionStatus();
    syncPlayerInputs();
    updateStatVisibility();
  };

  const applyPlayerModifiers = (savedModifiers = {}) => {
    playerModifiers.damageDone = parseNumber(savedModifiers.damageDone, 0, -99, 99);
    playerModifiers.damageReceived = parseNumber(savedModifiers.damageReceived, 0, -99, 99);
    playerModifiers.skillBonus = parseNumber(savedModifiers.skillBonus, 0, -99, 99);
    renderPlayerModifierSummary();
  };

  const buildSavePayload = (pageNumberLabel) => ({
    version: 6,
    savedAt: new Date().toISOString(),
    pageNumber: pageNumberLabel,
    book: currentBook || null,
    player: { ...player },
    initialStats: { ...initialStats },
    playerModifiers: { ...playerModifiers },
    notes: getNotesState(),
    map: getMapState(),
    enemies: enemies.map((enemy) => ({ ...enemy })),
    log: logHistory.map((entry) => ({ ...entry })),
    decisionLog: decisionLogHistory.map((entry) => ({ ...entry })),
    spells: {
      prepared: { ...preparedSpells },
      limit: preparedSpellLimit
    }
  });
  const showDecisionDialog = () => {
    const { overlay, modal, close } = createModal(
      'Add Decision',
      'Record the page number and the choice you made for later reference.',
      { compact: true }
    );

    const form = document.createElement('div');
    form.className = 'modal-form';

    const pageField = document.createElement('div');
    pageField.className = 'modal-field';
    const pageLabel = document.createElement('label');
    pageLabel.textContent = 'Page Number';
    pageLabel.htmlFor = 'decision-page-number';
    const pageInput = document.createElement('input');
    pageInput.id = 'decision-page-number';
    pageInput.type = 'number';
    pageInput.min = '1';
    pageInput.placeholder = '120';
    pageField.appendChild(pageLabel);
    pageField.appendChild(pageInput);

    const decisionField = document.createElement('div');
    decisionField.className = 'modal-field';
    const decisionLabel = document.createElement('label');
    decisionLabel.textContent = 'Decision';
    decisionLabel.htmlFor = 'decision-text';
    const decisionInput = document.createElement('textarea');
    decisionInput.id = 'decision-text';
    decisionInput.placeholder = 'Took the west tunnel';
    decisionField.appendChild(decisionLabel);
    decisionField.appendChild(decisionInput);

    form.appendChild(pageField);
    form.appendChild(decisionField);

    const actions = document.createElement('div');
    actions.className = 'modal-actions';
    const cancel = document.createElement('button');
    cancel.className = 'btn btn-negative';
    cancel.textContent = 'Cancel';
    const addButton = document.createElement('button');
    addButton.className = 'btn btn-positive';
    addButton.textContent = 'Save Decision';

    actions.appendChild(cancel);
    actions.appendChild(addButton);
    form.appendChild(actions);
    modal.appendChild(form);

    cancel.addEventListener('click', close);
    const attemptSave = () => {
      const pageValue = parseNumber(pageInput.value, NaN, 1, 9999);
      const decisionValue = decisionInput.value.trim();

      if (!Number.isFinite(pageValue)) {
        alert('Please provide the page number for this decision.');
        return;
      }

      if (!decisionValue) {
        alert('Please describe the decision.');
        return;
      }

      logs.addDecisionLogEntry(pageValue, decisionValue);
      close();
    };

    addButton.addEventListener('click', attemptSave);
    bindDefaultEnterAction(overlay, addButton, { allowTextareaSubmit: true });
  };

  // Prompt the book choice up front so saves and logs can stay tied to the right title.
  const showBookDialog = (onSelected, onCancelled) => {
    const { overlay, modal, close } = createModal(
      'Choose Your Book',
      'Pick which Fighting Fantasy book you are playing before rolling stats.',
      { compact: true }
    );

    const form = document.createElement('div');
    form.className = 'modal-form';

    const field = document.createElement('div');
    field.className = 'modal-field';

    const label = document.createElement('label');
    label.textContent = 'Book';
    label.htmlFor = 'book-select';

    const select = document.createElement('select');
    select.id = 'book-select';

    const placeholder = document.createElement('option');
    placeholder.value = '';
    placeholder.textContent = 'Select a book';
    placeholder.disabled = true;
    placeholder.selected = true;
    select.appendChild(placeholder);

    BOOK_OPTIONS.forEach((book) => {
      const option = document.createElement('option');
      option.value = book;
      option.textContent = book;
      if (book === currentBook) {
        option.selected = true;
        placeholder.selected = false;
      }
      select.appendChild(option);
    });

    field.appendChild(label);
    field.appendChild(select);
    form.appendChild(field);

    const actions = document.createElement('div');
    actions.className = 'modal-actions';
    const cancel = document.createElement('button');
    cancel.className = 'btn btn-negative';
    cancel.textContent = 'Cancel';
    const confirm = document.createElement('button');
    confirm.className = 'btn btn-positive';
    confirm.textContent = 'Confirm Book';

    actions.appendChild(cancel);
    actions.appendChild(confirm);
    form.appendChild(actions);
    modal.appendChild(form);

    const finalizeSelection = () => {
      const chosen = select.value;
      if (!chosen) {
        alert('Please choose a book before starting your adventure.');
        return;
      }
      setCurrentBook(chosen);
      renderCurrentBook();
      logs.logMessage(`Adventure set for ${chosen}.`, 'info');
      close();
      if (onSelected) {
        onSelected(chosen);
      }
    };

    cancel.addEventListener('click', () => {
      close();
      if (onCancelled) {
        onCancelled();
      }
    });

    confirm.addEventListener('click', finalizeSelection);
    bindDefaultEnterAction(overlay, confirm);
  };

  // Restore core data in a predictable order so fields sync correctly.
  const applySaveData = (data) => {
    setCurrentBook(typeof data.book === 'string' ? data.book : '');
    renderCurrentBook();
    updateStatVisibility();
    applyPlayerState(data.player, data.initialStats);
    applyPlayerModifiers(data.playerModifiers || {});
    applyNotesState(data.notes);
    applyMapState(data.map);
    applyEnemiesState(data.enemies);
    logs.applyLogState(Array.isArray(data.log) ? data.log : []);
    logs.applyDecisionLogState(Array.isArray(data.decisionLog) ? data.decisionLog : []);
    if (data.spells) {
      spellsModule.applySpellsState(data.spells, initialStats, player);
    } else {
      spellsModule.resetSpells();
    }
    updateResourceVisibility();
    const bookDetail = currentBook ? ` for ${currentBook}` : '';
    logs.logMessage(`Save loaded${data.pageNumber ? ` from Page ${data.pageNumber}` : ''}${bookDetail}.`, 'success');
  };

  // Prompt the player to decide on spending Luck after landing a hit.
  // Returning a promise keeps combat flow readable while allowing the animation
  // to finish before the decision is made.
  const promptLuckAfterPlayerHit = (enemyLabel) => new Promise((resolve) => {
    const { overlay, modal, close } = createModal(
      'Use Luck to press the attack?',
      `You wounded ${enemyLabel}. Spend Luck to attempt extra damage?`,
      { compact: true }
    );

    let settled = false;
    const finalize = (wantsLuck) => {
      if (settled) return;
      settled = true;
      close();
      resolve(wantsLuck);
    };

    overlay.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        finalize(false);
      }
    });

    const actions = document.createElement('div');
    actions.className = 'modal-actions';

    const skipButton = document.createElement('button');
    skipButton.className = 'btn btn-secondary';
    skipButton.textContent = 'Continue';
    skipButton.addEventListener('click', () => finalize(false));

    const luckButton = document.createElement('button');
    luckButton.className = 'btn btn-positive';
    luckButton.textContent = 'Use Luck';
    luckButton.addEventListener('click', () => finalize(true));

    actions.appendChild(skipButton);
    actions.appendChild(luckButton);
    modal.appendChild(actions);
    bindDefaultEnterAction(overlay, skipButton);
  });

  const syncPlayerInputs = () => {
    inputs.skill.value = player.skill;
    inputs.stamina.value = player.stamina;
    inputs.luck.value = player.luck;
    if (inputs.magic) {
      inputs.magic.value = player.magic;
    }
    inputs.meals.value = player.meals;
    renderPotionStatus();
    renderPlayerModifierSummary();
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
    if (inputs.magic) {
      inputs.magic.addEventListener('change', () => {
        player.magic = clamp(parseInt(inputs.magic.value, 10) || 0, 0, 999);
        player.maxMagic = Math.max(player.maxMagic, player.magic);
        inputs.magic.value = player.magic;
      });
    }
  };

  const renderPotionStatus = () => {
    if (!potionsEnabled()) {
      potionStatus.textContent = 'Potions are not available for this book.';
      usePotionButton.disabled = true;
      return;
    }
    if (!player.potion) {
      potionStatus.textContent = 'No potion selected.';
      usePotionButton.disabled = true;
      return;
    }
    const used = player.potionUsed ? ' (used)' : '';
    potionStatus.textContent = `${player.potion}${used}`;
    usePotionButton.disabled = player.potionUsed;
  };

  // Allow the player to roll each stat multiple times before accepting the spread.
  const showStatRollDialog = (statSet, onComplete) => {
    const hasMagic = Boolean(statSet.magic);
    const { overlay, modal, close } = createModal(
      'Roll Your Stats',
      'Roll each stat as many times as you like, then start your adventure.',
    );

    const statCount = Object.keys(statSet).length;
    const grid = document.createElement('div');
    // Keep the roll layout compact when only the three core stats are present.
    grid.className = statCount >= 4 ? 'grid-four' : 'grid-three';
    if (statCount >= 4) {
      grid.style.gridTemplateColumns = 'repeat(auto-fit, minmax(180px, 1fr))';
    }
    const applyButton = document.createElement('button');
    applyButton.className = 'btn btn-positive';
    applyButton.textContent = 'Start Adventure';
    applyButton.disabled = true;

    const cancelButton = document.createElement('button');
    cancelButton.className = 'btn btn-negative';
    cancelButton.textContent = 'Cancel';

    const currentRolls = Object.keys(statSet).reduce((acc, key) => ({ ...acc, [key]: null }), {});

    const updateApplyState = () => {
      applyButton.disabled = !Object.values(currentRolls).every((value) => value !== null);
    };

    Object.entries(statSet).forEach(([key, config]) => {
      const card = document.createElement('div');
      card.className = 'option-card spell-card';

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
      rollButton.className = 'btn btn-positive';
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
    bindDefaultEnterAction(overlay, applyButton);
  };

  const showSpellSelectionDialog = ({ limit, spells, onConfirm, onCancel, initialSelection }) => {
    const { overlay, modal, close } = createModal(
      'Prepare Your Spells',
      'Spend your Magic to select spells for this adventure.'
    );

    const grid = document.createElement('div');
    grid.className = 'grid-four';

    const selection = {};
    const safeLimit = Math.max(0, limit || 0);
    const initialSpellSelection = initialSelection || {};
    const plusButtons = {};
    const minusButtons = {};
    const inputsMap = {};
    let confirmButton;

    const summaryCard = document.createElement('div');
    summaryCard.className = 'option-card spell-summary-card';
    const summaryTitle = document.createElement('h4');
    summaryTitle.textContent = 'Spells Remaining';
    const summaryCount = document.createElement('div');
    summaryCount.className = 'spell-summary-count';
    const summaryMeta = document.createElement('p');
    summaryMeta.className = 'spell-summary-meta';
    summaryMeta.textContent = 'Use your Magic to distribute spells.';
    summaryCard.appendChild(summaryTitle);
    summaryCard.appendChild(summaryCount);
    summaryCard.appendChild(summaryMeta);

    const getTotalSelected = () => Object.values(selection).reduce((sum, value) => sum + (value || 0), 0);

    const syncControls = (key) => {
      if (inputsMap[key]) {
        inputsMap[key].value = selection[key];
      }
      if (minusButtons[key]) {
        minusButtons[key].disabled = selection[key] <= 0;
      }
    };

    // Mirror the Citadel spell selection rules by freezing all increments once the total hits the limit.
    const updateSummary = () => {
      const total = getTotalSelected();
      const remaining = Math.max(0, safeLimit - total);
      summaryCount.textContent = `${remaining} / ${safeLimit}`;
      summaryMeta.textContent = total > safeLimit
        ? 'Too many spells selected.'
        : 'Distribute spells up to your limit.';
      if (confirmButton) {
        confirmButton.disabled = total > safeLimit;
      }
      const limitReached = safeLimit > 0 && total >= safeLimit;
      const disableIncrease = safeLimit === 0 || limitReached;
      Object.values(plusButtons).forEach((button) => {
        button.disabled = disableIncrease;
      });
      Object.keys(selection).forEach((key) => syncControls(key));
    };

    const setSpellCount = (key, nextValue) => {
      const currentTotal = getTotalSelected();
      const currentValue = selection[key] || 0;
      const desired = Math.max(0, nextValue);
      const limitCap = Math.max(0, safeLimit);
      const availableSpace = Math.max(0, limitCap - (currentTotal - currentValue));
      const cappedValue = Math.min(desired, availableSpace);
      selection[key] = cappedValue;
      syncControls(key);
      updateSummary();
    };

    const adjustSpellCount = (key, delta) => {
      const currentValue = selection[key] || 0;
      setSpellCount(key, currentValue + delta);
    };

    spells.forEach((spell) => {
      selection[spell.key] = 0;
      const card = document.createElement('div');
      card.className = 'option-card';

      const header = document.createElement('div');
      header.className = 'spell-card-header';
      const title = document.createElement('h4');
      title.textContent = spell.name;
      header.appendChild(title);

      card.appendChild(header);

      const description = document.createElement('p');
      description.textContent = spell.description;
      description.title = spell.description;
      card.appendChild(description);

      const quantityControls = document.createElement('div');
      quantityControls.className = 'spell-quantity-controls';

      const minusButton = document.createElement('button');
      minusButton.className = 'btn btn-neutral';
      minusButton.textContent = '−';
      minusButton.type = 'button';
      minusButton.addEventListener('click', () => adjustSpellCount(spell.key, -1));

      const input = document.createElement('input');
      input.type = 'number';
      input.className = 'spell-quantity-input spell-input';
      input.min = '0';
      input.max = String(safeLimit);
      input.value = '0';
      input.setAttribute('aria-label', `Copies of ${spell.name}`);
      input.addEventListener('change', () => {
        const parsed = parseNumber(input.value, 0, 0, 999);
        setSpellCount(spell.key, parsed);
      });

      const plusButton = document.createElement('button');
      plusButton.className = 'btn btn-neutral';
      plusButton.textContent = '+';
      plusButton.type = 'button';
      plusButton.addEventListener('click', () => adjustSpellCount(spell.key, 1));

      minusButtons[spell.key] = minusButton;
      plusButtons[spell.key] = plusButton;
      inputsMap[spell.key] = input;

      quantityControls.appendChild(minusButton);
      quantityControls.appendChild(input);
      quantityControls.appendChild(plusButton);
      card.appendChild(quantityControls);
      grid.appendChild(card);
    });

    Object.entries(initialSpellSelection).forEach(([key, value]) => {
      if (Object.prototype.hasOwnProperty.call(selection, key)) {
        setSpellCount(key, parseNumber(value, 0, 0, 999));
      }
    });

    grid.appendChild(summaryCard);
    modal.appendChild(grid);

    const actions = document.createElement('div');
    actions.className = 'modal-actions';
    const cancelButton = document.createElement('button');
    cancelButton.className = 'btn btn-negative';
    cancelButton.textContent = 'Cancel';
    confirmButton = document.createElement('button');
    confirmButton.className = 'btn btn-positive';
    confirmButton.textContent = 'Confirm Spells';
    confirmButton.disabled = false;

    cancelButton.addEventListener('click', () => {
      close();
      if (onCancel) {
        onCancel();
      }
    });

    confirmButton.addEventListener('click', () => {
      const total = Object.values(selection).reduce((sum, value) => sum + (value || 0), 0);
      if (total > safeLimit) {
        alert('You selected more spells than your Magic allows.');
        return;
      }
      close();
      if (onConfirm) {
        onConfirm({ ...selection }, safeLimit);
      }
    });

    actions.appendChild(cancelButton);
    actions.appendChild(confirmButton);
    modal.appendChild(actions);
    updateSummary();
    bindDefaultEnterAction(overlay, confirmButton);
  };

  const showPotionDialog = (onSelect, onCancel) => {
    const { overlay, modal, close } = createModal('Choose Your Potion', 'Pick one potion to bring on your adventure.');
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
      chooseButton.className = 'btn btn-positive';
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
    confirmButton.className = 'btn btn-positive';
    confirmButton.textContent = 'Confirm';
    const cancelButton = document.createElement('button');
    cancelButton.className = 'btn btn-negative';
    cancelButton.textContent = 'Cancel';

    cancelButton.addEventListener('click', () => {
      close();
      if (onCancel) {
        onCancel('cancelled');
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
    bindDefaultEnterAction(overlay, confirmButton);
  };

  const logGeneralRollResult = (label, rollResult) => {
    const detail = rollResult.values.length > 1
      ? `${rollResult.values.join(' + ')} = ${rollResult.total}`
      : `${rollResult.total}`;
    logs.logMessage(`Rolled ${label}: ${detail}.`, 'info');
  };

  const showGeneralRollDialog = () => {
    const { overlay, modal, close } = createModal('Roll Dice', 'Choose dice for miscellaneous rolls.', { compact: true });

    const field = document.createElement('div');
    field.className = 'modal-field';

    const label = document.createElement('label');
    label.htmlFor = 'general-roll-select';
    label.textContent = 'Dice to roll';

    const select = document.createElement('select');
    select.id = 'general-roll-select';
    generalRollOptions.forEach((option) => {
      const opt = document.createElement('option');
      opt.value = option.value;
      opt.textContent = option.label;
      select.appendChild(opt);
    });
    select.value = '1d6';

    field.appendChild(label);
    field.appendChild(select);
    modal.appendChild(field);

    const actions = document.createElement('div');
    actions.className = 'modal-actions';

    const cancel = document.createElement('button');
    cancel.className = 'btn btn-negative';
    cancel.textContent = 'Cancel';
    cancel.addEventListener('click', close);

    const rollButton = document.createElement('button');
    rollButton.className = 'btn btn-positive';
    rollButton.textContent = 'Roll';
    rollButton.addEventListener('click', () => {
      const choice = generalRollOptions.find((option) => option.value === select.value) || generalRollOptions[0];
      const result = choice.roll();
      logGeneralRollResult(choice.label, result);
      close();
    });

    actions.appendChild(cancel);
    actions.appendChild(rollButton);
    modal.appendChild(actions);
    bindDefaultEnterAction(overlay, rollButton);
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
        option.textContent = formatEnemyOptionLabel(enemy);
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
        description: 'Attempt to reduce damage you received.',
        content: null,
        handler: () => {
          testLuck({ type: 'playerHitByEnemy' });
          return true;
        }
      },
      {
        key: 'afterHit',
        title: 'After Hitting an Enemy',
        description: 'Attempt to amplify damage you just dealt.',
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
        option.content.classList.add('card-control');
        card.appendChild(option.content);
      }

      const chooseButton = document.createElement('button');
      chooseButton.className = 'btn btn-positive';
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
    cancelButton.className = 'btn btn-negative';
    cancelButton.textContent = 'Close';
    cancelButton.addEventListener('click', close);

    actions.appendChild(cancelButton);
    modal.appendChild(actions);
  };

  // Present a reusable enemy selector for spells and commands that need targeting context.
  const showEnemySelectModal = ({
    title,
    description,
    filter,
    emptyMessage = 'No enemies available.',
    confirmLabel = 'Confirm'
  }) => new Promise((resolve) => {
    const eligible = enemies
      .map((enemy, index) => ({ enemy, index }))
      .filter(({ enemy, index }) => (typeof filter === 'function' ? filter(enemy, index) : true));

    if (!eligible.length) {
      alert(emptyMessage);
      resolve(null);
      return;
    }

    const { overlay, modal, close } = createModal(title, description, { compact: true });

    const field = document.createElement('div');
    field.className = 'modal-field';

    const label = document.createElement('label');
    label.htmlFor = 'enemy-select';
    label.textContent = 'Enemy';

    const select = document.createElement('select');
    select.id = 'enemy-select';
    eligible.forEach(({ enemy, index }) => {
      const option = document.createElement('option');
      option.value = index;
      option.textContent = formatEnemyOptionLabel(enemy);
      select.appendChild(option);
    });

    field.appendChild(label);
    field.appendChild(select);
    modal.appendChild(field);

    const actions = document.createElement('div');
    actions.className = 'modal-actions';

    const cancel = document.createElement('button');
    cancel.className = 'btn btn-negative';
    cancel.textContent = 'Cancel';
    cancel.addEventListener('click', () => {
      close();
      resolve(null);
    });

    const confirm = document.createElement('button');
    confirm.className = 'btn btn-positive';
    confirm.textContent = confirmLabel;
    confirm.addEventListener('click', () => {
      const chosenIndex = parseNumber(select.value, -1, -1, enemies.length - 1);
      if (chosenIndex < 0) {
        alert('Please choose an enemy first.');
        return;
      }
      close();
      resolve(chosenIndex);
    });

    actions.appendChild(cancel);
    actions.appendChild(confirm);
    modal.appendChild(actions);
    bindDefaultEnterAction(overlay, confirm);
  });

  // Player interactions ----------------------------------------------------
  const createCopiedEnemyFrom = (sourceEnemy) => ({
    name: `Copy of ${formatEnemyName(sourceEnemy)}`,
    skill: parseNumber(sourceEnemy?.skill, 0, 0, 999),
    stamina: parseNumber(sourceEnemy?.stamina, 0, 0, 999),
    modifiers: createDefaultEnemyModifiers(),
    isCopy: true,
    copiedFromId: Number.isFinite(sourceEnemy?.id) ? sourceEnemy.id : null
  });

  // Creature Copy duplicates a foe as an allied entry and keeps it pinned to the top of the roster.
  const handleCreatureCopySpell = async () => {
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
    logs.logMessage(`Creature Copy creates an ally from ${formatEnemyName(enemyToCopy)}.`, 'success');
    return true;
  };

  const applySpellEffect = (spell) => {
    if (!spell) return;
    if (spell.effect === 'restoreLuck') {
      const restoreAmount = Math.floor((initialStats.luck || 0) / 2);
      const before = player.luck;
      const maxLuck = initialStats.luck || player.maxLuck || before;
      player.luck = Math.min(maxLuck, player.luck + restoreAmount);
      syncPlayerInputs();
      const gained = player.luck - before;
      logs.logMessage(
        gained > 0
          ? `${spell.name} restores ${gained} Luck (up to ${maxLuck}).`
          : `${spell.name} has no effect; Luck is already at its starting value.`,
        gained > 0 ? 'success' : 'info'
      );
      return;
    }

    if (spell.effect === 'restoreStamina') {
      const restoreAmount = Math.floor((initialStats.stamina || 0) / 2);
      const before = player.stamina;
      const maxStamina = initialStats.stamina || player.maxStamina || before;
      player.stamina = Math.min(maxStamina, player.stamina + restoreAmount);
      syncPlayerInputs();
      const gained = player.stamina - before;
      logs.logMessage(
        gained > 0
          ? `${spell.name} restores ${gained} Stamina (up to ${maxStamina}).`
          : `${spell.name} has no effect; Stamina is already at its starting value.`,
        gained > 0 ? 'success' : 'info'
      );
      return;
    }

    logs.logMessage(`Spell cast: ${spell.name}. ${spell.description}`, 'info');
  };

  window.ffApp.applySpellEffect = applySpellEffect;

  const castSpell = async (spellKey) => {
    const spellsAvailable = activeSpells();
    const spell = spellsAvailable.find((entry) => entry.key === spellKey);
    if (!spell) {
      alert('That spell is not available for this adventure.');
      return;
    }
    const remaining = parseNumber(preparedSpells[spellKey], 0, 0, 999);
    if (remaining <= 0) {
      alert('No prepared copies of that spell remain.');
      return;
    }

    const spendSpell = () => {
      preparedSpells[spellKey] = Math.max(0, remaining - 1);
    };

    if (spell.effect === 'creatureCopy') {
      const copied = await handleCreatureCopySpell();
      if (!copied) {
        return;
      }
      spendSpell();
    } else {
      spendSpell();
      applySpellEffect(spell);
    }

    renderSpellsPanel();
    showActionVisual('castSpell', { subline: spell.description || 'You unleash a prepared spell.' });
  };

  const handleEatMeal = () => {
    if (!mealsEnabled()) {
      alert('Meals are not available for this adventure.');
      return;
    }
    if (player.meals <= 0) {
      alert('No meals left.');
      return;
    }
    player.meals -= 1;
    player.stamina = clamp(player.stamina + 4, 0, player.maxStamina);
    syncPlayerInputs();
    logs.logMessage('You eat a meal and regain 4 Stamina.', 'success');
    showActionVisual('eatMeal');
  };

  const escapeCombat = () => {
    if (!confirm('Are you sure you want to run away? You will lose 2 Stamina.')) {
      return;
    }
    player.stamina = clamp(player.stamina - 2, 0, player.maxStamina);
    syncPlayerInputs();
    logs.logMessage('You escaped combat and lost 2 Stamina.', 'warning');
    const defeatedFromEscape = player.stamina === 0;
    if (defeatedFromEscape) {
      logs.logMessage('You have been killed. Game Over.', 'danger');
      showActionVisual('loseCombat');
    } else {
      showActionVisual('escape', {
        subline: 'You escape, losing 2 Stamina.'
      });
    }
  };

  const showPlayerModifierDialog = () => {
    const { overlay, modal, close } = createModal(
      'Adjust Player Modifiers',
      'Tweak how your hero handles incoming and outgoing damage.',
      { compact: true }
    );

    const form = document.createElement('div');
    form.className = 'modal-form';

    const fields = [
      {
        id: 'player-damage-done',
        label: 'Damage done (applies to all enemies)',
        value: playerModifiers.damageDone,
        helper: 'Positive values increase how much damage you inflict.',
        min: -99,
        max: 99
      },
      {
        id: 'player-damage-received',
        label: 'Damage received modifier',
        value: playerModifiers.damageReceived,
        helper: 'Positive values increase damage you take; negatives reduce it.',
        min: -99,
        max: 99
      },
      {
        id: 'player-skill-bonus',
        label: 'Add Skill to attack rolls',
        value: playerModifiers.skillBonus,
        helper: 'Adds directly to your Skill when rolling to attack an enemy.',
        min: -99,
        max: 99
      }
    ];

    const inputs = {};

    fields.forEach((field) => {
      const wrapper = document.createElement('div');
      wrapper.className = 'modal-field';

      const label = document.createElement('label');
      label.textContent = field.label;
      label.htmlFor = field.id;

      const input = document.createElement('input');
      input.type = 'number';
      input.id = field.id;
      input.value = field.value;
      input.min = field.min;
      input.max = field.max;

      const helper = document.createElement('p');
      helper.className = 'helper-text';
      helper.textContent = field.helper;

      inputs[field.id] = input;

      wrapper.appendChild(label);
      wrapper.appendChild(input);
      wrapper.appendChild(helper);
      form.appendChild(wrapper);
    });

    const actions = document.createElement('div');
    actions.className = 'modal-actions';
    const cancel = document.createElement('button');
    cancel.className = 'btn btn-negative';
    cancel.textContent = 'Cancel';
    cancel.addEventListener('click', close);

    const apply = document.createElement('button');
    apply.className = 'btn btn-positive';
    apply.textContent = 'Apply';
    apply.addEventListener('click', () => {
      playerModifiers.damageDone = parseNumber(inputs['player-damage-done'].value, 0, -99, 99);
      playerModifiers.damageReceived = parseNumber(inputs['player-damage-received'].value, 0, -99, 99);
      playerModifiers.skillBonus = parseNumber(inputs['player-skill-bonus'].value, 0, -99, 99);
      renderPlayerModifierSummary();
      renderEnemies();
      logs.logMessage('Player modifiers updated.', 'info');
      close();
    });

    actions.appendChild(cancel);
    actions.appendChild(apply);
    form.appendChild(actions);
    modal.appendChild(form);
    bindDefaultEnterAction(overlay, apply);
  };

  const formatModifierPart = (value, emoji) => {
    if (!value) {
      return '';
    }
    const prefix = value > 0 ? '+' : '';
    return `${emoji}${prefix}${value}`;
  };

  const renderPlayerModifierSummary = () => {
    if (!playerModifierChip) {
      return;
    }

    // Positive damage taken boosts use a skull, while damage reduction flips to a shield with a positive count for clarity.
    let receivedPart = '';
    if (playerModifiers.damageReceived) {
      if (playerModifiers.damageReceived > 0) {
        receivedPart = `💀+${playerModifiers.damageReceived}`;
      } else {
        receivedPart = `🛡️+${Math.abs(playerModifiers.damageReceived)}`;
      }
    }

    const parts = [
      formatModifierPart(playerModifiers.damageDone, '🗡️'),
      receivedPart,
      formatModifierPart(playerModifiers.skillBonus, '🤺')
    ].filter(Boolean);

    const summary = parts.join(' ');
    playerModifierChip.textContent = summary;
    if (summary) {
      playerModifierChip.title = `Damage dealt/taken and Skill bonus: ${parts.join(' ')}`;
    } else {
      playerModifierChip.removeAttribute('title');
    }
  };

  // Book-specific rules can disable potions, meals, or spells. Keep the UI in sync with the active book.
  const updateResourceVisibility = () => {
    updateStatVisibility();
    const potionsAvailable = potionsEnabled();
    if (potionControls) {
      potionControls.classList.toggle('hidden', !potionsAvailable);
    }
    if (!potionsAvailable) {
      player.potion = null;
      player.potionUsed = false;
    }

    const mealsAvailable = mealsEnabled();
    if (mealControls) {
      mealControls.classList.toggle('hidden', !mealsAvailable);
    }
    if (!mealsAvailable) {
      player.meals = 0;
    }
    syncPlayerInputs();
    renderPotionStatus();
    renderSpellsPanel();
  };

  window.ffApp.castSpell = castSpell;

  // Keep enemy damage calculations and UI summaries in sync by routing everything through
  // a shared profile that applies modifiers as deltas to the Fighting Fantasy base damage.
  const getEnemyDamageProfile = (enemy) => {
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

  const summarizeEnemyModifiers = (enemy) => {
    const modifiers = getEnemyModifiers(enemy);
    const pieces = [];

    // Show only the enemy-specific deltas so player-wide modifiers do not leak into the enemy chips.
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

  const calculateDamageToEnemy = (enemy) => getEnemyDamageProfile(enemy).damageToEnemy;

  const calculateDamageToPlayer = (enemy) => getEnemyDamageProfile(enemy).damageToPlayer;

  // Build a consistent labeled number input for enemy stat editing.
  const createEnemyStatInput = ({ label, value, onChange }) => {
    const wrapper = document.createElement('label');
    wrapper.className = 'inline-label';
    wrapper.textContent = `${label} `;

    const input = document.createElement('input');
    input.type = 'number';
    input.value = value;
    input.max = 999;
    input.min = 0;
    input.addEventListener('change', () => {
      const safeValue = parseNumber(input.value, value, 0, 999);
      onChange(safeValue);
      input.value = safeValue;
    });

    wrapper.appendChild(input);
    return wrapper;
  };

  // Enemy handling --------------------------------------------------------
  function renderEnemies() {
    const container = document.getElementById('monsterList');
    container.innerHTML = '';

    if (!enemies.length) {
      const empty = document.createElement('p');
      empty.className = 'empty-enemies';
      empty.textContent = 'No enemies yet. Add foes as you encounter them.';
      container.appendChild(empty);
      return;
    }

    enemies.forEach((enemy, index) => {
      enemy.modifiers = getEnemyModifiers(enemy);
      const box = document.createElement('div');
      box.className = 'enemy-box';
      if (enemy.isCopy) {
        box.classList.add('enemy-copy');
      }

      const header = document.createElement('div');
      header.className = 'enemy-header';

      const title = document.createElement('strong');
      title.textContent = formatEnemyName(enemy);
      if (enemy.isCopy) {
        title.style.color = 'rgba(255, 207, 111, 1)';
      }
      header.appendChild(title);

      const stats = document.createElement('div');
      stats.className = 'enemy-stats';

      const skillLabel = createEnemyStatInput({
        label: 'Skill',
        value: enemy.skill,
        onChange: (nextSkill) => {
          enemy.skill = nextSkill;
        }
      });
      stats.appendChild(skillLabel);

      const staminaLabel = createEnemyStatInput({
        label: 'Stamina',
        value: enemy.stamina,
        onChange: (nextStamina) => {
          enemy.stamina = nextStamina;
        }
      });
      stats.appendChild(staminaLabel);

      header.appendChild(stats);
      const enemyModifierChip = document.createElement('span');
      enemyModifierChip.className = 'modifier-chip';
      const enemyModifierSummary = summarizeEnemyModifiers(enemy);
      enemyModifierChip.textContent = enemyModifierSummary;
      if (enemyModifierSummary) {
        enemyModifierChip.title = `Enemy damage modifiers: ${enemyModifierSummary}`;
      }
      header.appendChild(enemyModifierChip);
      box.appendChild(header);

      const actions = document.createElement('div');
      actions.className = 'enemy-actions';
      if (enemy.isCopy) {
        actions.classList.add('copy-actions');
      }

      const attackButton = document.createElement('button');
      attackButton.textContent = enemy.isCopy ? 'Command Attack' : 'Attack';
      attackButton.className = 'btn btn-positive attack-button';
      attackButton.addEventListener('click', () => {
        if (enemy.isCopy) {
          commandCopyAttack(index);
        } else {
          performAttack(index);
        }
      });
      actions.appendChild(attackButton);

      if (!enemy.isCopy) {
        const modifierButton = document.createElement('button');
        modifierButton.textContent = 'Modifier';
        modifierButton.className = 'btn btn-neutral';
        modifierButton.addEventListener('click', () => showEnemyModifierDialog(index));
        actions.appendChild(modifierButton);
      }

      const removeButton = document.createElement('button');
      removeButton.textContent = 'Remove';
      removeButton.className = 'btn btn-negative remove-button';
      removeButton.addEventListener('click', () => removeEnemy(index));
      actions.appendChild(removeButton);

      box.appendChild(actions);
      container.appendChild(box);
    });
  }

  const showEnemyModifierDialog = (index) => {
    const enemy = enemies[index];
    if (!enemy) {
      alert('Enemy not found.');
      return;
    }

    const modifiers = getEnemyModifiers(enemy);
    const { overlay, modal, close } = createModal(
      `Modify ${formatEnemyName(enemy)}`,
      'Adjust how this foe trades damage with you.',
      { compact: true }
    );

    const form = document.createElement('div');
    form.className = 'modal-form';

    const fields = [
      {
        id: 'damage-dealt',
        label: 'Damage modifier when it hits you',
        value: modifiers.damageDealt,
        min: -99,
        max: 99,
        helper: 'Adjusts the standard 2 damage this enemy inflicts when it wins a round.'
      },
      {
        id: 'damage-received',
        label: 'Damage modifier when you hit it',
        value: modifiers.damageReceived,
        min: -99,
        max: 99,
        helper: 'Adjusts the standard 2 damage this enemy takes when you win a round.'
      }
    ];

    const inputsMap = {};

    fields.forEach((field) => {
      const wrapper = document.createElement('div');
      wrapper.className = 'modal-field';

      const label = document.createElement('label');
      label.textContent = field.label;
      label.htmlFor = field.id;

      const input = document.createElement('input');
      input.type = 'number';
      input.id = field.id;
      input.value = field.value;
      if (Number.isFinite(field.min)) input.min = field.min;
      if (Number.isFinite(field.max)) input.max = field.max;

      const helper = document.createElement('p');
      helper.className = 'helper-text';
      helper.textContent = field.helper;

      inputsMap[field.id] = input;

      wrapper.appendChild(label);
      wrapper.appendChild(input);
      wrapper.appendChild(helper);
      form.appendChild(wrapper);
    });

    const actions = document.createElement('div');
    actions.className = 'modal-actions';
    const cancel = document.createElement('button');
    cancel.className = 'btn btn-negative';
    cancel.textContent = 'Cancel';
    cancel.addEventListener('click', close);

    const apply = document.createElement('button');
    apply.className = 'btn btn-positive';
    apply.textContent = 'Apply';
    apply.addEventListener('click', () => {
      const updated = normalizeEnemyModifiers({
        // Preserve delta mode so user-entered numbers are treated as adjustments, not
        // absolute legacy values that subtract the 2-damage Fighting Fantasy baseline.
        ...modifiers,
        damageDealt: inputsMap['damage-dealt'].value,
        damageReceived: inputsMap['damage-received'].value
      });

      const changed = ['damageDealt', 'damageReceived', 'playerDamageBonus', 'playerDamageTakenBonus']
        .some((key) => updated[key] !== modifiers[key]);

      if (!changed) {
        close();
        return;
      }

      enemy.modifiers = updated;
      renderEnemies();
      logs.logMessage(`${formatEnemyName(enemy)} modifiers updated.`, 'info');
      close();
    });

    actions.appendChild(cancel);
    actions.appendChild(apply);
    form.appendChild(actions);
    modal.appendChild(form);
    bindDefaultEnterAction(overlay, apply);
  };

  function addEnemy(initial = { skill: 0, stamina: 0 }, options = {}) {
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
    logs.logMessage(`Testing Luck: rolled ${roll} vs ${player.luck + 1}. ${isLucky ? 'Lucky!' : 'Unlucky.'}`, 'action');

    const isPlayerHittingEnemy = context?.type === 'playerHitEnemy';
    const isPlayerHitByEnemy = context?.type === 'playerHitByEnemy';

    let luckSubline = isLucky ? 'Luck holds firm.' : 'Luck slips away.';
    if (isPlayerHittingEnemy) {
      luckSubline = isLucky ? 'Extra damage lands true.' : 'The foe steadies.';
    } else if (isPlayerHitByEnemy) {
      luckSubline = isLucky ? 'You soften the blow.' : 'The wound deepens.';
    }

    // Keep luck animations context-aware: combat mitigation uses block/fail art, attacking
    // foes replays hit/miss art, and only general tests use the broad luck visuals.
    if (isPlayerHittingEnemy) {
      showActionVisual(isLucky ? 'playerHitEnemy' : 'playerMissEnemy', { subline: luckSubline });
    } else if (isPlayerHitByEnemy) {
      showActionVisual(isLucky ? 'blockEnemy' : 'enemyHitYou');
    } else {
      showActionVisual(isLucky ? 'lucky' : 'unlucky', { subline: luckSubline });
    }

    if (!context) {
      return { outcome: 'general', lucky: isLucky };
    }

    if (context.type === 'playerHitEnemy') {
      const enemy = enemies[context.index];
      if (!enemy) {
        logs.logMessage('The selected enemy is no longer present.', 'warning');
        return { outcome: 'missing', lucky: isLucky };
      }

      const adjustment = isLucky ? -2 : 1;
      enemy.stamina = Math.max(0, enemy.stamina + adjustment);
      const enemyLabel = formatEnemyName(enemy);
      logs.logMessage(
        isLucky
          ? `Lucky strike! ${enemyLabel} loses an additional 2 Stamina.`
          : `Unlucky! ${enemyLabel} regains 1 Stamina.`,
        isLucky ? 'success' : 'danger'
      );

      if (enemy.stamina === 0) {
        logs.logMessage(`${enemyLabel} is defeated.`, 'success');
        removeEnemy(context.index);
      } else {
        renderEnemies();
      }
    } else if (context.type === 'playerHitByEnemy') {
      const adjustment = isLucky ? 1 : -1;
      player.stamina = clamp(player.stamina + adjustment, 0, player.maxStamina);
      syncPlayerInputs();
      logs.logMessage(
        isLucky
          ? 'Lucky! You reduce the damage by gaining 1 Stamina.'
          : 'Unlucky! You lose an additional 1 Stamina.',
        isLucky ? 'success' : 'danger'
      );
      showActionVisual(isLucky ? 'blockEnemy' : 'enemyHitYou');
    }
    return { outcome: context.type, lucky: isLucky };
  };

  // Copied creature combat -----------------------------------------------
  // Copied allies fight other monsters without triggering the main combat animations.
  const resolveCopiedCreatureAttack = (copyIndex, targetIndex) => {
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
    logs.logMessage(`${formatEnemyName(copied)} attacks ${formatEnemyName(target)}: ${copyRoll} vs ${targetRoll}.`, 'action');

    if (copyRoll === targetRoll) {
      logs.logMessage('The copied creature trades feints with no damage dealt.', 'info');
      return;
    }

    const copyId = copied.id;
    const targetId = target.id;
    const damage = BASE_ENEMY_DAMAGE;

    if (copyRoll > targetRoll) {
      target.stamina = Math.max(0, target.stamina - damage);
      logs.logMessage(`${formatEnemyName(target)} takes ${damage} damage from the copied creature.`, 'success');
      if (target.stamina === 0) {
        logs.logMessage(`${formatEnemyName(target)} is defeated by the copied creature.`, 'success');
        removeEnemyById(targetId);
        return;
      }
    } else {
      copied.stamina = Math.max(0, copied.stamina - damage);
      logs.logMessage(`${formatEnemyName(copied)} takes ${damage} damage.`, 'danger');
      if (copied.stamina === 0) {
        logs.logMessage(`${formatEnemyName(copied)} is destroyed.`, 'warning');
        removeEnemyById(copyId);
        return;
      }
    }

    renderEnemies();
  };

  const commandCopyAttack = async (copyIndex) => {
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

    resolveCopiedCreatureAttack(copyIndex, targetIndex);
  };

  // Combat handling -------------------------------------------------------
  async function performAttack(index) {
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
    logs.logMessage(`Combat vs ${enemyLabel}: Monster ${monsterAttack} vs Player ${playerAttack}.`, 'action');

    if (monsterAttack === playerAttack) {
      logs.logMessage('Standoff! No damage dealt.', 'info');
      return;
    }

    let defeated = false;
    if (playerAttack > monsterAttack) {
      const damageToEnemy = calculateDamageToEnemy(enemy);
      enemy.stamina = Math.max(0, enemy.stamina - damageToEnemy);
      logs.logMessage(`You hit ${enemyLabel} for ${damageToEnemy} damage.`, 'success');
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
    const damageToPlayer = calculateDamageToPlayer(enemy);
    player.stamina = clamp(player.stamina - damageToPlayer, 0, player.maxStamina);
    syncPlayerInputs();
    logs.logMessage(`${enemyLabel} hits you for ${damageToPlayer} damage.`, 'danger');

      await showActionVisualAndWait('playerFailAttack');

      const wantsLuck = confirm('You took damage. Use Luck to reduce it?');
      if (wantsLuck) {
        testLuck({ type: 'playerHitByEnemy', index });
      }

      // Only trigger the combat defeat art once Luck adjustments settle on zero Stamina.
      if (player.stamina === 0) {
        logs.logMessage('You have been killed. Game Over.', 'danger');
        showActionVisual('loseCombat');
      }
    }

    const enemyRemovedByLuck = !enemies.includes(enemy);

    if (defeated) {
      logs.logMessage(`${enemyLabel} is defeated.`, 'success');
      showActionVisual('defeatEnemy');
      if (enemies.includes(enemy)) {
        removeEnemy(index);
      }
    } else if (enemyRemovedByLuck) {
      showActionVisual('defeatEnemy');
    } else {
      renderEnemies();
    }
  }

  // Game setup ------------------------------------------------------------
  const applyPotion = () => {
    if (!potionsEnabled()) {
      alert('Potions cannot be used for this adventure.');
      return;
    }
    if (!player.potion || player.potionUsed) {
      alert('No potion available or it has already been used.');
      return;
    }
    let potionSubline = 'Potion restores your vigor.';
    if (player.potion === 'Potion of Skill') {
      player.skill = player.maxSkill;
      logs.logMessage('Potion of Skill used. Skill restored.', 'success');
      potionSubline = 'Skill returns to its peak.';
    } else if (player.potion === 'Potion of Strength') {
      player.stamina = player.maxStamina;
      logs.logMessage('Potion of Strength used. Stamina restored.', 'success');
      potionSubline = 'Stamina surges to full.';
    } else if (player.potion === 'Potion of Fortune') {
      player.maxLuck += 1;
      player.luck = player.maxLuck;
      logs.logMessage('Potion of Fortune used. Luck increased and restored.', 'success');
      initialStats.luck = player.maxLuck;
      updateInitialStatsDisplay();
      potionSubline = 'Luck rises and refills.';
    }
    player.potionUsed = true;
    syncPlayerInputs();
    renderPotionStatus();
    showActionVisual('drinkPotion', { subline: potionSubline });
  };

  const selectPotion = (onSelected, onCancelled) => {
    showPotionDialog((choice) => {
      player.potion = choice;
      player.potionUsed = false;
      logs.logMessage(`${player.potion} selected.`, 'info');
      renderPotionStatus();
      if (onSelected) {
        onSelected(choice);
      }
    }, () => {
      if (onCancelled) {
        onCancelled();
      } else {
        logs.logMessage('Potion selection cancelled.', 'warning');
      }
    });
  };

  const newGame = () => {
    const startStatRolling = () => {
      const statsForBook = activeStatConfigs();
      // Do not finalize state until the player confirms their potion or spells to avoid recursion loops on cancel.
      showStatRollDialog(statsForBook, (rolls) => {
        const spellLimitKey = activeSpellLimitStat();
        const spellLimit = spellLimitKey ? parseNumber(rolls[spellLimitKey], 0, 0, 999) : 0;
        const finalizeNewGame = (potionChoice, spellSelection, limit) => {
          player.skill = player.maxSkill = rolls.skill;
          player.stamina = player.maxStamina = rolls.stamina;
          player.luck = player.maxLuck = rolls.luck;
          player.magic = player.maxMagic = rolls.magic || 0;
          player.meals = mealsEnabled() ? 10 : 0;
          player.potion = potionsEnabled() ? potionChoice : null;
          player.potionUsed = false;
          playerModifiers.damageDone = 0;
          playerModifiers.damageReceived = 0;
          playerModifiers.skillBonus = 0;

          initialStats.skill = rolls.skill;
          initialStats.stamina = rolls.stamina;
          initialStats.luck = rolls.luck;
          initialStats.magic = rolls.magic || 0;
          updateInitialStatsDisplay();

          preparedSpells = spellSelection || {};
          preparedSpellLimit = parseNumber(limit ?? spellLimit, spellLimit, 0, 999);
          syncPreparedSpells();
          resetNotes();
          resetMapDrawing();

          // Starting fresh should leave the adventure log empty so previous runs do not leak context.
          logHistory.length = 0;

          enemies = [];
          nextEnemyId = 1;
          syncEnemies();
          renderEnemies();
          decisionLogHistory.length = 0;
          logs.renderDecisionLog();
          syncPlayerInputs();
          logs.renderLog();
          const bookLabel = currentBook || 'Unknown Book';
          logs.logMessage(`New game started for ${bookLabel}. Roll results applied.`, 'success');
          renderPotionStatus();
          renderSpellsPanel();
          updateResourceVisibility();
          showActionVisual('newGame');
        };

        const startPotionFlow = (spellSelection, limitValue = spellLimit) => {
          if (!potionsEnabled()) {
            finalizeNewGame(null, spellSelection, limitValue);
            return;
          }
          selectPotion(
            (choice) => finalizeNewGame(choice, spellSelection, limitValue),
            () => {
              logs.logMessage('New game cancelled before choosing a potion. Current adventure continues.', 'warning');
            }
          );
        };

        const startSpellFlow = () => {
          const spellsForBook = activeSpells();
          if (!spellsForBook.length) {
            startPotionFlow({});
            return;
          }
          showSpellSelectionDialog({
            limit: spellLimit,
            spells: spellsForBook,
            onConfirm: (selection, limitValue) => startPotionFlow(selection, limitValue),
            onCancel: () => logs.logMessage('New game cancelled before selecting spells. Current adventure continues.', 'warning')
          });
        };

        startSpellFlow();
      });
    };

    showBookDialog(
      () => {
        updateResourceVisibility();
        updateStatVisibility();
        startStatRolling();
      },
      () => {
        logs.logMessage('New game cancelled before selecting a book. Current adventure continues.', 'warning');
      }
    );
  };

  // Allow non-combat failures to showcase the dedicated defeat art without altering stats.
  const playGameOverVisual = () => {
    logs.logMessage('Game Over triggered outside combat.', 'danger');
    showActionVisual('lose');
  };

  // Keyboard shortcuts keep common combat and logging flows fast without conflicting with text entry.
  const isTypingInForm = () => {
    const active = document.activeElement;
    if (!active || !(active instanceof HTMLElement)) {
      return false;
    }
    const tag = active.tagName?.toLowerCase();
    return active.isContentEditable || ['input', 'textarea', 'select'].includes(tag);
  };

  const handleGlobalHotkeys = (event) => {
    if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey) {
      return;
    }

    const key = event.key?.toLowerCase();
    if (!key || isTypingInForm()) {
      return;
    }

    if (key === 'd') {
      event.preventDefault();
      showDecisionDialog();
      return;
    }

    if (key === 'a') {
      event.preventDefault();
      addEnemy();
      return;
    }

    if (key === 'r') {
      event.preventDefault();
      showGeneralRollDialog();
      return;
    }

    if (key === 'm') {
      event.preventDefault();
      // Pass the current book for sensible filenames and consistent logging.
      showMapDialog({ currentBook, logMessage });
      return;
    }

    if (key === 't') {
      event.preventDefault();
      showLuckDialog();
      return;
    }

    if (key === 'f5') {
      event.preventDefault();
      showSaveDialog();
      return;
    }

    if (key === 'f9') {
      event.preventDefault();
      loadFileInput.click();
      return;
    }

    if (/^[1-9]$/.test(key)) {
      const index = parseInt(key, 10) - 1;
      if (enemies[index]) {
        // Attacks can roll asynchronously; ignore the promise so keypress handling stays lightweight.
        event.preventDefault();
        performAttack(index);
      }
    }
  };

  // Wiring ----------------------------------------------------------------
  document.getElementById('eatMeal').addEventListener('click', handleEatMeal);
  document.getElementById('escape').addEventListener('click', escapeCombat);
  document.getElementById('testLuck').addEventListener('click', showLuckDialog);
  document.getElementById('playerModifier').addEventListener('click', showPlayerModifierDialog);
  document.getElementById('generalRoll').addEventListener('click', showGeneralRollDialog);
  document.getElementById('saveGame').addEventListener('click', showSaveDialog);
  document.getElementById('loadGame').addEventListener('click', () => loadFileInput.click());
  document.getElementById('openMap').addEventListener('click', () => {
    showMapDialog({ currentBook, logMessage });
  });
  document.getElementById('newGame').addEventListener('click', newGame);
  document.getElementById('gameOver').addEventListener('click', playGameOverVisual);
  document.getElementById('usePotion').addEventListener('click', applyPotion);
  handleLoadFile(applySaveData);
  document.addEventListener('keydown', handleGlobalHotkeys);

  document.getElementById('addEnemy').addEventListener('click', () => addEnemy());
  document.getElementById('addDecision').addEventListener('click', showDecisionDialog);
  if (spellsRemaining) {
    spellsRemaining.addEventListener('click', managePreparedSpells);
  }
  bindPlayerInputs();
  renderEnemies();

  updateInitialStatsDisplay();
  renderCurrentBook();
  renderPotionStatus();
  updateResourceVisibility();
  renderSpellsPanel();
  syncPlayerInputs();
logs.renderLog();
logs.renderDecisionLog();
})();
