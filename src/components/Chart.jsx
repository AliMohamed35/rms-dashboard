import { useEffect, useRef, useState } from 'react';

/**
 * Hosts an imperative d3 chart. `draw(box, props)` owns the box's children; it re-runs when
 * `props` changes or the box is resized.
 */
export default function Chart({ draw, props, className = '' }) {
  const ref = useRef(null);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    let frame = 0;
    const ro = new ResizeObserver(([entry]) => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => setWidth(Math.round(entry.contentRect.width)));
    });
    ro.observe(el);
    return () => { cancelAnimationFrame(frame); ro.disconnect(); };
  }, []);

  useEffect(() => {
    if (ref.current) draw(ref.current, props);
  }, [draw, props, width]);

  return <div ref={ref} className={'rms-chart ' + className} />;
}
