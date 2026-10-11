import { useEffect, useRef } from 'react';

/**
 * Dismisses the native HTML splash screen injected in index.html.
 * Mounts invisibly, triggers the fade-out after first paint, then removes the element.
 */
export function SplashDismisser() {
  const dismissed = useRef(false);

  useEffect(() => {
    if (dismissed.current) return;
    dismissed.current = true;

    // Brief 450ms presentation so the user glimpses the unified platform emblem,
    // then dismiss smoothly once React is mounted and painted
    const timer = setTimeout(() => {
      if (typeof (window as any).__dismissSkylineSplash === 'function') {
        (window as any).__dismissSkylineSplash();
      } else {
        const el = document.getElementById('skyline-splash');
        if (el) {
          el.classList.add('splash-out');
          el.style.pointerEvents = 'none';
          setTimeout(() => {
            try {
              if (el.parentNode) el.parentNode.removeChild(el);
            } catch (e) {}
          }, 450);
        }
      }
    }, 450);

    return () => clearTimeout(timer);
  }, []);

  return null;
}
