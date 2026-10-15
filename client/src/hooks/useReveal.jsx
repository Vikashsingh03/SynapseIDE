import { useEffect, useRef } from 'react';






export function useReveal({ threshold = 0.12 } = {}) {
  const ref = useRef(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') {
      
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
