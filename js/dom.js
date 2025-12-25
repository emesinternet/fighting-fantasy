(() => {
  'use strict';

  const cache = new Map();

  const byId = (id) => {
    if (!id) return null;
    if (cache.has(id)) return cache.get(id);
    const el = document.getElementById(id);
    cache.set(id, el);
    return el;
  };

  const onClick = (id, handler) => {
    const el = byId(id);
    if (el && typeof handler === 'function') {
      el.addEventListener('click', handler);
    }
    return el;
  };

  window.ffApp = window.ffApp || {};
  window.ffApp.dom = { byId, onClick };
})();
