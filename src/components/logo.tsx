// Logo do Bellink: uma grade de horários em que os pontos escuros desenham um "b".
const DOTS: [number, number, boolean][] = [
  [8, 8, true], [20, 8, false], [32, 8, false],
  [8, 20, true], [20, 20, true], [32, 20, false],
  [8, 32, true], [20, 32, false], [32, 32, true],
  [8, 44, true], [20, 44, true], [32, 44, false],
];

export function LogoMark({ className = "h-8 w-auto" }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 52" fill="currentColor" className={className} aria-hidden="true">
      {DOTS.map(([cx, cy, on]) => (
        <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r={on ? 4.5 : 3.5} opacity={on ? 1 : 0.22} />
      ))}
    </svg>
  );
}

export function Logo({ className = "", markClassName }: { className?: string; markClassName?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 font-bold tracking-tight text-stone-900 ${className}`}>
      <LogoMark className={markClassName} />
      Bellink
    </span>
  );
}
