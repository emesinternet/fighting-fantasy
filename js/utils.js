(() => {
  'use strict';

  // Roll a standard 6-sided die N times and return the total.
  const rollDice = (count) => Array.from({ length: count }, () => Math.floor(Math.random() * 6) + 1)
    .reduce((sum, value) => sum + value, 0);

  // Roll a die with the given number of sides once.
  const rollDieWithSides = (sides) => Math.floor(Math.random() * sides) + 1;

  // Roll custom dice and provide both the total and individual values.
  const rollCustomDice = (count, sides) => {
    const values = Array.from({ length: count }, () => rollDieWithSides(sides));
    const total = values.reduce((sum, value) => sum + value, 0);
    return { total, values };
  };

  // Clamp a numeric value within a minimum and maximum boundary.
  const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

  // Parse numbers consistently, respecting optional min/max bounds.
  const parseNumber = (value, fallback = 0, min = 0, max = 999) => {
    const parsed = parseInt(value, 10);
    if (Number.isFinite(parsed)) {
      return clamp(parsed, min, max);
    }
    return fallback;
  };

  // Escape HTML tokens to keep log entries safe from injection.
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

  // Generate a readable timestamp for save filenames.
  const formatFilenameTimestamp = () => {
    const now = new Date();
    const pad = (value) => String(value).padStart(2, '0');
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_${pad(now.getHours())}-${pad(now.getMinutes())}`;
  };

  // Normalize book names for safe usage in filenames.
  const formatBookForFilename = (bookName) => {
    if (!bookName) {
      return 'book-unknown';
    }
    const normalized = bookName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    return normalized || 'book-unknown';
  };

  const logToneIcons = {
    info: '📜',
    action: '⚔️',
    success: '✨',
    warning: '⚠️',
    danger: '💀'
  };

  // Render a list of log entries with optional actions and timestamp control.
  const renderLogList = ({
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

  window.ffApp = window.ffApp || {};
  window.ffApp.utils = {
    rollDice,
    rollDieWithSides,
    rollCustomDice,
    clamp,
    parseNumber,
    escapeHtml,
    emphasizeLogTokens,
    formatFilenameTimestamp,
    formatBookForFilename,
    renderLogList,
    logToneIcons
  };
})();
