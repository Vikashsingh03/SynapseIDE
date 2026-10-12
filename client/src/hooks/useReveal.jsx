import { useEffect, useRef } from 'react';

/**
 * useReveal — adds `is-visible` to the element once it scrolls into view.
 * Pairs with the `.reveal` / `.reveal.is-visible` CSS classes.
 * SSR-safe: no-ops when IntersectionObserver is unavailable.
 */
export function useReveal({ threshold = 0.12 } = {}) {
  const ref = useRef(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') {
      // No observer available — reveal immediately.
      if (el) el.classList.add('is-visible');
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            observer.unobserve(entry.target);
          }
        }
      },
      { threshold }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [threshold]);

  return ref;
}

/**
 * <Reveal> — wrapper that reveals its children on scroll into view.
 * delay: 0|1|2… → transitionDelay in 70ms steps.
 */
export function Reveal({ delay = 0, className = '', children, as: Tag = 'div' }) {
  const ref = useReveal();
  const style = delay > 0 ? { transitionDelay: `${delay * 70}ms`, animationDelay: `${delay * 70}ms` } : undefined;
  return (
    <Tag ref={ref} className={`reveal ${className}`} style={style}>
      {children}
    </Tag>
  );
}

export default useReveal;
