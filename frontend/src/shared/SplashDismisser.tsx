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

    const el = document.getElementById('skyline-splash');
    if (!el) return;

    // Give React one frame to paint before we start the exit
    const raf = requestAnimationFrame(() => {
      el.classList.add('splash-out');
      const onEnd = () => {
        el.remove();
      };
      el.addEventListener('transitionend', onEnd, { once: true });
      // Safety net in case transitionend never fires
      setTimeout(onEnd, 600);
    });

    return () => cancelAnimationFrame(raf);
  }, []);

  return null;
}
