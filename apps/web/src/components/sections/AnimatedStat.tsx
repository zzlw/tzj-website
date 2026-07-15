'use client';

import { useEffect, useRef, useState } from 'react';

interface AnimatedStatProps {
  value: string;
  label: string;
  duration?: number;
}

function parseStatValue(raw: string): { num: number; prefix: string; suffix: string } {
  const match = raw.match(/^(\D*)(\d+)(.*)$/);
  if (!match?.[2]) return { num: 0, prefix: '', suffix: raw };
  return { num: Number.parseInt(match[2], 10), prefix: match[1] ?? '', suffix: match[3] ?? '' };
}

export function AnimatedStat({ value, label, duration = 1500 }: AnimatedStatProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [display, setDisplay] = useState(value);
  const { num, prefix, suffix } = parseStatValue(value);

  useEffect(() => {
    const el = ref.current;
    if (!el || num === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry?.isIntersecting) return;
        observer.disconnect();

        const start = performance.now();
        const tick = (now: number) => {
          const progress = Math.min((now - start) / duration, 1);
          const eased = 1 - (1 - progress) ** 3;
          setDisplay(`${prefix}${Math.round(num * eased)}${suffix}`);
          if (progress < 1) requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      },
      { threshold: 0.3 },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [num, prefix, suffix, duration]);

  return (
    <div ref={ref}>
      <div className="font-display text-4xl font-extrabold text-primary md:text-5xl">{display}</div>
      <div className="mt-1 text-sm text-white/75">{label}</div>
    </div>
  );
}
