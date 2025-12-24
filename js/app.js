import {
  BOOK_OPTIONS,
  BOOK_RULES,
  generalRollOptions as generalRollConfig,
  potionOptions,
  baseStatConfigs
} from './config.js';
import { rollDice, rollCustomDice, clamp, parseNumber } from './logic/dice.js';
import {
  player,
  playerModifiers,
  initialStats,
  preparedSpells,
  preparedSpellLimit,
  setCurrentBook,
  getCurrentBook,
  resetPreparedSpells,
  setPreparedSpells,
  resetPlayerModifiers,
  hydratePlayerState,
  setStartingStatsFromRolls
} from './state/playerState.js';
import {
  logHistory,
  decisionLogHistory,
  logMessage,
  addDecisionLogEntry,
  applyLogState,
  applyDecisionLogState,
  clearLogsForNewGame
} from './logic/logs.js';
import { buildSavePayload, downloadSave, readSaveFile } from './logic/persistence.js';
import {
  renderLog,
  renderDecisionLog,
  renderSpellsPanel,
  renderPotionStatus,
  renderPlayerModifierSummary,
  syncPlayerInputs,
  bindPlayerInputs,
  getNotesState,
  applyNotesState,
  resetNotes,
  renderCurrentBook,
  updateInitialStatsDisplay,
  updateStatVisibility,
  renderEnemies,
  createModal,
  showActionVisual,
  showActionVisualAndWait,
  getUIElements
} from './ui/views.js';
import {
  enemies,
  addEnemy,
  removeEnemy,
  applyEnemiesState,
  handleCreatureCopySpell,
  commandCopyAttack,
  escapeCombat as escapeCombatLogic,
  performAttack,
  summarizeEnemyModifiers,
  formatEnemyName,
  formatEnemyOptionLabel,
  getEnemyModifiers
} from './logic/combat.js';

const ui = getUIElements();

// Extend base stat configs with their roll logic.
const statConfigs = {
  ...baseStatConfigs,
  skill: {
    ...baseStatConfigs.skill,
    roll: () => {
      const dice = rollDice(1);
      const total = dice + 6;
      return { total, detail: `${dice} + 6 = ${total}` };
    }
  },
  stamina: {
    ...baseStatConfigs.stamina,
    roll: () => {
      const dice = rollDice(2);
      const total = dice + 12;
      return { total, detail: `${dice} + 12 = ${total}` };
    }
  },
  luck: {
    ...baseStatConfigs.luck,
    roll: () => {
      const dice = rollDice(1);
      const total = dice + 6;
      return { total, detail: `${dice} + 6 = ${total}` };
    }
  }
};

const generalRollOptions = generalRollConfig.map((option) => {
  if (option.value === '1d6') return { ...option, roll: () => rollCustomDice(1, 6) };
  if (option.value === '1d4') return { ...option, roll: () => rollCustomDice(1, 4) };
  if (option.value === '1d2') return { ...option, roll: () => rollCustomDice(1, 2) };
  if (option.value === '2d6') return { ...option, roll: () => rollCustomDice(2, 6) };
  if (option.value === 'percent') return { ...option, roll: () => rollCustomDice(1, 100) };
  return option;
});

const getActiveBookRules = () => BOOK_RULES[getCurrentBook()] || {};
const potionsEnabled = () => getActiveBookRules().supportsPotions !== false;
const mealsEnabled = () => getActiveBookRules().supportsMeals !== false;
const activeSpells = () => Array.isArray(getActiveBookRules().spells) ? getActiveBookRules().spells : [];
const activeStatConfigs = () => ({ ...statConfigs, ...(getActiveBookRules().extraStats || {}) });
const activeSpellLimitStat = () => getActiveBookRules().spellLimitStat;

const renderLogs = () => {
  renderLog(logHistory);
  renderDecisionLog(decisionLogHistory, editDecisionLogEntry);
};

const applyLogSnapshot = (savedLog = []) => {
  applyLogState(savedLog);
  renderLog(logHistory);
};

const applyDecisionLogSnapshot = (savedDecisions = []) => {
  applyDecisionLogState(savedDecisions);
  renderDecisionLog(decisionLogHistory, editDecisionLogEntry);
};

const log = (message, tone = 'info') => {
  logMessage(message, tone);
  renderLog(logHistory);
};

const addDecision = (pageNumber, decision) => {
  addDecisionLogEntry(pageNumber, decision);
  renderDecisionLog(decisionLogHistory, editDecisionLogEntry);
};

const enemyRenderOptions = () => ({
  enemies,
  formatEnemyName,
  summarizeEnemyModifiers,
  onAttack: (index) => performAttack(index, combatContext),
  onCommandCopy: (index) => commandCopyAttack(index, {
    showEnemySelectModal,
    renderEnemies: () => renderEnemies(enemyRenderOptions()),
    logMessage: log
  }),
  onRemove: (index) => {
    removeEnemy(index);
    renderEnemies(enemyRenderOptions());
  },
  onModifier: showEnemyModifierDialog,
  onUpdateEnemyStat: handleEnemyStatChange
});

const renderState = () => {
  renderLogs();
  renderPotionStatus(player, potionsEnabled());
  renderPlayerModifierSummary(playerModifiers);
  renderSpellsPanel({
    spellsAvailable: activeSpells(),
    preparedSpells,
    preparedSpellLimit,
    onCastSpell: castSpell
  });
  renderEnemies(enemyRenderOptions());
  syncPlayerInputs(player);
  updateInitialStatsDisplay(initialStats);
  renderCurrentBook(getCurrentBook());
  updateStatVisibility(activeStatConfigs());
};

const applySpellsState = (savedSpells = {}) => {
  const allowed = new Set(activeSpells().map((spell) => spell.key));
  const nextPrepared = {};
  if (savedSpells.prepared && typeof savedSpells.prepared === 'object') {
    Object.entries(savedSpells.prepared).forEach(([key, value]) => {
      const amount = parseNumber(value, 0, 0, 999);
      if (amount > 0 && allowed.has(key)) {
        nextPrepared[key] = amount;
      }
    });
  }

  const limit = parseNumber(
    savedSpells.limit,
    initialStats.magic || player.magic || 0,
    0,
    999
  );
  setPreparedSpells(nextPrepared, limit);
  renderSpellsPanel({
    spellsAvailable: activeSpells(),
    preparedSpells,
    preparedSpellLimit,
    onCastSpell: castSpell
  });
};

const updateResourceVisibility = () => {
  updateStatVisibility(activeStatConfigs());
  const potionsAvailable = potionsEnabled();
  if (ui.potionControls) {
    ui.potionControls.classList.toggle('hidden', !potionsAvailable);
  }
  if (!potionsAvailable) {
    player.potion = null;
    player.potionUsed = false;
  }

  const mealsAvailable = mealsEnabled();
  if (ui.mealControls) {
    ui.mealControls.classList.toggle('hidden', !mealsAvailable);
  }
  if (!mealsAvailable) {
    player.meals = 0;
  }
  syncPlayerInputs(player);
  renderPotionStatus(player, potionsEnabled());
  renderSpellsPanel({
    spellsAvailable: activeSpells(),
    preparedSpells,
    preparedSpellLimit,
    onCastSpell: castSpell
  });
};

const applySaveData = (data) => {
  setCurrentBook(typeof data.book === 'string' ? data.book : '');
  renderCurrentBook(getCurrentBook());
  updateStatVisibility(activeStatConfigs());
  hydratePlayerState(data.player, data.initialStats);
  resetPlayerModifiers();
  playerModifiers.damageDone = parseNumber(data.playerModifiers?.damageDone, 0, -99, 99);
  playerModifiers.damageReceived = parseNumber(data.playerModifiers?.damageReceived, 0, -99, 99);
  playerModifiers.skillBonus = parseNumber(data.playerModifiers?.skillBonus, 0, -99, 99);
  renderPlayerModifierSummary(playerModifiers);
  syncPlayerInputs(player);
  applyNotesState(data.notes);
  applyEnemiesState(data.enemies);
  renderEnemies(enemyRenderOptions());
  applyLogSnapshot(Array.isArray(data.log) ? data.log : []);
  applyDecisionLogSnapshot(Array.isArray(data.decisionLog) ? data.decisionLog : []);
  if (data.spells) {
    applySpellsState(data.spells);
  } else {
    resetPreparedSpells();
  }
  updateResourceVisibility();
  const bookDetail = getCurrentBook() ? ` for ${getCurrentBook()}` : '';
  log(`Save loaded${data.pageNumber ? ` from Page ${data.pageNumber}` : ''}${bookDetail}.`, 'success');
};

const handleLoadFile = async (event) => {
  const file = event.target.files?.[0];
  if (!file) {
    return;
  }
  try {
    const parsed = await readSaveFile(file);
    applySaveData(parsed);
  } catch (error) {
    console.error('Failed to load save', error);
    alert('Could not load save file. Please ensure it is a valid Fighting Fantasy save.');
  } finally {
    event.target.value = '';
  }
};

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
    const payload = buildSavePayload({
      pageNumber: pageValue || 'Unknown',
      book: getCurrentBook(),
      player,
      initialStats,
      playerModifiers,
      notes: getNotesState(),
      enemies,
      logHistory,
      decisionLogHistory,
      spells: {
        prepared: preparedSpells,
        limit: preparedSpellLimit
      }
    });
    downloadSave(payload, { book: getCurrentBook(), pageNumberLabel: pageValue });
    log(`Game saved${pageValue ? ` on Page ${pageValue}` : ''}.`, 'success');
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

    addDecision(pageValue, decisionValue);
    close();
  };

  addButton.addEventListener('click', attemptSave);
  overlay.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      attemptSave();
    }
  });
};

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
    if (book === getCurrentBook()) {
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
    renderCurrentBook(getCurrentBook());
    log(`Adventure set for ${chosen}.`, 'info');
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

const showStatRollDialog = (statSet, onComplete) => {
  const { modal, close } = createModal(
    'Roll Your Stats',
    'Roll each stat as many times as you like, then start your adventure.',
  );

  const statCount = Object.keys(statSet).length;
  const grid = document.createElement('div');
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

const showSpellSelectionDialog = ({ limit, spells, onConfirm, onCancel, initialSelection }) => {
  const { modal, close } = createModal(
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
};

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

const logGeneralRollResult = (label, rollResult) => {
  const detail = rollResult.values.length > 1
    ? `${rollResult.values.join(' + ')} = ${rollResult.total}`
    : `${rollResult.total}`;
  log(`Rolled ${label}: ${detail}.`, 'info');
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

const testLuck = (context) => {
  if (player.luck <= 0) {
    alert('You have no Luck remaining.');
    return { outcome: 'none', lucky: false };
  }

  const roll = rollDice(2);
  const isLucky = roll <= player.luck;
  player.luck = Math.max(0, player.luck - 1);
  syncPlayerInputs(player);
  renderPotionStatus(player, potionsEnabled());
  log(`Testing Luck: rolled ${roll} vs ${player.luck + 1}. ${isLucky ? 'Lucky!' : 'Unlucky.'}`, 'action');

  const isPlayerHittingEnemy = context?.type === 'playerHitEnemy';
  const isPlayerHitByEnemy = context?.type === 'playerHitByEnemy';

  let luckSubline = isLucky ? 'Luck holds firm.' : 'Luck slips away.';
  if (isPlayerHittingEnemy) {
    luckSubline = isLucky ? 'Extra damage lands true.' : 'The foe steadies.';
  } else if (isPlayerHitByEnemy) {
    luckSubline = isLucky ? 'You soften the blow.' : 'The wound deepens.';
  }

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
      log('The selected enemy is no longer present.', 'warning');
      return { outcome: 'missing', lucky: isLucky };
    }

    const adjustment = isLucky ? -2 : 1;
    enemy.stamina = Math.max(0, enemy.stamina + adjustment);
    const enemyLabel = formatEnemyName(enemy);
    log(
      isLucky
        ? `Lucky strike! ${enemyLabel} loses an additional 2 Stamina.`
        : `Unlucky! ${enemyLabel} regains 1 Stamina.`,
      isLucky ? 'success' : 'danger'
    );

    if (enemy.stamina === 0) {
      log(`${enemyLabel} is defeated.`, 'success');
      removeEnemy(context.index);
      renderEnemies(enemyRenderOptions());
    } else {
      renderEnemies(enemyRenderOptions());
    }
  } else if (context.type === 'playerHitByEnemy') {
    const adjustment = isLucky ? 1 : -1;
    player.stamina = clamp(player.stamina + adjustment, 0, player.maxStamina);
    syncPlayerInputs(player);
    log(
      isLucky
        ? 'Lucky! You reduce the damage by gaining 1 Stamina.'
        : 'Unlucky! You lose an additional 1 Stamina.',
      isLucky ? 'success' : 'danger'
    );
    showActionVisual(isLucky ? 'blockEnemy' : 'enemyHitYou');
  }
  return { outcome: context.type, lucky: isLucky };
};

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

const applySpellEffect = (spell) => {
  if (!spell) return;
  if (spell.effect === 'restoreLuck') {
    const restoreAmount = Math.floor((initialStats.luck || 0) / 2);
    const before = player.luck;
    const maxLuck = initialStats.luck || player.maxLuck || before;
    player.luck = Math.min(maxLuck, player.luck + restoreAmount);
    syncPlayerInputs(player);
    const gained = player.luck - before;
    log(
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
    syncPlayerInputs(player);
    const gained = player.stamina - before;
    log(
      gained > 0
        ? `${spell.name} restores ${gained} Stamina (up to ${maxStamina}).`
        : `${spell.name} has no effect; Stamina is already at its starting value.`,
      gained > 0 ? 'success' : 'info'
    );
    return;
  }

  log(`Spell cast: ${spell.name}. ${spell.description}`, 'info');
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
    const copied = await handleCreatureCopySpell({
      showEnemySelectModal,
      renderEnemies: () => renderEnemies(enemyRenderOptions()),
      logMessage: log
    });
    if (!copied) {
      return;
    }
    spendSpell();
  } else {
    spendSpell();
    applySpellEffect(spell);
  }

  renderSpellsPanel({
    spellsAvailable: activeSpells(),
    preparedSpells,
    preparedSpellLimit,
    onCastSpell: castSpell
  });
  showActionVisual('castSpell', { subline: spell.description || 'You unleash a prepared spell.' });
};

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
      setPreparedSpells(selection, Math.max(0, limitValue ?? usableLimit));
      renderSpellsPanel({
        spellsAvailable: activeSpells(),
        preparedSpells,
        preparedSpellLimit,
        onCastSpell: castSpell
      });
      log('Prepared spells updated.', 'info');
    },
    onCancel: () => log('Spell update cancelled.', 'warning')
  });
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
    renderPlayerModifierSummary(playerModifiers);
    renderEnemies(enemyRenderOptions());
    log('Player modifiers updated.', 'info');
    close();
  });

  actions.appendChild(cancel);
  actions.appendChild(apply);
  form.appendChild(actions);
  modal.appendChild(form);
};

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
    log('Potion of Skill used. Skill restored.', 'success');
    potionSubline = 'Skill returns to its peak.';
  } else if (player.potion === 'Potion of Strength') {
    player.stamina = player.maxStamina;
    log('Potion of Strength used. Stamina restored.', 'success');
    potionSubline = 'Stamina surges to full.';
  } else if (player.potion === 'Potion of Fortune') {
    player.maxLuck += 1;
    player.luck = player.maxLuck;
    log('Potion of Fortune used. Luck increased and restored.', 'success');
    initialStats.luck = player.maxLuck;
    updateInitialStatsDisplay(initialStats);
    potionSubline = 'Luck rises and refills.';
  }
  player.potionUsed = true;
  syncPlayerInputs(player);
  renderPotionStatus(player, potionsEnabled());
  showActionVisual('drinkPotion', { subline: potionSubline });
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
  syncPlayerInputs(player);
  log('You eat a meal and regain 4 Stamina.', 'success');
  showActionVisual('eatMeal');
};

const escapeCombat = () => {
  escapeCombatLogic({
    player,
    syncPlayerInputs: () => syncPlayerInputs(player),
    renderEnemies: () => renderEnemies(enemyRenderOptions()),
    showActionVisual,
    logMessage: log
  });
};

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

const combatContext = {
  player,
  playerModifiers,
  logMessage: log,
  showActionVisual,
  showActionVisualAndWait,
  promptLuckAfterPlayerHit,
  testLuck,
  syncPlayerInputs: () => syncPlayerInputs(player),
  renderEnemies: () => renderEnemies(enemyRenderOptions())
};

const newGame = () => {
  const startStatRolling = () => {
    const statsForBook = activeStatConfigs();
    showStatRollDialog(statsForBook, (rolls) => {
      const spellLimitKey = activeSpellLimitStat();
      const spellLimit = spellLimitKey ? parseNumber(rolls[spellLimitKey], 0, 0, 999) : 0;
      const finalizeNewGame = (potionChoice, spellSelection, limit) => {
        setStartingStatsFromRolls(rolls, {
          enableMeals: mealsEnabled(),
          potionChoice,
          enablePotions: potionsEnabled()
        });
        resetPlayerModifiers();

        setPreparedSpells(spellSelection || {}, parseNumber(limit ?? spellLimit, spellLimit, 0, 999));
        resetNotes();

        clearLogsForNewGame();

        enemies.length = 0;
        renderEnemies(enemyRenderOptions());
        renderDecisionLog(decisionLogHistory, editDecisionLogEntry);
        syncPlayerInputs(player);
        renderLogs();
        const bookLabel = getCurrentBook() || 'Unknown Book';
        log(`New game started for ${bookLabel}. Roll results applied.`, 'success');
        renderPotionStatus(player, potionsEnabled());
        renderSpellsPanel({
          spellsAvailable: activeSpells(),
          preparedSpells,
          preparedSpellLimit,
          onCastSpell: castSpell
        });
        updateResourceVisibility();
        showActionVisual('newGame');
      };

      const startPotionFlow = (spellSelection, limitValue = spellLimit) => {
        if (!potionsEnabled()) {
          finalizeNewGame(null, spellSelection, limitValue);
          return;
        }
        showPotionDialog(
          (choice) => finalizeNewGame(choice, spellSelection, limitValue),
          () => {
            log('New game cancelled before choosing a potion. Current adventure continues.', 'warning');
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
          onCancel: () => log('New game cancelled before selecting spells. Current adventure continues.', 'warning')
        });
      };

      startSpellFlow();
    });
  };

  showBookDialog(
    () => {
      updateResourceVisibility();
      updateStatVisibility(activeStatConfigs());
      startStatRolling();
    },
    () => {
      log('New game cancelled before selecting a book. Current adventure continues.', 'warning');
    }
  );
};

const playGameOverVisual = () => {
  log('Game Over triggered outside combat.', 'danger');
  showActionVisual('lose');
};

const handlePlayerInputChange = (field, value) => {
  if (field === 'skill') {
    player.skill = clamp(parseInt(value, 10) || 0, 0, 999);
    player.maxSkill = Math.max(player.maxSkill, player.skill);
    ui.inputs.skill.value = player.skill;
  } else if (field === 'stamina') {
    player.stamina = clamp(parseInt(value, 10) || 0, 0, 999);
    player.maxStamina = Math.max(player.maxStamina, player.stamina);
    ui.inputs.stamina.value = player.stamina;
  } else if (field === 'luck') {
    player.luck = clamp(parseInt(value, 10) || 0, 0, 999);
    player.maxLuck = Math.max(player.maxLuck, player.luck);
    ui.inputs.luck.value = player.luck;
  } else if (field === 'meals') {
    player.meals = clamp(parseInt(value, 10) || 0, 0, 999);
    syncPlayerInputs(player);
  } else if (field === 'magic') {
    player.magic = clamp(parseInt(value, 10) || 0, 0, 999);
    player.maxMagic = Math.max(player.maxMagic, player.magic);
    if (ui.inputs.magic) {
      ui.inputs.magic.value = player.magic;
    }
  }
};

const isTypingInForm = () => {
  const active = document.activeElement;
  if (!active || !(active instanceof HTMLElement)) {
    return false;
  }
  const tag = active.tagName?.toLowerCase();
  return active.isContentEditable || ['input', 'textarea', 'select'].includes(tag);
};

const handleEnemyStatChange = (index, field, value) => {
  const enemy = enemies[index];
  if (!enemy) {
    return;
  }
  enemy[field] = parseNumber(value, enemy[field], 0, 999);
  renderEnemies(enemyRenderOptions());
};

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
    renderEnemies(enemyRenderOptions());
    log(`${formatEnemyName(enemy)} modifiers updated.`, 'info');
    close();
  });

  actions.appendChild(cancel);
  actions.appendChild(apply);
  form.appendChild(actions);
  modal.appendChild(form);
};

const editDecisionLogEntry = (index) => {
  const entry = decisionLogHistory[index];
  if (!entry) {
    alert('That decision could not be found.');
    return;
  }

  const { overlay, modal, close } = createModal(
    'Edit Decision',
    'Update the logged page number or wording for this decision.',
    { compact: true }
  );

  const form = document.createElement('div');
  form.className = 'modal-form';

  const pageField = document.createElement('div');
  pageField.className = 'modal-field';
  const pageLabel = document.createElement('label');
  pageLabel.textContent = 'Page Number';
  pageLabel.htmlFor = 'decision-edit-page-number';
  const pageInput = document.createElement('input');
  pageInput.id = 'decision-edit-page-number';
  pageInput.type = 'number';
  pageInput.min = '1';
  pageInput.placeholder = 'e.g. 120';
  pageInput.value = entry.pageNumber || '';
  pageField.appendChild(pageLabel);
  pageField.appendChild(pageInput);

  const decisionField = document.createElement('div');
  decisionField.className = 'modal-field';
  const decisionLabel = document.createElement('label');
  decisionLabel.textContent = 'Decision';
  decisionLabel.htmlFor = 'decision-edit-text';
  const decisionInput = document.createElement('textarea');
  decisionInput.id = 'decision-edit-text';
  decisionInput.placeholder = 'e.g. Took the west tunnel';
  decisionInput.value = entry.decision || entry.message || '';
  decisionField.appendChild(decisionLabel);
  decisionField.appendChild(decisionInput);

  form.appendChild(pageField);
  form.appendChild(decisionField);

  const actions = document.createElement('div');
  actions.className = 'modal-actions';
  const cancel = document.createElement('button');
  cancel.className = 'btn btn-negative';
  cancel.textContent = 'Cancel';
  const save = document.createElement('button');
  save.className = 'btn btn-positive';
  save.textContent = 'Save Changes';

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
    entry.pageNumber = pageValue;
    entry.decision = decisionValue;
    entry.message = `Page ${pageValue}: ${decisionValue}`;
    entry.timestamp = entry.timestamp || new Date().toISOString();
    renderDecisionLog(decisionLogHistory, editDecisionLogEntry);
    log('Decision updated for Page ' + pageValue + '.', 'info');
    close();
  };

  cancel.addEventListener('click', close);
  save.addEventListener('click', attemptSave);
  overlay.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      attemptSave();
    }
  });

  actions.appendChild(cancel);
  actions.appendChild(save);
  form.appendChild(actions);
  modal.appendChild(form);
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
    renderEnemies(enemyRenderOptions());
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
    ui.loadFileInput.click();
    return;
  }

  if (/^[1-9]$/.test(key)) {
    const index = parseInt(key, 10) - 1;
    if (enemies[index]) {
      event.preventDefault();
      performAttack(index, combatContext);
    }
  }
};

bindPlayerInputs({ onChange: handlePlayerInputChange });

document.getElementById('eatMeal').addEventListener('click', handleEatMeal);
document.getElementById('escape').addEventListener('click', escapeCombat);
document.getElementById('testLuck').addEventListener('click', showLuckDialog);
document.getElementById('playerModifier').addEventListener('click', showPlayerModifierDialog);
document.getElementById('generalRoll').addEventListener('click', showGeneralRollDialog);
document.getElementById('saveGame').addEventListener('click', showSaveDialog);
document.getElementById('loadGame').addEventListener('click', () => ui.loadFileInput.click());
document.getElementById('newGame').addEventListener('click', newGame);
document.getElementById('gameOver').addEventListener('click', playGameOverVisual);
document.getElementById('usePotion').addEventListener('click', applyPotion);
ui.loadFileInput.addEventListener('change', handleLoadFile);
document.addEventListener('keydown', handleGlobalHotkeys);

document.getElementById('addEnemy').addEventListener('click', () => {
  addEnemy();
  renderEnemies(enemyRenderOptions());
});
document.getElementById('addDecision').addEventListener('click', showDecisionDialog);
if (ui.spellsRemaining) {
  ui.spellsRemaining.addEventListener('click', managePreparedSpells);
}

updateInitialStatsDisplay(initialStats);
renderCurrentBook(getCurrentBook());
renderPotionStatus(player, potionsEnabled());
updateResourceVisibility();
renderSpellsPanel({
  spellsAvailable: activeSpells(),
  preparedSpells,
  preparedSpellLimit,
  onCastSpell: castSpell
});
syncPlayerInputs(player);
renderLogs();
renderDecisionLog(decisionLogHistory, editDecisionLogEntry);
renderEnemies(enemyRenderOptions());
