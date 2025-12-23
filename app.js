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

  // Light-weight knobs for tailoring how the player trades blows in combat.
  const playerModifiers = {
    damageDone: 0,
    damageReceived: 0,
    skillBonus: 0
  };

  // Track the unmodifiable starting maxima so we can surface them alongside the inputs.
  const initialStats = {
    skill: 0,
    stamina: 0,
    luck: 0
  };

  let enemies = [];
  // Preserve stable enemy identifiers so names do not shift when the list changes.
  let nextEnemyId = 1;

  const logEl = document.getElementById('log');
  const logHistory = [];
  const LOG_HISTORY_LIMIT = 50;
  const decisionLogEl = document.getElementById('decisionLog');
  const decisionLogHistory = [];
  const DECISION_LOG_HISTORY_LIMIT = 50;
  const loadFileInput = document.getElementById('loadFileInput');
  const potionStatus = document.getElementById('potionStatus');
  const usePotionButton = document.getElementById('usePotion');
  const playerModifierChip = document.getElementById('playerModifierChip');

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

  const notes = {
    gold: document.getElementById('gold'),
    treasure: document.getElementById('treasure'),
    equipment: document.getElementById('equipment'),
    provisions: document.getElementById('provisions')
  };

  // Utility helpers --------------------------------------------------------
  const rollDice = (count) => Array.from({ length: count }, () => Math.floor(Math.random() * 6) + 1)
    .reduce((sum, value) => sum + value, 0);

  // General-purpose dice helpers so future rolls can cover non-standard die sizes.
  const rollDieWithSides = (sides) => Math.floor(Math.random() * sides) + 1;
  const rollCustomDice = (count, sides) => {
    const values = Array.from({ length: count }, () => rollDieWithSides(sides));
    const total = values.reduce((sum, value) => sum + value, 0);
    return { total, values };
  };

  const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

  // Keep numeric parsing consistent when restoring a save file or clamping manual input.
  const parseNumber = (value, fallback = 0, min = 0, max = 999) => {
    const parsed = parseInt(value, 10);
    if (Number.isFinite(parsed)) {
      return clamp(parsed, min, max);
    }
    return fallback;
  };

  const createDefaultEnemyModifiers = () => ({
    damageDealt: 2,
    damageReceived: 2,
    playerDamageBonus: 0,
    playerDamageTakenBonus: 0
  });

  const normalizeEnemyModifiers = (modifiers = {}) => ({
    damageDealt: parseNumber(modifiers.damageDealt, 2, 0, 99),
    damageReceived: parseNumber(modifiers.damageReceived, 2, 0, 99),
    playerDamageBonus: parseNumber(modifiers.playerDamageBonus, 0, -99, 99),
    playerDamageTakenBonus: parseNumber(modifiers.playerDamageTakenBonus, 0, -99, 99)
  });

  const getEnemyModifiers = (enemy) => normalizeEnemyModifiers(enemy?.modifiers || createDefaultEnemyModifiers());

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

  // Keep the combat log readable with tone-specific icons and colors.
  const logToneIcons = {
    info: '📜',
    action: '⚔️',
    success: '✨',
    warning: '⚠️',
    danger: '💀'
  };

  // Reusable renderer so adventure and decision logs stay consistent.
  const renderLogList = ({ container, entries, getIcon, formatMessage, showTimestamp = true }) => {
    container.innerHTML = '';

    entries.forEach((entry) => {
      const row = document.createElement('div');
      row.className = 'log-entry';
      row.dataset.tone = entry.tone;

      if (showTimestamp) {
        const timestamp = document.createElement('span');
        timestamp.className = 'log-timestamp';
        const parsedDate = entry.timestamp ? new Date(entry.timestamp) : new Date();
        timestamp.textContent = `[${parsedDate.toLocaleTimeString()}]`;
        row.appendChild(timestamp);
      }

      const icon = document.createElement('span');
      icon.className = 'log-icon';
      const chosenIcon = getIcon ? getIcon(entry) : null;
      icon.textContent = chosenIcon || logToneIcons[entry.tone] || logToneIcons.info;

      const body = document.createElement('span');
      body.className = 'log-body';
      const content = formatMessage ? formatMessage(entry) : entry.message;
      body.innerHTML = emphasizeLogTokens(content || '');

      row.appendChild(icon);
      row.appendChild(body);
      container.appendChild(row);
    });
  };

  const renderLog = () => {
    renderLogList({
      container: logEl,
      entries: logHistory,
      getIcon: (entry) => logToneIcons[entry.tone] || logToneIcons.info,
      formatMessage: (entry) => entry.message
    });
  };

  const logMessage = (message, tone = 'info') => {
    const timestamp = new Date().toISOString();
    logHistory.unshift({ message, tone, timestamp });
    if (logHistory.length > LOG_HISTORY_LIMIT) {
      logHistory.length = LOG_HISTORY_LIMIT;
    }
    renderLog();
  };

  const addDecisionLogEntry = (pageNumber, decision) => {
    const timestamp = new Date().toISOString();
    decisionLogHistory.unshift({
      pageNumber,
      decision,
      message: `Page ${pageNumber}: ${decision}`,
      timestamp,
      tone: 'info'
    });
    if (decisionLogHistory.length > DECISION_LOG_HISTORY_LIMIT) {
      decisionLogHistory.length = DECISION_LOG_HISTORY_LIMIT;
    }
    renderDecisionLog();
  };

  const renderDecisionLog = () => {
    // Decision entries stay concise in the UI while keeping timestamps in saved data.
    renderLogList({
      container: decisionLogEl,
      entries: decisionLogHistory,
      getIcon: () => '🧭',
      formatMessage: (entry) => entry.message || `Page ${entry.pageNumber || '—'} — ${entry.decision}`,
      showTimestamp: false
    });
  };

  const updateInitialStatsDisplay = () => {
    const formatStat = (value) => (value ? value : '-');
    startingBadges.skill.textContent = formatStat(initialStats.skill);
    startingBadges.stamina.textContent = formatStat(initialStats.stamina);
    startingBadges.luck.textContent = formatStat(initialStats.luck);
  };

  const getNotesState = () => ({
    gold: notes.gold.value,
    treasure: notes.treasure.value,
    equipment: notes.equipment.value,
    provisions: notes.provisions.value
  });

  const applyNotesState = (savedNotes = {}) => {
    Object.entries(notes).forEach(([key, element]) => {
      element.value = savedNotes[key] || '';
    });
  };

  const applyLogState = (savedLog = []) => {
    logHistory.length = 0;
    if (Array.isArray(savedLog)) {
      savedLog.slice(0, LOG_HISTORY_LIMIT).forEach((entry) => {
        if (entry && typeof entry.message === 'string') {
          logHistory.push({
            message: entry.message,
            tone: entry.tone || 'info',
            timestamp: entry.timestamp || new Date().toISOString()
          });
        }
      });
    }
    renderLog();
  };

  const applyDecisionLogState = (savedDecisions = []) => {
    decisionLogHistory.length = 0;
    if (Array.isArray(savedDecisions)) {
      savedDecisions.slice(0, DECISION_LOG_HISTORY_LIMIT).forEach((entry) => {
        if (entry && typeof entry.decision === 'string') {
          const safePage = parseNumber(entry.pageNumber, '', 1, 9999);
          decisionLogHistory.push({
            pageNumber: safePage,
            decision: entry.decision,
            message: entry.message || (safePage ? `Page ${safePage}: ${entry.decision}` : entry.decision),
            timestamp: entry.timestamp || new Date().toISOString(),
            tone: entry.tone || 'info'
          });
        }
      });
    }
    renderDecisionLog();
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
          modifiers: normalizeEnemyModifiers(enemy.modifiers)
        };
      });
    }

    enemies = restored;
    nextEnemyId = Math.max(maxId + 1, nextEnemyId);
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

    player.maxSkill = safeMaxSkill;
    player.maxStamina = safeMaxStamina;
    player.maxLuck = safeMaxLuck;

    player.skill = clamp(parseNumber(savedPlayer.skill, player.skill || safeMaxSkill, 0, 999), 0, player.maxSkill || 999);
    player.stamina = clamp(parseNumber(savedPlayer.stamina, player.stamina || safeMaxStamina, 0, 999), 0, player.maxStamina || 999);
    player.luck = clamp(parseNumber(savedPlayer.luck, player.luck || safeMaxLuck, 0, 999), 0, player.maxLuck || 999);
    player.meals = parseNumber(savedPlayer.meals, player.meals, 0, 999);

    player.potion = typeof savedPlayer.potion === 'string' ? savedPlayer.potion : null;
    player.potionUsed = Boolean(savedPlayer.potionUsed);

    initialStats.skill = parseNumber(savedInitial.skill, initialStats.skill || 0, 0, 999);
    initialStats.stamina = parseNumber(savedInitial.stamina, initialStats.stamina || 0, 0, 999);
    initialStats.luck = parseNumber(savedInitial.luck, initialStats.luck || 0, 0, 999);
    updateInitialStatsDisplay();

    renderPotionStatus();
    syncPlayerInputs();
  };

  const applyPlayerModifiers = (savedModifiers = {}) => {
    playerModifiers.damageDone = parseNumber(savedModifiers.damageDone, 0, -99, 99);
    playerModifiers.damageReceived = parseNumber(savedModifiers.damageReceived, 0, -99, 99);
    playerModifiers.skillBonus = parseNumber(savedModifiers.skillBonus, 0, -99, 99);
    renderPlayerModifierSummary();
  };

  const buildSavePayload = (pageNumberLabel) => ({
    version: 3,
    savedAt: new Date().toISOString(),
    pageNumber: pageNumberLabel,
    player: { ...player },
    initialStats: { ...initialStats },
    playerModifiers: { ...playerModifiers },
    notes: getNotesState(),
    enemies: enemies.map((enemy) => ({ ...enemy })),
    log: logHistory.map((entry) => ({ ...entry })),
    decisionLog: decisionLogHistory.map((entry) => ({ ...entry }))
  });

  // Produce a filesystem-safe timestamp that is still easy to read in save filenames.
  const formatFilenameTimestamp = () => {
    const now = new Date();
    const pad = (value) => String(value).padStart(2, '0');
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_${pad(now.getHours())}-${pad(now.getMinutes())}`;
  };

  const downloadSave = (payload, pageNumberLabel) => {
    const json = JSON.stringify(payload, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const timestamp = formatFilenameTimestamp();
    const safePage = pageNumberLabel && String(pageNumberLabel).trim() ? `page-${String(pageNumberLabel).trim()}` : 'page-unknown';
    const filename = `ff-save-${safePage}-${timestamp}.json`;
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  // Guide the player through choosing a page label before downloading the save JSON.
  const showSaveDialog = () => {
    const { modal, close } = createModal(
      'Save Game',
      'Enter the page number you stopped on to label the save file.',
      { compact: true }
    );

    const form = document.createElement('div');
    form.className = 'modal-form';

    const field = document.createElement('div');
    field.className = 'modal-field';

    const label = document.createElement('label');
    label.textContent = 'Page Number';
    label.htmlFor = 'save-page-number';
    const pageInput = document.createElement('input');
    pageInput.id = 'save-page-number';
    pageInput.type = 'number';
    pageInput.min = '1';
    pageInput.placeholder = 'e.g. 237';

    field.appendChild(label);
    field.appendChild(pageInput);
    form.appendChild(field);

    const actions = document.createElement('div');
    actions.className = 'modal-actions';
    const cancel = document.createElement('button');
    cancel.className = 'btn btn-negative';
    cancel.textContent = 'Cancel';
    const saveButton = document.createElement('button');
    saveButton.className = 'btn btn-positive';
    saveButton.textContent = 'Download Save';

    actions.appendChild(cancel);
    actions.appendChild(saveButton);
    form.appendChild(actions);

    modal.appendChild(form);

    cancel.addEventListener('click', () => close());
    saveButton.addEventListener('click', () => {
      const pageValue = pageInput.value.trim();
      const payload = buildSavePayload(pageValue || 'Unknown');
      downloadSave(payload, pageValue);
      logMessage(`Game saved${pageValue ? ` on Page ${pageValue}` : ''}.`, 'success');
      close();
    });
  };

  const showDecisionDialog = () => {
    const { modal, close } = createModal(
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
    pageInput.placeholder = 'e.g. 120';
    pageField.appendChild(pageLabel);
    pageField.appendChild(pageInput);

    const decisionField = document.createElement('div');
    decisionField.className = 'modal-field';
    const decisionLabel = document.createElement('label');
    decisionLabel.textContent = 'Decision';
    decisionLabel.htmlFor = 'decision-text';
    const decisionInput = document.createElement('textarea');
    decisionInput.id = 'decision-text';
    decisionInput.placeholder = 'e.g. Took the west tunnel';
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
    addButton.addEventListener('click', () => {
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

      addDecisionLogEntry(pageValue, decisionValue);
      close();
    });
  };

  // Restore core data in a predictable order so fields sync correctly.
  const applySaveData = (data) => {
    applyPlayerState(data.player, data.initialStats);
    applyPlayerModifiers(data.playerModifiers || {});
    applyNotesState(data.notes);
    applyEnemiesState(data.enemies);
    applyLogState(Array.isArray(data.log) ? data.log : []);
    applyDecisionLogState(Array.isArray(data.decisionLog) ? data.decisionLog : []);
    logMessage(`Save loaded${data.pageNumber ? ` from Page ${data.pageNumber}` : ''}.`, 'success');
  };

  // Read a JSON save from disk, validate the minimal shape, then hydrate state.
  const handleLoadFile = (event) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }
    const reader = new FileReader();
    reader.onload = (loadEvent) => {
      try {
        const parsed = JSON.parse(loadEvent.target.result);
        if (!parsed.player || !parsed.initialStats) {
          throw new Error('Save missing required fields.');
        }
        applySaveData(parsed);
      } catch (error) {
        console.error('Failed to load save', error);
        alert('Could not load save file. Please ensure it is a valid Fighting Fantasy save.');
      } finally {
        event.target.value = '';
      }
    };
    reader.readAsText(file);
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
      subline: 'You escape, lose 2 Stamina.'
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
      subline: 'Your strike lands!'
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
      subline: 'Unlucky.'
    }
  };

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
  const createModal = (title, description, options = {}) => {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.setAttribute('aria-hidden', 'true');

    const modal = document.createElement('div');
    modal.className = 'modal';
    if (options.compact) {
      modal.classList.add('modal-compact');
    }

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
    overlay.setAttribute('aria-hidden', 'false');

    // Keep a simple focus map that works across buttons, form controls, and intentional tabindex targets.
    const focusableSelectors = [
      'button',
      '[href]',
      'input',
      'select',
      'textarea',
      '[tabindex]:not([tabindex="-1"])'
    ];

    const getFocusableElements = () => Array.from(
      modal.querySelectorAll(focusableSelectors.join(','))
    ).filter((el) => !el.hasAttribute('disabled') && el.tabIndex !== -1 && el.offsetParent !== null);

    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;

    const focusFirstInteractive = () => {
      const focusable = getFocusableElements();
      if (focusable.length > 0) {
        focusable[0].focus();
        return;
      }
      // Keep the modal itself keyboard reachable when it has no interactive children yet.
      modal.tabIndex = -1;
      modal.focus();
    };

    const trapFocus = (event) => {
      if (event.key !== 'Tab') {
        return;
      }
      const focusable = getFocusableElements();
      if (focusable.length === 0) {
        event.preventDefault();
        modal.focus();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    const close = () => {
      overlay.setAttribute('aria-hidden', 'true');
      overlay.removeEventListener('keydown', handleKeydown);
      overlay.remove();
      if (previouslyFocused && document.body.contains(previouslyFocused)) {
        previouslyFocused.focus();
      }
    };

    const handleKeydown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        close();
      }
      trapFocus(event);
    };

    overlay.addEventListener('keydown', handleKeydown);
    focusFirstInteractive();

    return { overlay, modal, close };
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
  });

  const syncPlayerInputs = () => {
    inputs.skill.value = player.skill;
    inputs.stamina.value = player.stamina;
    inputs.luck.value = player.luck;
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
    applyButton.className = 'btn btn-positive';
    applyButton.textContent = 'Start Adventure';
    applyButton.disabled = true;

    const cancelButton = document.createElement('button');
    cancelButton.className = 'btn btn-negative';
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
  };

  // General-purpose dice roller for ad-hoc checks outside of combat or Luck.
  const generalRollOptions = [
    { value: '1d6', label: '1D6', roll: () => rollCustomDice(1, 6) },
    { value: '1d4', label: '1D4', roll: () => rollCustomDice(1, 4) },
    { value: '1d2', label: '1D2', roll: () => rollCustomDice(1, 2) },
    { value: '2d6', label: '2D6', roll: () => rollCustomDice(2, 6) },
    { value: 'percent', label: 'Percent Die', roll: () => rollCustomDice(1, 100) }
  ];

  const logGeneralRollResult = (label, rollResult) => {
    const detail = rollResult.values.length > 1
      ? `${rollResult.values.join(' + ')} = ${rollResult.total}`
      : `${rollResult.total}`;
    logMessage(`Rolled ${label}: ${detail}.`, 'info');
  };

  const showGeneralRollDialog = () => {
    const { modal, close } = createModal('Roll Dice', 'Choose dice for miscellaneous rolls.', { compact: true });

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
        const enemyLabel = formatEnemyName(enemy);
        option.textContent = `${enemyLabel} (Skill ${enemy.skill || 0}, Stamina ${enemy.stamina || 0})`;
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

  // Player interactions ----------------------------------------------------
  const handleEatMeal = () => {
    if (player.meals <= 0) {
      alert('No meals left.');
      return;
    }
    player.meals -= 1;
    player.stamina = clamp(player.stamina + 4, 0, player.maxStamina);
    syncPlayerInputs();
    logMessage('You eat a meal and regain 4 Stamina.', 'success');
    showActionVisual('eatMeal');
  };

  const escapeCombat = () => {
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
  };

  const showPlayerModifierDialog = () => {
    const { modal, close } = createModal(
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
      logMessage('Player modifiers updated.', 'info');
      close();
    });

    actions.appendChild(cancel);
    actions.appendChild(apply);
    form.appendChild(actions);
    modal.appendChild(form);
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
    const parts = [
      formatModifierPart(playerModifiers.damageDone, '⚔️'),
      formatModifierPart(playerModifiers.damageReceived, '🛡️'),
      formatModifierPart(playerModifiers.skillBonus, '✨')
    ].filter(Boolean);

    playerModifierChip.textContent = parts.length ? `Hero mods: ${parts.join(' ')}` : '';
  };

  const summarizeEnemyModifiers = (enemy) => {
    const modifiers = getEnemyModifiers(enemy);
    const damageFromPlayer = modifiers.damageReceived + modifiers.playerDamageBonus + playerModifiers.damageDone;
    const damageToPlayer = modifiers.damageDealt + modifiers.playerDamageTakenBonus + playerModifiers.damageReceived;

    const pieces = [];
    if (modifiers.damageReceived !== 2 || modifiers.playerDamageBonus || playerModifiers.damageDone) {
      pieces.push(`🛡️${Math.max(0, damageFromPlayer)}`);
    }
    if (modifiers.damageDealt !== 2 || modifiers.playerDamageTakenBonus || playerModifiers.damageReceived) {
      pieces.push(`🗡️${Math.max(0, damageToPlayer)}`);
    }
    return pieces.join(' ');
  };

  const calculateDamageToEnemy = (enemy) => {
    const modifiers = getEnemyModifiers(enemy);
    const adjusted = modifiers.damageReceived + playerModifiers.damageDone + modifiers.playerDamageBonus;
    return Math.max(0, adjusted);
  };

  const calculateDamageToPlayer = (enemy) => {
    const modifiers = getEnemyModifiers(enemy);
    const adjusted = modifiers.damageDealt + playerModifiers.damageReceived + modifiers.playerDamageTakenBonus;
    return Math.max(0, adjusted);
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

      const header = document.createElement('div');
      header.className = 'enemy-header';

      const title = document.createElement('strong');
      title.textContent = formatEnemyName(enemy);
      header.appendChild(title);

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

      header.appendChild(stats);
      const enemyModifierChip = document.createElement('span');
      enemyModifierChip.className = 'modifier-chip';
      enemyModifierChip.textContent = summarizeEnemyModifiers(enemy);
      header.appendChild(enemyModifierChip);
      box.appendChild(header);

      const actions = document.createElement('div');
      actions.className = 'enemy-actions';

      const attackButton = document.createElement('button');
      attackButton.textContent = 'Attack';
      attackButton.className = 'btn btn-positive attack-button';
      attackButton.addEventListener('click', () => performAttack(index));
      actions.appendChild(attackButton);

      const modifierButton = document.createElement('button');
      modifierButton.textContent = 'Modifier';
      modifierButton.className = 'btn btn-neutral';
      modifierButton.addEventListener('click', () => showEnemyModifierDialog(index));
      actions.appendChild(modifierButton);

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
    const { modal, close } = createModal(
      `Modify ${formatEnemyName(enemy)}`,
      'Adjust how this foe trades damage with you.',
      { compact: true }
    );

    const form = document.createElement('div');
    form.className = 'modal-form';

    const fields = [
      {
        id: 'damage-dealt',
        label: 'Damage to you on a hit',
        value: modifiers.damageDealt,
        min: 0,
        helper: 'Set how much damage this enemy inflicts when it wins a round.'
      },
      {
        id: 'damage-received',
        label: 'Damage it takes on a hit',
        value: modifiers.damageReceived,
        min: 0,
        helper: 'Set how much damage this enemy suffers when you win a round.'
      },
      {
        id: 'player-damage-bonus',
        label: 'Extra damage you deal to this enemy',
        value: modifiers.playerDamageBonus,
        min: -99,
        max: 99,
        helper: 'Bonus (or penalty) applied after your own modifiers.'
      },
      {
        id: 'player-damage-taken',
        label: 'Extra damage you take from this enemy',
        value: modifiers.playerDamageTakenBonus,
        min: -99,
        max: 99,
        helper: 'Bonus (or penalty) added after your own damage received modifier.'
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
        damageDealt: inputsMap['damage-dealt'].value,
        damageReceived: inputsMap['damage-received'].value,
        playerDamageBonus: inputsMap['player-damage-bonus'].value,
        playerDamageTakenBonus: inputsMap['player-damage-taken'].value
      });
      enemy.modifiers = updated;
      renderEnemies();
      logMessage(`${formatEnemyName(enemy)} modifiers updated.`, 'info');
      close();
    });

    actions.appendChild(cancel);
    actions.appendChild(apply);
    form.appendChild(actions);
    modal.appendChild(form);
  };

  function addEnemy(initial = { skill: 0, stamina: 0 }) {
    const safeId = Number.isFinite(initial?.id) ? initial.id : nextEnemyId++;
    nextEnemyId = Math.max(nextEnemyId, safeId + 1);

    const enemy = {
      id: safeId,
      name: typeof initial?.name === 'string' && initial.name.trim() ? initial.name : `Enemy ${safeId}`,
      skill: parseNumber(initial.skill, 0, 0, 999),
      stamina: parseNumber(initial.stamina, 0, 0, 999),
      modifiers: normalizeEnemyModifiers(initial.modifiers || createDefaultEnemyModifiers())
    };

    enemies.push(enemy);
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
    logMessage(`Testing Luck: rolled ${roll} vs ${player.luck + 1}. ${isLucky ? 'Lucky!' : 'Unlucky.'}`, 'action');

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
        logMessage('The selected enemy is no longer present.', 'warning');
        return { outcome: 'missing', lucky: isLucky };
      }

      const adjustment = isLucky ? -2 : 1;
      enemy.stamina = Math.max(0, enemy.stamina + adjustment);
      const enemyLabel = formatEnemyName(enemy);
      logMessage(
        isLucky
          ? `Lucky strike! ${enemyLabel} loses an additional 2 Stamina.`
          : `Unlucky! ${enemyLabel} regains 1 Stamina.`,
        isLucky ? 'success' : 'danger'
      );

      if (enemy.stamina === 0) {
        logMessage(`${enemyLabel} is defeated.`, 'success');
        removeEnemy(context.index);
      } else {
        renderEnemies();
      }
    } else if (context.type === 'playerHitByEnemy') {
      const adjustment = isLucky ? 1 : -1;
      player.stamina = clamp(player.stamina + adjustment, 0, player.maxStamina);
      syncPlayerInputs();
      logMessage(
        isLucky
          ? 'Lucky! You reduce the damage by gaining 1 Stamina.'
          : 'Unlucky! You lose an additional 1 Stamina.',
        isLucky ? 'success' : 'danger'
      );
      showActionVisual(isLucky ? 'blockEnemy' : 'enemyHitYou');
    }
    return { outcome: context.type, lucky: isLucky };
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
    logMessage(`Combat vs ${enemyLabel}: Monster ${monsterAttack} vs Player ${playerAttack}.`, 'action');

    if (monsterAttack === playerAttack) {
      logMessage('Standoff! No damage dealt.', 'info');
      return;
    }

    let defeated = false;
    if (playerAttack > monsterAttack) {
      const damageToEnemy = calculateDamageToEnemy(enemy);
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
      const damageToPlayer = calculateDamageToPlayer(enemy);
      player.stamina = clamp(player.stamina - damageToPlayer, 0, player.maxStamina);
      syncPlayerInputs();
      logMessage(`${enemyLabel} hits you for ${damageToPlayer} damage.`, 'danger');
      const wantsLuck = confirm('You took damage. Use Luck to reduce it?');
      if (wantsLuck) {
        testLuck({ type: 'playerHitByEnemy', index });
      }

      // Only trigger the combat defeat art once Luck adjustments settle on zero Stamina.
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
      logMessage('Potion of Skill used. Skill restored to max.', 'success');
      potionSubline = 'Skill returns to its peak.';
    } else if (player.potion === 'Potion of Strength') {
      player.stamina = player.maxStamina;
      logMessage('Potion of Strength used. Stamina restored to max.', 'success');
      potionSubline = 'Stamina surges to full.';
    } else if (player.potion === 'Potion of Fortune') {
      player.maxLuck += 1;
      player.luck = player.maxLuck;
      logMessage('Potion of Fortune used. Luck increased and restored.', 'success');
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
      logMessage(`${player.potion} selected.`, 'info');
      renderPotionStatus();
      if (onSelected) {
        onSelected(choice);
      }
    }, () => {
      if (onCancelled) {
        onCancelled();
      } else {
        logMessage('Potion selection cancelled.', 'warning');
      }
    });
  };

  const newGame = () => {
    // Do not finalize state until the player confirms their potion to avoid recursion loops on cancel.
    showStatRollDialog((rolls) => {
      const applyNewGameState = (potionChoice) => {
        player.skill = player.maxSkill = rolls.skill;
        player.stamina = player.maxStamina = rolls.stamina;
        player.luck = player.maxLuck = rolls.luck;
        player.meals = 10;
        player.potion = potionChoice;
        player.potionUsed = false;
        playerModifiers.damageDone = 0;
        playerModifiers.damageReceived = 0;
        playerModifiers.skillBonus = 0;

        initialStats.skill = rolls.skill;
        initialStats.stamina = rolls.stamina;
        initialStats.luck = rolls.luck;
        updateInitialStatsDisplay();

        document.getElementById('gold').value = '';
        document.getElementById('treasure').value = '';
        document.getElementById('equipment').value = '';
        document.getElementById('provisions').value = '';

        // Starting fresh should leave the adventure log empty so previous runs do not leak context.
        logHistory.length = 0;

        enemies = [];
        nextEnemyId = 1;
        renderEnemies();
        decisionLogHistory.length = 0;
        renderDecisionLog();
        syncPlayerInputs();
        renderLog();
        logMessage('New game started. Roll results applied.', 'success');
        renderPotionStatus();
        showActionVisual('newGame');
      };

      selectPotion((choice) => applyNewGameState(choice), () => {
        logMessage('New game cancelled before choosing a potion. Current adventure continues.', 'warning');
      });
    });
  };

  // Allow non-combat failures to showcase the dedicated defeat art without altering stats.
  const playGameOverVisual = () => {
    logMessage('Game Over triggered outside combat.', 'danger');
    showActionVisual('lose');
  };

  // Wiring ----------------------------------------------------------------
  document.getElementById('eatMeal').addEventListener('click', handleEatMeal);
  document.getElementById('escape').addEventListener('click', escapeCombat);
  document.getElementById('testLuck').addEventListener('click', showLuckDialog);
  document.getElementById('playerModifier').addEventListener('click', showPlayerModifierDialog);
  document.getElementById('generalRoll').addEventListener('click', showGeneralRollDialog);
  document.getElementById('saveGame').addEventListener('click', showSaveDialog);
  document.getElementById('loadGame').addEventListener('click', () => loadFileInput.click());
  document.getElementById('newGame').addEventListener('click', newGame);
  document.getElementById('gameOver').addEventListener('click', playGameOverVisual);
  document.getElementById('usePotion').addEventListener('click', applyPotion);
  loadFileInput.addEventListener('change', handleLoadFile);

  document.getElementById('addEnemy').addEventListener('click', () => addEnemy());
  document.getElementById('addDecision').addEventListener('click', showDecisionDialog);
  bindPlayerInputs();
  renderEnemies();

  updateInitialStatsDisplay();
  renderPotionStatus();
  syncPlayerInputs();
  renderLog();
  renderDecisionLog();
})();
