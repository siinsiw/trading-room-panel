import { useEffect, useRef } from 'react';

export function CustomCursor() {
  const dotRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const dot = dotRef.current;
    if (!dot) return;

    let x = -100, y = -100;
    let raf: number;

    function move(e: MouseEvent) {
      x = e.clientX;
      y = e.clientY;
    }

    function render() {
      if (dot) {
        dot.style.transform = `translate(${x}px, ${y}px)`;
      }
      raf = requestAnimationFrame(render);
    }

    function onEnterInteractive() {
      dot?.classList.add('cursor-expanded');
    }
    function onLeaveInteractive() {
      dot?.classList.remove('cursor-expanded');
    }

    const interactives = document.querySelectorAll<HTMLElement>(
      'a, button, [role="button"], input, select, textarea, label'
    );
    interactives.forEach(el => {
      el.addEventListener('mouseenter', onEnterInteractive);
      el.addEventListener('mouseleave', onLeaveInteractive);
    });

    window.addEventListener('mousemove', move);
    raf = requestAnimationFrame(render);

    return () => {
      window.removeEventListener('mousemove', move);
      cancelAnimationFrame(raf);
      interactives.forEach(el => {
        el.removeEventListener('mouseenter', onEnterInteractive);
        el.removeEventListener('mouseleave', onLeaveInteractive);
      });
    };
  }, []);

  return (
    <div
      ref={dotRef}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: 10,
        height: 10,
        borderRadius: '50%',
        backgroundColor: 'var(--accent-gold)',
        pointerEvents: 'none',
        zIndex: 99999,
        willChange: 'transform',
        transition: 'width 150ms ease, height 150ms ease, margin 150ms ease',
      }}
      className="cursor-dot"
    />
  );
}
