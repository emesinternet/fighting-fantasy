// Persistence helpers for building, reading, and downloading save payloads.
export const buildSavePayload = ({
  version = 5,
  savedAt = new Date().toISOString(),
  pageNumber,
  book,
  player,
  initialStats,
  playerModifiers,
  notes,
  enemies,
  logHistory,
  decisionLogHistory,
  spells
}) => ({
  version,
  savedAt,
  pageNumber,
  book: book || null,
  player: { ...player },
  initialStats: { ...initialStats },
  playerModifiers: { ...playerModifiers },
  notes: { ...notes },
  enemies: enemies.map((enemy) => ({ ...enemy })),
  log: logHistory.map((entry) => ({ ...entry })),
  decisionLog: decisionLogHistory.map((entry) => ({ ...entry })),
  spells: {
    prepared: { ...(spells?.prepared || {}) },
    limit: spells?.limit ?? 0
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

export const downloadSave = (payload, { book, pageNumberLabel }) => {
  const json = JSON.stringify(payload, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const timestamp = formatFilenameTimestamp();
  const safePage = pageNumberLabel && String(pageNumberLabel).trim() ? `page-${String(pageNumberLabel).trim()}` : 'page-unknown';
  const safeBook = formatBookForFilename(book);
  const filename = `${safeBook}-ff-save-${safePage}-${timestamp}.json`;
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

export const readSaveFile = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = (loadEvent) => {
    try {
      const parsed = JSON.parse(loadEvent.target.result);
      if (!parsed.player || !parsed.initialStats) {
        throw new Error('Save missing required fields.');
      }
      resolve(parsed);
    } catch (error) {
      reject(error);
    }
  };
  reader.onerror = () => reject(reader.error || new Error('Failed to read file.'));
  reader.readAsText(file);
});
