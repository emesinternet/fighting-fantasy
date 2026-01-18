(() => {
  'use strict';
  const { rollDice } = window.ffApp.utils;

  // Base selection of Fighting Fantasy titles players can choose from.
  const BOOK_OPTIONS = [
    'Appointment with F.E.A.R.',
    'Citadel of Chaos',
    'City of Thieves',
    'Creature of Havoc',
    'Deathtrap Dungeon',
    'Forest of Doom',
    'House of Hell',
    'Island of the Lizard King',
    'Port of Peril',
    'Warlock of Firetop Mountain (The)',
  ];

  // Shared spell catalog so individual books can opt into subsets without redefining entries.
  const SPELL_LIBRARY = {
    creatureCopy: {
      key: 'creatureCopy',
      name: 'Creature Copy',
      description: 'Copy an enemy, matching their Stamina and Stamina.',
      effect: 'creatureCopy'
    },
    esp: {
      key: 'esp',
      name: 'E.S.P.',
      description: 'Psychic mind-control. May provide misleading information.',
      effect: 'log'
    },
    fire: {
      key: 'fire',
      name: 'Fire',
      description: 'All enemies are afraid of fire.',
      effect: 'log'
    },
    foolsGold: {
      key: 'foolsGold',
      name: "Fool's Gold",
      description: 'Temporarily turn ordinary rocks into gold.',
      effect: 'log'
    },
    illusion: {
      key: 'illusion',
      name: 'Illusion',
      description: 'Convincing illusion broken by interaction. Best against intelligent creatures.',
      effect: 'log'
    },
    levitation: {
      key: 'levitation',
      name: 'Levitation',
      description: 'Cast on objects, enemies, or yourself. Controlled while airborne.',
      effect: 'log'
    },
    luck: {
      key: 'luck',
      name: 'Luck',
      description: 'Restore Luck by half of its initial value, up to the initial amount.',
      effect: 'restoreLuck'
    },
    shielding: {
      key: 'shielding',
      name: 'Shielding',
      description: 'Invisible shield that prevents touch. Ineffective against magic.',
      effect: 'log'
    },
    stamina: {
      key: 'stamina',
      name: 'Stamina',
      description: 'Restore Stamina by half of its initial value, up to the initial amount.',
      effect: 'restoreStamina'
    },
    strength: {
      key: 'strength',
      name: 'Strength',
      description: 'Greatly increases strength, which may be hard to control.',
      effect: 'log'
    },
    weakness: {
      key: 'weakness',
      name: 'Weakness',
      description: 'Makes strong enemies weak, but may not affect all foes.',
      effect: 'log'
    }
  };

  // Book-specific rules and toggles for additional stats, potions, and spellcasting.
  const BOOK_RULES = {
    'City of Thieves': {
      startingNotes: {
        gold: '30gp',
        equipment: 'Sword'
      },
      supportsMultiCombat: true
    },
    'Forest of Doom': {
      startingNotes: {
        gold: '30gp'
      }
    },
    'Citadel of Chaos': {
      supportsPotions: false,
      supportsMeals: false,
      extraStats: {
        magic: {
          label: 'Magic',
          roll: () => {
            const dice = rollDice(2);
            const total = dice + 6;
            return { total, detail: `${dice} + 6 = ${total}` };
          },
          helper: 'Roll 2D6 + 6'
        }
      },
      spells: [
        SPELL_LIBRARY.creatureCopy,
        SPELL_LIBRARY.esp,
        SPELL_LIBRARY.fire,
        SPELL_LIBRARY.foolsGold,
        SPELL_LIBRARY.illusion,
        SPELL_LIBRARY.levitation,
        SPELL_LIBRARY.luck,
        SPELL_LIBRARY.shielding,
        SPELL_LIBRARY.stamina,
        SPELL_LIBRARY.strength,
        SPELL_LIBRARY.weakness
      ],
      spellLimitStat: 'magic'
    }
  };

  const potionOptions = [
    { name: 'Potion of Skill', description: 'Restores Skill to full.' },
    { name: 'Potion of Strength', description: 'Restores Stamina to full.' },
    { name: 'Potion of Fortune', description: 'Restores Luck to full and increases your maximum by 1.' }
  ];

  const generalRollOptions = [
    { value: '1d6', label: '1D6', roll: () => window.ffApp.utils.rollCustomDice(1, 6) },
    { value: '1d4', label: '1D4', roll: () => window.ffApp.utils.rollCustomDice(1, 4) },
    { value: '1d2', label: '1D2', roll: () => window.ffApp.utils.rollCustomDice(1, 2) },
    { value: '2d6', label: '2D6', roll: () => window.ffApp.utils.rollCustomDice(2, 6) },
    { value: 'percent', label: 'Percent Die', roll: () => window.ffApp.utils.rollCustomDice(1, 100) }
  ];

  const actionVisuals = {
    newGame: {
      src: 'img/player-new-game.png',
      alt: 'An adventurer prepares for a fresh quest',
      subline: 'A new adventure begins.'
    },
    eatMeal: {
      src: 'img/player-eat-meal.png',
      alt: 'The hero takes time to eat and recover',
      subline: 'You regain strength from a meal.'
    },
    drinkPotion: {
      src: 'img/player-drink-potion.png',
      alt: 'The hero drinks a potion',
      subline: 'Potion power surges through you.'
    },
    castSpell: {
      src: 'img/player-casts-spell.png',
      alt: 'The hero channels arcane energy',
      subline: 'You unleash a prepared spell.'
    },
    escape: {
      src: 'img/player-escape-battle.png',
      alt: 'The hero slips away from battle',
      subline: 'You escape, lose 2 Stamina.'
    },
    blockEnemy: {
      src: 'img/player-block-enemy.png',
      alt: 'The hero blocks an enemy strike',
      subline: 'Lucky block, restore 1 stamina'
    },
    enemyHitYou: {
      src: 'img/player-fail-block-enemy.png',
      alt: 'The hero is struck by an enemy',
      subline: 'Unlocky block, lose 1 stamina.'
    },
    playerHitEnemy: {
      src: 'img/player-hit-enemy.png',
      alt: 'The hero lands a hit on an enemy',
      subline: 'Your strike lands!'
    },
    playerMissEnemy: {
      src: 'img/player-miss-enemy.png',
      alt: 'The hero misses an enemy attack',
      subline: 'Your strike misses'
    },
    playerFailAttack: {
      src: 'img/player-fail-attack.png',
      alt: 'The hero stumbles after a failed attack',
      subline: 'Your swing leaves you wide open.'
    },
    defeatEnemy: {
      src: 'img/player-defeat-enemy.png',
      alt: 'The hero fells an enemy',
      subline: 'Another foe is vanquished.'
    },
    loseCombat: {
      src: 'img/player-lose-combat.png',
      alt: 'The hero reels from combat',
      subline: 'You have been killed. Game Over.'
    },
    lose: {
      src: 'img/player-lose.png',
      alt: 'The hero collapses from defeat',
      subline: 'Game Over.'
    },
    win: {
      src: 'img/player-win.png',
      alt: 'The hero celebrates victory',
      subline: 'You completed the adventure!'
    },
    lucky: {
      src: 'img/player-lucky-general.png',
      alt: 'The hero is blessed by luck',
      subline: 'Luck smiles upon you.'
    },
    unlucky: {
      src: 'img/player-unlucky-general.png',
      alt: 'The hero suffers an unlucky turn',
      subline: 'Unlucky.'
    }
  };

  const baseStatConfigs = {
    skill: {
      label: 'Skill',
      roll: () => {
        const dice = rollDice(1);
        const total = dice + 6;
        return { total, detail: `${dice} + 6 = ${total}` };
      },
      helper: 'Roll 1D6 + 6'
    },
    stamina: {
      label: 'Stamina',
      roll: () => {
        const dice = rollDice(2);
        const total = dice + 12;
        return { total, detail: `${dice} + 12 = ${total}` };
      },
      helper: 'Roll 2D6 + 12'
    },
    luck: {
      label: 'Luck',
      roll: () => {
        const dice = rollDice(1);
        const total = dice + 6;
        return { total, detail: `${dice} + 6 = ${total}` };
      },
      helper: 'Roll 1D6 + 6'
    }
  };

  window.ffApp = window.ffApp || {};
  window.ffApp.constants = {
    BOOK_OPTIONS,
    SPELL_LIBRARY,
    BOOK_RULES,
    potionOptions,
    generalRollOptions,
    actionVisuals,
    baseStatConfigs
  };
})();
