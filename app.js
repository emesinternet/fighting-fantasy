(() => {
'use strict';

// Core player state is tracked separately from the inputs so we can enforce maxima and potion effects.
  const player = {
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
  const playerModifiers = {
    damageDone: 0,
    damageReceived: 0,
    skillBonus: 0
  };

  // Track the unmodifiable starting maxima so we can surface them alongside the inputs.
  const initialStats = {
    skill: 0,
    stamina: 0,
    luck: 0,
    magic: 0
  };

  const BOOK_OPTIONS = [
    'The Warlock of Firetop Mountain',
    'City of Thieves',
    'Citadel of Chaos',
    'Forest of Doom',
    'House of Hell',
    'Port of Peril',
    'Creature of Havoc',
    'Deathtrap Dungeon',
    'Appointment with F.E.A.R.',
    'Island of the Lizard King'
  ];

  let currentBook = '';

  // Catalog spells once so book rules can opt into them without duplicating definitions.
  const SPELL_LIBRARY = {
    creatureCopy: {
      key: 'creatureCopy',
      name: 'Creature Copy',
      description: 'Copy an enemy you are fighting, matching their Skill and Stamina.',
      effect: 'creatureCopy'
    },
    esp: {
      key: 'esp',
      name: 'E.S.P.',
      description: 'Psychic mind-control. May provide misleading information.',
      effect: 'log'
    },
    fire: {
      key: 'fire',
      name: 'Fire',
      description: 'All enemies are afraid of fire.',
      effect: 'log'
    },
    foolsGold: {
      key: 'foolsGold',
      name: "Fool's Gold",
      description: 'Turn ordinary rocks into gold temporarily.',
      effect: 'log'
    },
    illusion: {
      key: 'illusion',
      name: 'Illusion',
      description: 'Convincing illusion broken by interaction. Best against intelligent creatures.',
      effect: 'log'
    },
    levitation: {
      key: 'levitation',
      name: 'Levitation',
      description: 'Cast on objects, enemies, or yourself. Controlled while airborne.',
      effect: 'log'
    },
    luck: {
      key: 'luck',
      name: 'Luck',
      description: 'Restore Luck by half of its initial value (rounded down), up to the initial amount.',
      effect: 'restoreLuck'
    },
    shielding: {
      key: 'shielding',
      name: 'Shielding',
      description: 'Invisible shield that prevents touch. Ineffective against magic.',
      effect: 'log'
    },
    skill: {
      key: 'skill',
      name: 'Skill',
      description: 'Restore Stamina by half of its initial value (rounded down), up to the initial amount.',
      effect: 'restoreStamina'
    },
    strength: {
      key: 'strength',
      name: 'Strength',
      description: 'Greatly increases strength, which may be hard to control.',
      effect: 'log'
    },
    weakness: {
      key: 'weakness',
      name: 'Weakness',
      description: 'Makes strong enemies weak, but may not affect all foes.',
      effect: 'log'
    }
  };

  // Keep book-specific toggles modular so future titles can add custom stats or rules.
  const BOOK_RULES = {
    'Citadel of Chaos': {
      supportsPotions: false,
      supportsMeals: false,
      extraStats: {
        magic: {
          label: 'Magic',
          roll: () => {
            const dice = rollDice(2);
            const total = dice + 6;
            return { total, detail: `${dice} + 6 = ${total}` };
          },
          helper: 'Roll 2D6 + 6'
        }
      },
      spells: [
        SPELL_LIBRARY.creatureCopy,
        SPELL_LIBRARY.esp,
        SPELL_LIBRARY.fire,
        SPELL_LIBRARY.foolsGold,
        SPELL_LIBRARY.illusion,
        SPELL_LIBRARY.levitation,
        SPELL_LIBRARY.luck,
        SPELL_LIBRARY.shielding,
        SPELL_LIBRARY.skill,
        SPELL_LIBRARY.strength,
        SPELL_LIBRARY.weakness
      ],
      spellLimitStat: 'magic'
    }
  };

  let enemies = [];
  // Preserve stable enemy identifiers so names do not shift when the list changes.
  let nextEnemyId = 1;
  let preparedSpells = {};
  let preparedSpellLimit = 0;

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
  const mealControls = document.getElementById('mealControls');
  const potionControls = document.getElementById('potionControls');
  const spellsWrapper = document.getElementById('spellsWrapper');
  const spellsPanel = document.getElementById('spellsPanel');
  const spellsTable = document.getElementById('spellsTable');
  const spellsRemaining = document.getElementById('spellsRemaining');

  // Animation overlay elements for action highlights.
  const animationOverlay = document.getElementById('action-overlay');
  const animationImage = document.getElementById('action-image');
  const animationText = document.getElementById('action-text');
  const animationTimers = [];
  const ANIMATION_ENTRY_DURATION_MS = 900;
  const ANIMATION_HOLD_DURATION_MS = 2000;
  const ANIMATION_FADE_DURATION_MS = 360;
  const ANIMATION_TOTAL_DURATION_MS = ANIMATION_ENTRY_DURATION_MS
    + ANIMATION_HOLD_DURATION_MS
    + ANIMATION_FADE_DURATION_MS;

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

  // Format log entries with safe markup and lightweight emphasis to make combat updates easy to scan.
  const escapeHtml = (text) => text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

  const emphasizeLogTokens = (message) => {
    let safe = escapeHtml(message);
    safe = safe.replace(/\b(\d+)\b/g, '<span class="log-number">$1</span>');
    safe = safe.replace(/\b(Lucky!?|Unlucky!?|Skill|Stamina|Luck|Spell|damage|defeated|restored|increased|escape|escaped|potion)\b/gi,
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

  const renderSpellsPanel = () => {
    if (!spellsPanel || !spellsTable) {
      return;
    }
    const spellsAvailable = activeSpells();
    const supportsSpells = spellsAvailable.length > 0;
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
    }
  };

  const resetSpells = () => {
    preparedSpells = {};
    preparedSpellLimit = 0;
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
    renderSpellsPanel();
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
    version: 5,
    savedAt: new Date().toISOString(),
    pageNumber: pageNumberLabel,
    book: currentBook || null,
    player: { ...player },
    initialStats: { ...initialStats },
    playerModifiers: { ...playerModifiers },
    notes: getNotesState(),
    enemies: enemies.map((enemy) => ({ ...enemy })),
    log: logHistory.map((entry) => ({ ...entry })),
    decisionLog: decisionLogHistory.map((entry) => ({ ...entry })),
    spells: {
      prepared: { ...preparedSpells },
      limit: preparedSpellLimit
    }
  });

  // Produce a filesystem-safe timestamp that is still easy to read in save filenames.
  const formatFilenameTimestamp = () => {
    const now = new Date();
    const pad = (value) => String(value).padStart(2, '0');
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_${pad(now.getHours())}-${pad(now.getMinutes())}`;
  };

  // Sanitize book names so the chosen title can safely prefix downloaded saves.
  const formatBookForFilename = (bookName) => {
    if (!bookName) {
      return 'book-unknown';
    }
    const normalized = bookName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    return normalized || 'book-unknown';
  };

  const downloadSave = (payload, pageNumberLabel) => {
    const json = JSON.stringify(payload, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const timestamp = formatFilenameTimestamp();
    const safePage = pageNumberLabel && String(pageNumberLabel).trim() ? `page-${String(pageNumberLabel).trim()}` : 'page-unknown';
    const safeBook = formatBookForFilename(currentBook);
    const filename = `${safeBook}-ff-save-${safePage}-${timestamp}.json`;
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

      addDecisionLogEntry(pageValue, decisionValue);
      close();
    };

    addButton.addEventListener('click', attemptSave);
    overlay.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' && !event.shiftKey) {
        // Let Shift+Enter preserve new lines in the textarea while keeping a quick submit path.
        event.preventDefault();
        attemptSave();
      }
    });
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
      logMessage(`Adventure set for ${chosen}.`, 'info');
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
    overlay.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        finalizeSelection();
      }
    });
  };

  // Restore core data in a predictable order so fields sync correctly.
  const applySaveData = (data) => {
    setCurrentBook(typeof data.book === 'string' ? data.book : '');
    renderCurrentBook();
    updateStatVisibility();
    applyPlayerState(data.player, data.initialStats);
    applyPlayerModifiers(data.playerModifiers || {});
    applyNotesState(data.notes);
    applyEnemiesState(data.enemies);
    applyLogState(Array.isArray(data.log) ? data.log : []);
    applyDecisionLogState(Array.isArray(data.decisionLog) ? data.decisionLog : []);
    if (data.spells) {
      applySpellsState(data.spells);
    } else {
      resetSpells();
    }
    updateResourceVisibility();
    const bookDetail = currentBook ? ` for ${currentBook}` : '';
    logMessage(`Save loaded${data.pageNumber ? ` from Page ${data.pageNumber}` : ''}${bookDetail}.`, 'success');
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

    // Reset overlay visibility up front so new animations never overlap with a fading one.
    animationOverlay.classList.remove('is-visible');
    animationOverlay.setAttribute('aria-hidden', 'true');

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

    animationTimers.push(setTimeout(fadeOutAnimation, ANIMATION_ENTRY_DURATION_MS + ANIMATION_HOLD_DURATION_MS));
    animationTimers.push(setTimeout(
      resetAnimationClasses,
      ANIMATION_ENTRY_DURATION_MS + ANIMATION_HOLD_DURATION_MS + ANIMATION_FADE_DURATION_MS
    ));
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
    castSpell: {
      src: 'img/player-casts-spell.png',
      alt: 'The hero channels arcane energy',
      subline: 'You unleash a prepared spell.'
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
    playerFailAttack: {
      src: 'img/player-fail-attack.png',
      alt: 'The hero stumbles after a failed attack',
      subline: 'Your swing leaves you wide open.'
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

  // Give callers a simple way to wait for the overlay to finish before continuing a flow.
  const showActionVisualAndWait = (key, overrides = {}) => new Promise((resolve) => {
    showActionVisual(key, overrides);
    setTimeout(resolve, ANIMATION_TOTAL_DURATION_MS);
  });

  animationOverlay.addEventListener('click', closeAnimationOverlayInstantly);

  // Lightweight modal scaffolding to keep dialog creation tidy.
  const createModal = (title, description, options = {}) => {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.setAttribute('aria-hidden', 'true');

    const modal = document.createElement('div');
    modal.className = 'modal';
    if (options.wide) {
      modal.classList.add('modal-wide');
    }
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

  const baseStatConfigs = {
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
  const showStatRollDialog = (statSet, onComplete) => {
    const hasMagic = Boolean(statSet.magic);
    const { modal, close } = createModal(
      'Roll Your Stats',
      'Roll each stat as many times as you like, then start your adventure.',
      { wide: hasMagic }
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

  const showSpellSelectionDialog = ({ limit, spells, onConfirm, onCancel }) => {
    const { modal, close } = createModal(
      'Prepare Your Spells',
      'Spend your Magic to select spells for this adventure.'
    );

    const grid = document.createElement('div');
    grid.className = 'grid-four';

    const selection = {};
    const safeLimit = Math.max(0, limit || 0);
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
        onConfirm(selection, safeLimit);
      }
    });

    actions.appendChild(cancelButton);
    actions.appendChild(confirmButton);
    modal.appendChild(actions);
    updateSummary();
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

    const { modal, close } = createModal(title, description, { compact: true });

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
    logMessage(`Creature Copy creates an ally from ${formatEnemyName(enemyToCopy)}.`, 'success');
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
      logMessage(
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
      logMessage(
        gained > 0
          ? `${spell.name} restores ${gained} Stamina (up to ${maxStamina}).`
          : `${spell.name} has no effect; Stamina is already at its starting value.`,
        gained > 0 ? 'success' : 'info'
      );
      return;
    }

    logMessage(`Spell cast: ${spell.name}. ${spell.description}`, 'info');
  };

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
      logMessage(`${formatEnemyName(enemy)} modifiers updated.`, 'info');
      close();
    });

    actions.appendChild(cancel);
    actions.appendChild(apply);
    form.appendChild(actions);
    modal.appendChild(form);
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

      await showActionVisualAndWait('playerFailAttack');

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
          resetNotes();

          // Starting fresh should leave the adventure log empty so previous runs do not leak context.
          logHistory.length = 0;

          enemies = [];
          nextEnemyId = 1;
          renderEnemies();
          decisionLogHistory.length = 0;
          renderDecisionLog();
          syncPlayerInputs();
          renderLog();
          const bookLabel = currentBook || 'Unknown Book';
          logMessage(`New game started for ${bookLabel}. Roll results applied.`, 'success');
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
              logMessage('New game cancelled before choosing a potion. Current adventure continues.', 'warning');
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
            onCancel: () => logMessage('New game cancelled before selecting spells. Current adventure continues.', 'warning')
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
        logMessage('New game cancelled before selecting a book. Current adventure continues.', 'warning');
      }
    );
  };

  // Allow non-combat failures to showcase the dedicated defeat art without altering stats.
  const playGameOverVisual = () => {
    logMessage('Game Over triggered outside combat.', 'danger');
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
  document.getElementById('newGame').addEventListener('click', newGame);
  document.getElementById('gameOver').addEventListener('click', playGameOverVisual);
  document.getElementById('usePotion').addEventListener('click', applyPotion);
  loadFileInput.addEventListener('change', handleLoadFile);
  document.addEventListener('keydown', handleGlobalHotkeys);

  document.getElementById('addEnemy').addEventListener('click', () => addEnemy());
  document.getElementById('addDecision').addEventListener('click', showDecisionDialog);
  bindPlayerInputs();
  renderEnemies();

  updateInitialStatsDisplay();
  renderCurrentBook();
  renderPotionStatus();
  updateResourceVisibility();
  renderSpellsPanel();
  syncPlayerInputs();
  renderLog();
  renderDecisionLog();
})();
