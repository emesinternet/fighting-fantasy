(() => {
  'use strict';

  const { renderLogList, logToneIcons, emphasizeLogTokens } = window.ffApp.utils;
  const { createModal, bindDefaultEnterAction } = window.ffApp.ui;
  const { byId } = window.ffApp.dom;
  const state = window.ffApp.state;
  const logHistory = state.logHistory;
  const decisionLogHistory = state.decisionLogHistory;
  const LOG_HISTORY_LIMIT = 1000;
  const DECISION_LOG_HISTORY_LIMIT = 1000;

  const logEl = byId('log');
  const decisionLogEl = byId('decisionLog');

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

  const renderDecisionLog = () => {
    renderLogList({
      container: decisionLogEl,
      entries: decisionLogHistory,
      getIcon: () => '🧭',
      formatMessage: (entry) => entry.message || `Page ${entry.pageNumber || '—'} — ${entry.decision}`,
      showTimestamp: false,
      renderActions: (_, index) => {
        const actions = document.createElement('div');
        actions.className = 'log-entry-actions';
        const edit = document.createElement('button');
        edit.type = 'button';
        edit.className = 'edit-log-button';
        edit.title = 'Edit decision';
        edit.setAttribute('aria-label', 'Edit decision entry');
        edit.textContent = '✎';
        edit.addEventListener('click', () => editDecisionLogEntry(index));
        actions.appendChild(edit);
        return actions;
      }
    });
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
    pageInput.placeholder = '120';
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
    decisionInput.placeholder = 'Took the west tunnel';
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
      const pageValue = window.ffApp.utils.parseNumber(pageInput.value, NaN, 1, 9999);
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
      renderDecisionLog();
      logMessage(`Decision updated for Page ${pageValue}.`, 'info');
      close();
    };

    cancel.addEventListener('click', close);
    save.addEventListener('click', attemptSave);
    bindDefaultEnterAction(overlay, save, { allowTextareaSubmit: true });

    actions.appendChild(cancel);
    actions.appendChild(save);
    form.appendChild(actions);
    modal.appendChild(form);
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
          const safePage = window.ffApp.utils.parseNumber(entry.pageNumber, '', 1, 9999);
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
      const pageValue = window.ffApp.utils.parseNumber(pageInput.value, NaN, 1, 9999);
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
    bindDefaultEnterAction(overlay, addButton, { allowTextareaSubmit: true });
  };

  window.ffApp = window.ffApp || {};
  window.ffApp.logs = {
    logMessage,
    renderLog,
    renderDecisionLog,
    addDecisionLogEntry,
    applyLogState,
    applyDecisionLogState,
    showDecisionDialog
  };
})();
