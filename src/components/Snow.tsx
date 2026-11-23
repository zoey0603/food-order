import { useEffect, useState } from 'react';

export function Snow() {
  const [flakes, setFlakes] = useState<{ left: string; animationDuration: string; animationDelay: string }[]>([]);

  useEffect(() => {
    const preference = matchMedia('(prefers-reduced-motion: reduce)');
    function update() {
      setFlakes(preference.matches ? [] : Array.from({ length: 40 }, () => ({
        left: Math.random() * 100 + '%',
        animationDuration: 5 + Math.random() * 7 + 's',
        animationDelay: Math.random() * -5 + 's',
      })));
    }
    update();
    preference.addEventListener('change', update);
    return () => preference.removeEventListener('change', update);
  }, []);

  return <div className="snow-layer" aria-hidden="true">{flakes.map((style, index) => <span key={index} className="snowflake" style={style}>❄</span>)}</div>;
}
