(() => {
  'use strict';

  const { formatFilenameTimestamp, formatBookForFilename } = window.ffApp.utils;
  const { createModal, bindDefaultEnterAction } = window.ffApp.ui;
  const { logMessage } = window.ffApp.logs;
  const { byId } = window.ffApp.dom;
  const LOCAL_SAVE_KEY = 'ff-companion-local-save';

  // Store the most recent save in localStorage to make browser refreshes painless.
  const persistLocalSave = (payload) => {
    if (!payload) {
      return false;
    }
    try {
      localStorage.setItem(LOCAL_SAVE_KEY, JSON.stringify(payload));
      return true;
    } catch (error) {
      console.warn('Unable to write local save cache', error);
      return false;
    }
  };

  // Load the cached save if present. This intentionally returns null on failure so callers can bail quietly.
  const loadLocalSave = () => {
    try {
      const raw = localStorage.getItem(LOCAL_SAVE_KEY);
      if (!raw) {
        return null;
      }
      return JSON.parse(raw);
    } catch (error) {
      console.warn('Unable to read local save cache', error);
      return null;
    }
  };

  const downloadSave = (payload, pageNumberLabel, currentBook) => {
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

  const showSaveDialog = (buildPayload, currentBook) => {
    const { overlay, modal, close } = createModal(
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
    pageInput.placeholder = '237';

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
      const payload = buildPayload(pageValue || 'Unknown');
      const localSaveStored = persistLocalSave(payload);
      downloadSave(payload, pageValue, currentBook);
      const saveLabel = `Game saved${pageValue ? ` on Page ${pageValue}` : ''}.`;
      logMessage(saveLabel, 'success');
      if (!localSaveStored) {
        console.warn('Game saved, but the quicksave slot could not be updated in your browser.');
      }
      close();
    });
    bindDefaultEnterAction(overlay, saveButton);
  };

  const handleLoadFile = (onLoad) => {
    const input = byId('loadFileInput');
    input.addEventListener('change', (event) => {
      const file = event.target.files?.[0];
      if (!file) {
        return;
      }
      const reader = new FileReader();
      reader.onload = (loadEvent) => {
        try {
          const parsed = JSON.parse(loadEvent.target.result);
          onLoad(parsed);
        } catch (error) {
          console.error('Failed to load save', error);
          alert('Could not load save file. Please ensure it is a valid Fighting Fantasy save.');
        } finally {
          event.target.value = '';
        }
      };
      reader.readAsText(file);
    });
  };

  window.ffApp = window.ffApp || {};
  window.ffApp.persistence = {
    showSaveDialog,
    handleLoadFile,
    downloadSave,
    loadLocalSave
  };
})();
