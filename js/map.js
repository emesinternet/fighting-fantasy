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
    const { overlay, modal, close } = createModal(
      'Map Sketchpad',
      'Free draw a map or jot notes. Saving stores this canvas with your current adventure and future save files.',
      {
        slideFromBottom: true,
        onClose: () => {
          mapModalOpen = false;
          hideCursor();
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
    let erasing = false;
    const swatches = [];

    const getBrushWidth = () => (erasing ? MAP_ERASER_WIDTH : MAP_BRUSH_WIDTH);

    const refreshCursorStyle = (rect) => {
      const bounds = rect || canvas.getBoundingClientRect();
      const scaleX = bounds.width / MAP_CANVAS_WIDTH;
      const scaleY = bounds.height / MAP_CANVAS_HEIGHT;
      const averageScale = (scaleX + scaleY) / 2;
      const pixelSize = getBrushWidth() * averageScale;
      cursor.style.width = `${pixelSize}px`;
      cursor.style.height = `${pixelSize}px`;
      cursor.style.borderColor = erasing ? MAP_CANVAS_BACKGROUND : currentColor;
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

    const setActiveSwatch = (swatch, colorValue, isEraser = false) => {
      swatches.forEach((item) => item.classList.remove('is-active'));
      if (swatch) {
        swatch.classList.add('is-active');
      }
      currentColor = colorValue;
      erasing = isEraser;
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
      swatch.addEventListener('click', () => setActiveSwatch(swatch, option.value, false));
      if (index === 0) {
        setActiveSwatch(swatch, option.value);
      }
      swatches.push(swatch);
      palette.appendChild(swatch);
    });

    const eraser = document.createElement('button');
    eraser.type = 'button';
    eraser.className = 'map-swatch';
    eraser.title = 'Erase';
    eraser.setAttribute('aria-label', 'Erase');
    eraser.style.background = MAP_CANVAS_BACKGROUND;
    eraser.addEventListener('click', () => setActiveSwatch(eraser, MAP_CANVAS_BACKGROUND, true));
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
      drawing = true;
      const { x, y } = getCanvasPoint(event);
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.strokeStyle = erasing ? MAP_CANVAS_BACKGROUND : currentColor;
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
      ctx.strokeStyle = erasing ? MAP_CANVAS_BACKGROUND : currentColor;
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
