(() => {
  'use strict';

  const { createModal, bindDefaultEnterAction } = window.ffApp.ui;
  const { formatBookForFilename } = window.ffApp.utils;
  const state = window.ffApp.state;

  const MAP_CANVAS_WIDTH = 1600;
  const MAP_CANVAS_HEIGHT = 1000;
  const MAP_CANVAS_BACKGROUND = '#f3efe3';
  const MAP_BRUSH_WIDTH = 4.5;
  const MAP_ERASER_WIDTH = 24;
  const MAP_TEXT_FONT = 'bold 12px sans-serif';
  const MAP_TEXT_SIZE = 12;
  const TOOLS = {
    DRAW: 'draw',
    ERASE: 'erase',
    TEXT: 'text'
  };

  let mapModalOpen = false;

  const getMapDrawing = () => state.mapDrawingDataUrl || '';
  const setMapDrawing = (dataUrl) => {
    state.mapDrawingDataUrl = dataUrl || '';
  };

  const resetMapDrawing = () => {
    setMapDrawing('');
  };

  const downloadCanvasImage = (canvas, currentBook) => {
    const downloadUrl = canvas.toDataURL('image/png');
    const bookSlug = formatBookForFilename(currentBook || '');
    const filename = bookSlug ? `${bookSlug}-map.png` : 'map-sketch.png';
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  // Render the sketchpad modal, persisting the canvas into the shared state.
  const showMapDialog = ({ currentBook, onSaved, logMessage } = {}) => {
    if (mapModalOpen) {
      return;
    }
    mapModalOpen = true;
    const cleanupTransientUi = () => {
      hideCursor();
      hideTextInput();
    };
    const { overlay, modal, close } = createModal(
      'Map Sketchpad',
      'Free draw a map or jot notes. Saving stores this canvas with your current adventure and future save files.',
      {
        slideFromBottom: true,
        onClose: () => {
          mapModalOpen = false;
          cleanupTransientUi();
        }
      }
    );

    modal.classList.add('map-modal');
    modal.classList.add('modal-wide');

    const canvasWrapper = document.createElement('div');
    canvasWrapper.className = 'map-canvas-wrapper';

    const canvas = document.createElement('canvas');
    canvas.className = 'map-canvas';
    canvas.width = MAP_CANVAS_WIDTH;
    canvas.height = MAP_CANVAS_HEIGHT;
    canvasWrapper.appendChild(canvas);
    const cursor = document.createElement('div');
    cursor.className = 'map-cursor';
    canvasWrapper.appendChild(cursor);
    const textInput = document.createElement('input');
    textInput.type = 'text';
    textInput.className = 'map-text-input';
    textInput.placeholder = 'Type on map';
    textInput.setAttribute('aria-label', 'Type on map');
    canvasWrapper.appendChild(textInput);
    modal.appendChild(canvasWrapper);

    const ctx = canvas.getContext('2d');
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    const paintBackground = () => {
      ctx.fillStyle = MAP_CANVAS_BACKGROUND;
      ctx.fillRect(0, 0, MAP_CANVAS_WIDTH, MAP_CANVAS_HEIGHT);
    };

    const hydrateExistingDrawing = () => new Promise((resolve) => {
      paintBackground();
      const existing = getMapDrawing();
      if (!existing) {
        resolve();
        return;
      }
      const image = new Image();
      image.onload = () => {
        ctx.drawImage(image, 0, 0, MAP_CANVAS_WIDTH, MAP_CANVAS_HEIGHT);
        resolve();
      };
      image.onerror = () => resolve();
      image.src = existing;
    });

    hydrateExistingDrawing();

    const colorOptions = [
      { label: 'Ink', value: '#2d261f' },
      { label: 'Umber', value: '#825d44' },
      { label: 'Crimson', value: '#c55656' },
      { label: 'Forest', value: '#4f8240' },
      { label: 'Ocean', value: '#3f6f99' },
      { label: 'Steel', value: '#6f7886' }
    ];

    let currentColor = colorOptions[0].value;
    let currentTool = TOOLS.DRAW;
    let lastInkColor = currentColor;
    let activeTextPoint = null;
    let activeTextColor = currentColor;
    const swatches = [];

    const getBrushWidth = () => (currentTool === TOOLS.ERASE ? MAP_ERASER_WIDTH : MAP_BRUSH_WIDTH);

    const getCanvasScale = () => {
      const bounds = canvas.getBoundingClientRect();
      const scaleX = bounds.width / MAP_CANVAS_WIDTH;
      const scaleY = bounds.height / MAP_CANVAS_HEIGHT;
      return (scaleX + scaleY) / 2;
    };

    const refreshCursorStyle = (rect) => {
      const bounds = rect || canvas.getBoundingClientRect();
      const scaleX = bounds.width / MAP_CANVAS_WIDTH;
      const scaleY = bounds.height / MAP_CANVAS_HEIGHT;
      const averageScale = (scaleX + scaleY) / 2;
      const cursorSize = currentTool === TOOLS.TEXT ? 14 : getBrushWidth();
      const pixelSize = cursorSize * averageScale;
      cursor.style.width = `${pixelSize}px`;
      cursor.style.height = `${pixelSize}px`;
      const cursorColor = currentTool === TOOLS.ERASE ? '#000' : (currentTool === TOOLS.TEXT ? '#000' : currentColor);
      cursor.style.borderColor = cursorColor;
      cursor.classList.toggle('is-text', currentTool === TOOLS.TEXT);
    };

    const hideCursor = () => {
      cursor.classList.remove('is-visible');
    };

    const updateCursorPosition = (event) => {
      const rect = canvas.getBoundingClientRect();
      cursor.style.left = `${event.clientX - rect.left}px`;
      cursor.style.top = `${event.clientY - rect.top}px`;
      refreshCursorStyle(rect);
      cursor.classList.add('is-visible');
    };

    // Keep a lightweight overlay for text so typing feels natural before committing to pixels.
    const hideTextInput = () => {
      activeTextPoint = null;
      textInput.value = '';
      textInput.classList.remove('is-visible');
    };

    const commitActiveText = () => {
      if (!activeTextPoint) {
        hideTextInput();
        return;
      }
      const text = textInput.value || '';
      if (text.trim()) {
        ctx.save();
        ctx.font = MAP_TEXT_FONT;
        ctx.fillStyle = activeTextColor;
        ctx.textBaseline = 'top';
        ctx.fillText(text, activeTextPoint.x, activeTextPoint.y);
        ctx.restore();
      }
      hideTextInput();
    };

    const startTypingAtPoint = (event) => {
      commitActiveText();
      const rect = canvas.getBoundingClientRect();
      const { x, y } = getCanvasPoint(event);
      activeTextPoint = { x, y };
      activeTextColor = currentColor;
      textInput.value = '';
      textInput.style.left = `${event.clientX - rect.left}px`;
      textInput.style.top = `${event.clientY - rect.top}px`;
      const scale = getCanvasScale();
      textInput.style.fontSize = `${MAP_TEXT_SIZE * scale}px`;
      textInput.style.lineHeight = `${MAP_TEXT_SIZE * scale}px`;
      textInput.style.color = '#000';
      // Zero padding so the text starts exactly at the click point and matches the canvas rendering.
      textInput.style.padding = '0';
      textInput.style.width = '140%';
      textInput.classList.add('is-visible');
      textInput.focus();
    };

    // Allow quick commits without swapping tools.
    textInput.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
        commitActiveText();
      } else if (event.key === 'Escape') {
        event.preventDefault();
        hideTextInput();
      }
    });

    // Leaving the field by tabbing or clicking elsewhere should bake the text into the canvas.
    textInput.addEventListener('blur', () => {
      commitActiveText();
    });

    // While text is active, Enter commits the text instead of saving the map.
    overlay.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter' || !textInput.classList.contains('is-visible')) {
        return;
      }
      event.preventDefault();
      event.stopImmediatePropagation();
      commitActiveText();
    });

    const setActiveSwatch = (swatch, colorValue, tool = TOOLS.DRAW) => {
      if (currentTool === TOOLS.TEXT) {
        commitActiveText();
      }
      swatches.forEach((item) => item.classList.remove('is-active'));
      if (swatch) {
        swatch.classList.add('is-active');
      }
      if (tool === TOOLS.DRAW) {
        currentColor = colorValue || lastInkColor;
        lastInkColor = currentColor;
      } else if (tool === TOOLS.TEXT) {
        currentColor = lastInkColor;
      } else {
        currentColor = MAP_CANVAS_BACKGROUND;
      }
      currentTool = tool;
      refreshCursorStyle();
    };

    const controls = document.createElement('div');
    controls.className = 'map-controls';

    const palette = document.createElement('div');
    palette.className = 'map-palette';

    colorOptions.forEach((option, index) => {
      const swatch = document.createElement('button');
      swatch.type = 'button';
      swatch.className = 'map-swatch';
      swatch.style.background = option.value;
      swatch.title = `${option.label} ink`;
      swatch.setAttribute('aria-label', `${option.label} ink`);
      swatch.addEventListener('click', () => setActiveSwatch(swatch, option.value, TOOLS.DRAW));
      if (index === 0) {
        setActiveSwatch(swatch, option.value);
      }
      swatches.push(swatch);
      palette.appendChild(swatch);
    });

    const textSwatch = document.createElement('button');
    textSwatch.type = 'button';
    textSwatch.className = 'map-swatch map-swatch-text';
    textSwatch.title = 'Type on map';
    textSwatch.setAttribute('aria-label', 'Type on map');
    textSwatch.textContent = 'T';
    textSwatch.addEventListener('click', () => setActiveSwatch(textSwatch, lastInkColor, TOOLS.TEXT));
    palette.appendChild(textSwatch);
    swatches.push(textSwatch);

    const eraser = document.createElement('button');
    eraser.type = 'button';
    eraser.className = 'map-swatch';
    eraser.title = 'Erase';
    eraser.setAttribute('aria-label', 'Erase');
    eraser.style.background = MAP_CANVAS_BACKGROUND;
    eraser.addEventListener('click', () => setActiveSwatch(eraser, MAP_CANVAS_BACKGROUND, TOOLS.ERASE));
    palette.appendChild(eraser);
    swatches.push(eraser);

    controls.appendChild(palette);

    const actionGroup = document.createElement('div');
    actionGroup.className = 'map-actions';
    const cancel = document.createElement('button');
    cancel.className = 'btn btn-negative';
    cancel.textContent = 'Cancel';
    const save = document.createElement('button');
    save.className = 'btn btn-positive';
    save.textContent = 'Save';
    const download = document.createElement('button');
    download.className = 'btn btn-neutral';
    download.textContent = 'Download';
    actionGroup.appendChild(cancel);
    actionGroup.appendChild(download);
    actionGroup.appendChild(save);
    controls.appendChild(actionGroup);
    modal.appendChild(controls);

    const getCanvasPoint = (event) => {
      const rect = canvas.getBoundingClientRect();
      return {
        x: (event.clientX - rect.left) * (canvas.width / rect.width),
        y: (event.clientY - rect.top) * (canvas.height / rect.height)
      };
    };

    let drawing = false;

    const startStroke = (event) => {
      event.preventDefault();
      if (currentTool === TOOLS.TEXT) {
        startTypingAtPoint(event);
        return;
      }
      drawing = true;
      const { x, y } = getCanvasPoint(event);
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.strokeStyle = currentTool === TOOLS.ERASE ? MAP_CANVAS_BACKGROUND : currentColor;
      ctx.lineWidth = getBrushWidth();
      ctx.lineTo(x, y);
      ctx.stroke();
      updateCursorPosition(event);
      if (typeof event.pointerId !== 'undefined') {
        canvas.setPointerCapture(event.pointerId);
      }
    };

    const continueStroke = (event) => {
      updateCursorPosition(event);
      if (!drawing) {
        return;
      }
      event.preventDefault();
      const { x, y } = getCanvasPoint(event);
      ctx.lineTo(x, y);
      ctx.strokeStyle = currentTool === TOOLS.ERASE ? MAP_CANVAS_BACKGROUND : currentColor;
      ctx.lineWidth = getBrushWidth();
      ctx.stroke();
    };

    const endStroke = () => {
      if (!drawing) {
        return;
      }
      drawing = false;
      ctx.closePath();
    };

    canvas.addEventListener('pointerdown', startStroke);
    canvas.addEventListener('pointermove', continueStroke);
    canvas.addEventListener('pointerup', endStroke);
    canvas.addEventListener('pointerenter', updateCursorPosition);
    canvas.addEventListener('pointerleave', () => {
      hideCursor();
      endStroke();
    });
    canvas.addEventListener('pointercancel', () => {
      hideCursor();
      endStroke();
    });

    const persistMap = () => {
      commitActiveText();
      setMapDrawing(canvas.toDataURL('image/png'));
      if (logMessage) {
        logMessage('Map saved to this adventure and future save files.', 'info');
      }
      if (onSaved) {
        onSaved();
      }
      close();
    };

    save.addEventListener('click', persistMap);
    download.addEventListener('click', () => downloadCanvasImage(canvas, currentBook));
    cancel.addEventListener('click', close);
    bindDefaultEnterAction(overlay, save);
  };

  window.ffApp = window.ffApp || {};
  window.ffApp.map = {
    getMapDrawing,
    setMapDrawing,
    resetMapDrawing,
    showMapDialog
  };
})();
