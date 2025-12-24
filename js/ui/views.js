import { actionVisuals, ANIMATION_TIMING } from '../config.js';

const logToneIcons = {
  info: '📜',
  action: '⚔️',
  success: '✨',
  warning: '⚠️',
  danger: '💀'
};

const elements = {
  logEl: document.getElementById('log'),
  decisionLogEl: document.getElementById('decisionLog'),
  loadFileInput: document.getElementById('loadFileInput'),
  potionStatus: document.getElementById('potionStatus'),
  usePotionButton: document.getElementById('usePotion'),
  playerModifierChip: document.getElementById('playerModifierChip'),
  mealControls: document.getElementById('mealControls'),
  potionControls: document.getElementById('potionControls'),
  spellsWrapper: document.getElementById('spellsWrapper'),
  spellsPanel: document.getElementById('spellsPanel'),
  spellsTable: document.getElementById('spellsTable'),
  spellsRemaining: document.getElementById('spellsRemaining'),
  actionOverlay: document.getElementById('action-overlay'),
  actionImage: document.getElementById('action-image'),
  actionText: document.getElementById('action-text'),
  monsterList: document.getElementById('monsterList'),
  inputs: {
    skill: document.getElementById('skill'),
    stamina: document.getElementById('stamina'),
    luck: document.getElementById('luck'),
    magic: document.getElementById('magic'),
    meals: document.getElementById('meals')
  },
  startingBadges: {
    skill: document.getElementById('starting-skill'),
    stamina: document.getElementById('starting-stamina'),
    luck: document.getElementById('starting-luck'),
    magic: document.getElementById('starting-magic')
  },
  notes: {
    gold: document.getElementById('gold'),
    treasure: document.getElementById('treasure'),
    equipment: document.getElementById('equipment')
  }
};

export const getUIElements = () => elements;

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

export const renderLogList = ({
  container,
  entries,
  getIcon,
  formatMessage,
  showTimestamp = true,
  renderActions
}) => {
  container.innerHTML = '';

  entries.forEach((entry, index) => {
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
    if (renderActions) {
      const actions = renderActions(entry, index);
      if (actions) {
        row.appendChild(actions);
      }
    }
    container.appendChild(row);
  });
};

export const renderLog = (entries) => {
  renderLogList({
    container: elements.logEl,
    entries,
    getIcon: (entry) => logToneIcons[entry.tone] || logToneIcons.info,
    formatMessage: (entry) => entry.message
  });
};

export const renderDecisionLog = (entries, onEdit) => {
  renderLogList({
    container: elements.decisionLogEl,
    entries,
    getIcon: () => '🧭',
    formatMessage: (entry) => entry.message || `Page ${entry.pageNumber || '—'} — ${entry.decision}`,
    showTimestamp: false,
    renderActions: (_, index) => {
      if (!onEdit) return null;
      const actions = document.createElement('div');
      actions.className = 'log-entry-actions';
      const edit = document.createElement('button');
      edit.type = 'button';
      edit.className = 'edit-log-button';
      edit.title = 'Edit decision';
      edit.setAttribute('aria-label', 'Edit decision entry');
      edit.textContent = '✎';
      edit.addEventListener('click', () => onEdit(index));
      actions.appendChild(edit);
      return actions;
    }
  });
};

export const updateInitialStatsDisplay = (initialStats) => {
  const formatStat = (value) => (value ? value : '-');
  elements.startingBadges.skill.textContent = formatStat(initialStats.skill);
  elements.startingBadges.stamina.textContent = formatStat(initialStats.stamina);
  elements.startingBadges.luck.textContent = formatStat(initialStats.luck);
  if (elements.startingBadges.magic) {
    elements.startingBadges.magic.textContent = formatStat(initialStats.magic);
  }
};

export const updateStatVisibility = (activeStatConfigs) => {
  const hasMagic = Boolean(activeStatConfigs.magic);
  const magicLabel = document.getElementById('magic-stat');
  if (magicLabel) {
    magicLabel.classList.toggle('hidden', !hasMagic);
  }
};

export const renderCurrentBook = (currentBook) => {
  const baseTitle = 'Fighting Fantasy Companion';
  document.title = currentBook ? `${currentBook} | ${baseTitle}` : baseTitle;
};

export const renderPotionStatus = (player, potionsEnabled) => {
  if (!potionsEnabled) {
    elements.potionStatus.textContent = 'Potions are not available for this book.';
    elements.usePotionButton.disabled = true;
    return;
  }
  if (!player.potion) {
    elements.potionStatus.textContent = 'No potion selected.';
    elements.usePotionButton.disabled = true;
    return;
  }
  const used = player.potionUsed ? ' (used)' : '';
  elements.potionStatus.textContent = `${player.potion}${used}`;
  elements.usePotionButton.disabled = player.potionUsed;
};

export const renderPlayerModifierSummary = (playerModifiers) => {
  if (!elements.playerModifierChip) {
    return;
  }

  const formatModifierPart = (value, emoji) => {
    if (!value) {
      return '';
    }
    const prefix = value > 0 ? '+' : '';
    return `${emoji}${prefix}${value}`;
  };

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
  elements.playerModifierChip.textContent = summary;
  if (summary) {
    elements.playerModifierChip.title = `Damage dealt/taken and Skill bonus: ${parts.join(' ')}`;
  } else {
    elements.playerModifierChip.removeAttribute('title');
  }
};

export const syncPlayerInputs = (player) => {
  elements.inputs.skill.value = player.skill;
  elements.inputs.stamina.value = player.stamina;
  elements.inputs.luck.value = player.luck;
  if (elements.inputs.magic) {
    elements.inputs.magic.value = player.magic;
  }
  elements.inputs.meals.value = player.meals;
};

export const bindPlayerInputs = ({ onChange }) => {
  elements.inputs.skill.addEventListener('change', () => onChange('skill', elements.inputs.skill.value));
  elements.inputs.stamina.addEventListener('change', () => onChange('stamina', elements.inputs.stamina.value));
  elements.inputs.luck.addEventListener('change', () => onChange('luck', elements.inputs.luck.value));
  elements.inputs.meals.addEventListener('change', () => onChange('meals', elements.inputs.meals.value));
  if (elements.inputs.magic) {
    elements.inputs.magic.addEventListener('change', () => onChange('magic', elements.inputs.magic.value));
  }
};

export const getNotesState = () => ({
  gold: elements.notes.gold.value,
  treasure: elements.notes.treasure.value,
  equipment: elements.notes.equipment.value
});

export const applyNotesState = (savedNotes = {}) => {
  Object.entries(elements.notes).forEach(([key, element]) => {
    element.value = savedNotes[key] || '';
  });
};

export const resetNotes = () => {
  Object.values(elements.notes).forEach((field) => {
    field.value = '';
  });
};

export const renderSpellsPanel = ({ spellsAvailable, preparedSpells, preparedSpellLimit, onCastSpell }) => {
  const { spellsPanel, spellsTable, spellsWrapper, spellsRemaining } = elements;
  if (!spellsPanel || !spellsTable) {
    return;
  }
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
    return;
  }

  const activePrepared = Object.entries(preparedSpells || {})
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
      row.addEventListener('click', () => onCastSpell(spell.key));

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

  const remainingTotal = activePrepared.reduce((sum, spell) => sum + (spell.count || 0), 0);

  if (spellsRemaining) {
    const limitPart = preparedSpellLimit ? ` / ${preparedSpellLimit}` : '';
    spellsRemaining.textContent = `${remainingTotal}${limitPart ? ` left${limitPart}` : ' left'}`;
    spellsRemaining.title = 'Edit prepared spells';
  }
};

export const createEnemyStatInput = ({ label, value, onChange }) => {
  const wrapper = document.createElement('label');
  wrapper.className = 'inline-label';
  wrapper.textContent = `${label} `;

  const input = document.createElement('input');
  input.type = 'number';
  input.value = value;
  input.max = 999;
  input.min = 0;
  input.addEventListener('change', () => {
    onChange(input.value);
  });

  wrapper.appendChild(input);
  return wrapper;
};

export const renderEnemies = ({
  enemies,
  formatEnemyName,
  summarizeEnemyModifiers,
  onAttack,
  onCommandCopy,
  onRemove,
  onModifier,
  onUpdateEnemyStat
}) => {
  const container = elements.monsterList;
  container.innerHTML = '';

  if (!enemies.length) {
    const empty = document.createElement('p');
    empty.className = 'empty-enemies';
    empty.textContent = 'No enemies yet. Add foes as you encounter them.';
    container.appendChild(empty);
    return;
  }

  enemies.forEach((enemy, index) => {
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
      onChange: (nextSkill) => onUpdateEnemyStat(index, 'skill', nextSkill)
    });
    stats.appendChild(skillLabel);

    const staminaLabel = createEnemyStatInput({
      label: 'Stamina',
      value: enemy.stamina,
      onChange: (nextStamina) => onUpdateEnemyStat(index, 'stamina', nextStamina)
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
        onCommandCopy(index);
      } else {
        onAttack(index);
      }
    });
    actions.appendChild(attackButton);

    if (!enemy.isCopy) {
      const modifierButton = document.createElement('button');
      modifierButton.textContent = 'Modifier';
      modifierButton.className = 'btn btn-neutral';
      modifierButton.addEventListener('click', () => onModifier(index));
      actions.appendChild(modifierButton);
    }

    const removeButton = document.createElement('button');
    removeButton.textContent = 'Remove';
    removeButton.className = 'btn btn-negative remove-button';
    removeButton.addEventListener('click', () => onRemove(index));
    actions.appendChild(removeButton);

    box.appendChild(actions);
    container.appendChild(box);
  });
};

// Handle the overlay animation lifecycle: fade/slide in image, then text, hold, fade everything out.
const animationTimers = [];

const clearAnimationTimers = () => {
  while (animationTimers.length) {
    clearTimeout(animationTimers.pop());
  }
};

const resetAnimationClasses = () => {
  elements.actionImage.classList.remove('animate-in', 'animate-out');
  elements.actionText.classList.remove('animate-in', 'animate-out');
};

const fadeOutAnimation = () => {
  elements.actionImage.classList.remove('animate-in');
  elements.actionText.classList.remove('animate-in');
  elements.actionImage.classList.add('animate-out');
  elements.actionText.classList.add('animate-out');
  elements.actionOverlay.classList.remove('is-visible');
  elements.actionOverlay.setAttribute('aria-hidden', 'true');
};

export const closeAnimationOverlayInstantly = () => {
  clearAnimationTimers();
  resetAnimationClasses();

  const previousTransition = elements.actionOverlay.style.transition;
  elements.actionOverlay.style.transition = 'none';
  elements.actionOverlay.classList.remove('is-visible');
  elements.actionOverlay.setAttribute('aria-hidden', 'true');
  void elements.actionOverlay.offsetHeight; // force style recalculation
  elements.actionOverlay.style.transition = previousTransition;
};

export const playActionAnimation = () => {
  const { ENTRY_MS, HOLD_MS, FADE_MS } = ANIMATION_TIMING;
  clearAnimationTimers();
  resetAnimationClasses();

  elements.actionOverlay.classList.remove('is-visible');
  elements.actionOverlay.setAttribute('aria-hidden', 'true');

  void elements.actionImage.offsetWidth;
  void elements.actionText.offsetWidth;

  elements.actionOverlay.classList.add('is-visible');
  elements.actionOverlay.setAttribute('aria-hidden', 'false');

  animationTimers.push(setTimeout(() => {
    elements.actionImage.classList.add('animate-in');
  }, 40));

  animationTimers.push(setTimeout(() => {
    elements.actionText.classList.add('animate-in');
  }, 220));

  animationTimers.push(setTimeout(fadeOutAnimation, ENTRY_MS + HOLD_MS));
  animationTimers.push(setTimeout(
    resetAnimationClasses,
    ENTRY_MS + HOLD_MS + FADE_MS
  ));
};

export const showActionVisual = (key, overrides = {}) => {
  const visual = actionVisuals[key];
  if (!visual) {
    return;
  }
  const subline = overrides.subline || visual.subline;
  elements.actionImage.src = visual.src;
  elements.actionImage.alt = overrides.alt || visual.alt;
  elements.actionText.textContent = subline;
  playActionAnimation();
};

export const showActionVisualAndWait = (key, overrides = {}) => new Promise((resolve) => {
  const { ENTRY_MS, HOLD_MS, FADE_MS } = ANIMATION_TIMING;
  showActionVisual(key, overrides);
  setTimeout(resolve, ENTRY_MS + HOLD_MS + FADE_MS);
});

export const createModal = (title, description, options = {}) => {
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

elements.actionOverlay?.addEventListener('click', closeAnimationOverlayInstantly);
