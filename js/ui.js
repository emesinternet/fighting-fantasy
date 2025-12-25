(() => {
  'use strict';

  const { actionVisuals } = window.ffApp.constants;

  const animationOverlay = document.getElementById('action-overlay');
  const animationImage = document.getElementById('action-image');
  const animationText = document.getElementById('action-text');
  const animationTimers = [];
  const ANIMATION_ENTRY_DURATION_MS = 800;
  const ANIMATION_HOLD_DURATION_MS = 2000;
  const ANIMATION_FADE_DURATION_MS = 200;
  const ANIMATION_TOTAL_DURATION_MS = ANIMATION_ENTRY_DURATION_MS
    + ANIMATION_HOLD_DURATION_MS
    + ANIMATION_FADE_DURATION_MS;

  const clearAnimationTimers = () => {
    while (animationTimers.length) {
      clearTimeout(animationTimers.pop());
    }
  };

  const resetAnimationClasses = () => {
    animationImage.classList.remove('animate-in', 'animate-out');
    animationText.classList.remove('animate-in', 'animate-out');
  };

  const fadeOutAnimation = () => {
    animationImage.classList.remove('animate-in');
    animationText.classList.remove('animate-in');
    animationImage.classList.add('animate-out');
    animationText.classList.add('animate-out');
    animationOverlay.classList.remove('is-visible');
    animationOverlay.setAttribute('aria-hidden', 'true');
  };

  const closeAnimationOverlayInstantly = () => {
    clearAnimationTimers();
    resetAnimationClasses();

    const previousTransition = animationOverlay.style.transition;
    animationOverlay.style.transition = 'none';
    animationOverlay.classList.remove('is-visible');
    animationOverlay.setAttribute('aria-hidden', 'true');
    void animationOverlay.offsetHeight; // eslint-disable-line no-unused-expressions
    animationOverlay.style.transition = previousTransition;
  };

  const playActionAnimation = () => {
    clearAnimationTimers();
    resetAnimationClasses();

    animationOverlay.classList.remove('is-visible');
    animationOverlay.setAttribute('aria-hidden', 'true');

    void animationImage.offsetWidth; // eslint-disable-line no-unused-expressions
    void animationText.offsetWidth; // eslint-disable-line no-unused-expressions

    animationOverlay.classList.add('is-visible');
    animationOverlay.setAttribute('aria-hidden', 'false');

    animationTimers.push(setTimeout(() => {
      animationImage.classList.add('animate-in');
    }, 40));

    animationTimers.push(setTimeout(() => {
      animationText.classList.add('animate-in');
    }, 220));

    animationTimers.push(setTimeout(fadeOutAnimation, ANIMATION_ENTRY_DURATION_MS + ANIMATION_HOLD_DURATION_MS));
    animationTimers.push(setTimeout(
      resetAnimationClasses,
      ANIMATION_ENTRY_DURATION_MS + ANIMATION_HOLD_DURATION_MS + ANIMATION_FADE_DURATION_MS
    ));
  };

  const showActionVisual = (key, overrides = {}) => {
    const visual = actionVisuals[key];
    if (!visual) {
      return;
    }
    const subline = overrides.subline || visual.subline;
    animationImage.src = visual.src;
    animationImage.alt = overrides.alt || visual.alt;
    animationText.textContent = subline;
    playActionAnimation();
  };

  const showActionVisualAndWait = (key, overrides = {}) => new Promise((resolve) => {
    showActionVisual(key, overrides);
    setTimeout(resolve, ANIMATION_TOTAL_DURATION_MS);
  });

  animationOverlay.addEventListener('click', closeAnimationOverlayInstantly);

  // Keep modal keyboard controls consistent: Enter activates the primary action unless Shift+Enter is used.
  const bindDefaultEnterAction = (overlay, primaryButton, options = {}) => {
    if (!overlay || !primaryButton) {
      return;
    }
    const allowTextareaSubmit = Boolean(options.allowTextareaSubmit);
    const handler = (event) => {
      if (event.key !== 'Enter' || event.shiftKey || event.ctrlKey || event.metaKey || event.altKey) {
        return;
      }
      const activeElement = document.activeElement;
      if (!allowTextareaSubmit && activeElement instanceof HTMLTextAreaElement) {
        return;
      }
      if (primaryButton.disabled) {
        return;
      }
      event.preventDefault();
      primaryButton.click();
    };
    overlay.addEventListener('keydown', handler);
  };

  // Lightweight modal scaffolding to keep dialog creation tidy.
  const createModal = (title, description, options = {}) => {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.setAttribute('aria-hidden', 'true');
    const slideFromBottom = Boolean(options.slideFromBottom);
    const onClose = typeof options.onClose === 'function' ? options.onClose : null;
    if (slideFromBottom) {
      overlay.classList.add('modal-overlay-slide');
    }

    const modal = document.createElement('div');
    modal.className = 'modal';
    if (options.wide) {
      modal.classList.add('modal-wide');
    }
    if (options.compact) {
      modal.classList.add('modal-compact');
    }
    if (slideFromBottom) {
      modal.classList.add('modal-slide');
    }

    const heading = document.createElement('h3');
    heading.textContent = title;
    modal.appendChild(heading);

    if (description) {
      const desc = document.createElement('p');
      desc.textContent = description;
      modal.appendChild(desc);
    }

    overlay.appendChild(modal);
    document.body.appendChild(overlay);
    overlay.setAttribute('aria-hidden', 'false');
    requestAnimationFrame(() => {
      if (slideFromBottom) {
        modal.classList.add('is-visible');
      }
    });

    const focusableSelectors = [
      'button',
      '[href]',
      'input',
      'select',
      'textarea',
      '[tabindex]:not([tabindex="-1"])'
    ];

    const getFocusableElements = () => Array.from(
      modal.querySelectorAll(focusableSelectors.join(','))
    ).filter((el) => !el.hasAttribute('disabled') && el.tabIndex !== -1 && el.offsetParent !== null);

    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;

    const focusFirstInteractive = () => {
      const focusable = getFocusableElements();
      if (focusable.length > 0) {
        focusable[0].focus();
        return;
      }
      modal.tabIndex = -1;
      modal.focus();
    };

    const trapFocus = (event) => {
      if (event.key !== 'Tab') {
        return;
      }
      const focusable = getFocusableElements();
      if (focusable.length === 0) {
        event.preventDefault();
        modal.focus();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    let hasClosed = false;
    const finishClose = () => {
      if (hasClosed) {
        return;
      }
      hasClosed = true;
      if (onClose) {
        onClose();
      }
      overlay.remove();
      if (previouslyFocused && document.body.contains(previouslyFocused)) {
        previouslyFocused.focus();
      }
    };

    const close = () => {
      overlay.setAttribute('aria-hidden', 'true');
      overlay.removeEventListener('keydown', handleKeydown);

      if (!slideFromBottom) {
        finishClose();
        return;
      }

      modal.classList.remove('is-visible');
      modal.classList.add('is-hiding');

      const handleTransitionEnd = (event) => {
        if (event.target !== modal || event.propertyName !== 'transform') {
          return;
        }
        modal.removeEventListener('transitionend', handleTransitionEnd);
        finishClose();
      };

      modal.addEventListener('transitionend', handleTransitionEnd);
      setTimeout(() => {
        modal.removeEventListener('transitionend', handleTransitionEnd);
        finishClose();
      }, 500);
    };

    const handleKeydown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        close();
      }
      trapFocus(event);
    };

    overlay.addEventListener('keydown', handleKeydown);
    focusFirstInteractive();

    return { overlay, modal, close };
  };

  window.ffApp = window.ffApp || {};
  window.ffApp.ui = {
    bindDefaultEnterAction,
    createModal,
    showActionVisual,
    showActionVisualAndWait
  };
})();
