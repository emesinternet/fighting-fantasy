(() => {
  'use strict';

  // Centralized state container shared across UI modules.
  const state = {
    player: {
      skill: 0,
      stamina: 0,
      luck: 0,
      magic: 0,
      maxSkill: 0,
      maxStamina: 0,
      maxLuck: 0,
      maxMagic: 0,
      meals: 10,
      potion: null,
      potionUsed: false
    },
    playerModifiers: {
      damageDone: 0,
      damageReceived: 0,
      skillBonus: 0
    },
    initialStats: {
      skill: 0,
      stamina: 0,
      luck: 0,
      magic: 0
    },
    enemies: [],
    nextEnemyId: 1,
    preparedSpells: {},
    preparedSpellLimit: 0,
    currentBook: '',
    logHistory: [],
    decisionLogHistory: [],
    mapDrawingDataUrl: '',
    isMultiCombatEnabled: false
  };

  window.ffApp = window.ffApp || {};
  window.ffApp.state = state;
})();
