(() => {
  'use strict';

  const { parseNumber } = window.ffApp.utils;
  const { bindDefaultEnterAction, createModal } = window.ffApp.ui;
  const { logs } = window.ffApp;
  const state = window.ffApp.state;

  let preparedSpells = state.preparedSpells;
  let preparedSpellLimit = state.preparedSpellLimit;
  const getActiveSpells = () => (typeof window.ffApp.getActiveSpells === 'function'
    ? window.ffApp.getActiveSpells()
    : []);
  const getActiveSpellLimitStat = () => (typeof window.ffApp.getActiveSpellLimitStat === 'function'
    ? window.ffApp.getActiveSpellLimitStat()
    : null);

  const renderSpellsPanel = () => {
    const spellsPanel = document.getElementById('spellsPanel');
    const spellsTable = document.getElementById('spellsTable');
    const spellsWrapper = document.getElementById('spellsWrapper');
    const spellsRemaining = document.getElementById('spellsRemaining');
    if (!spellsPanel || !spellsTable) {
      return;
    }
    const spellsAvailable = getActiveSpells();
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
      state.preparedSpells = preparedSpells;
      state.preparedSpellLimit = preparedSpellLimit;
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
        row.addEventListener('click', () => window.ffApp.castSpell(spell.key));

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
      spellsRemaining.textContent = `${remainingTotal} left`;
      spellsRemaining.title = 'Edit prepared spells';
    }
  };

  const resetSpells = () => {
    preparedSpells = {};
    preparedSpellLimit = 0;
    state.preparedSpells = preparedSpells;
    state.preparedSpellLimit = preparedSpellLimit;
    renderSpellsPanel();
  };

  const applySpellsState = (savedSpells = {}, initialStats = {}, player = {}) => {
    preparedSpellLimit = parseNumber(savedSpells.limit, initialStats.magic || player.magic || 0, 0, 999);
    preparedSpells = {};
    const allowed = new Set(getActiveSpells().map((spell) => spell.key));
    if (savedSpells.prepared && typeof savedSpells.prepared === 'object') {
      Object.entries(savedSpells.prepared).forEach(([key, value]) => {
        const amount = parseNumber(value, 0, 0, 999);
        if (amount > 0 && allowed.has(key)) {
          preparedSpells[key] = amount;
        }
      });
    }
    state.preparedSpells = preparedSpells;
    state.preparedSpellLimit = preparedSpellLimit;
    renderSpellsPanel();
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
      card.className = 'option-card spell-card';

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

  const managePreparedSpells = ({ player, initialStats }) => {
    const spellsAvailable = getActiveSpells();
    if (!spellsAvailable.length) {
      alert('No spells are available for this adventure.');
      return;
    }
    const limitStat = getActiveSpellLimitStat();
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
        state.preparedSpells = preparedSpells;
        state.preparedSpellLimit = preparedSpellLimit;
        renderSpellsPanel();
        logs.logMessage('Prepared spells updated.', 'info');
      },
      onCancel: () => logs.logMessage('Spell update cancelled.', 'warning')
    });
  };

  const castSpell = (spellKey) => {
    const activeSpells = getActiveSpells();
    const spell = activeSpells.find((entry) => entry.key === spellKey);
    if (!spell) {
      logs.logMessage('That spell is not available right now.', 'warning');
      return;
    }
    if (!preparedSpells[spell.key]) {
      logs.logMessage('You have no prepared casts left for that spell.', 'warning');
      return;
    }
    preparedSpells[spell.key] -= 1;
    state.preparedSpells = preparedSpells;
    renderSpellsPanel();
    logs.logMessage(`Cast ${spell.name}.`, 'action');
    if (typeof window.ffApp.applySpellEffect === 'function') {
      window.ffApp.applySpellEffect(spell);
    }
    window.ffApp.showActionVisual('castSpell', { subline: spell.description || 'You unleash a prepared spell.' });
  };

  window.ffApp = window.ffApp || {};
  window.ffApp.spells = {
    renderSpellsPanel,
    resetSpells,
    applySpellsState,
    managePreparedSpells,
    castSpell
  };
})();
