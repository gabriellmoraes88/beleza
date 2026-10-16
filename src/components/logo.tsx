import { useId } from "react";

/** Símbolo da Bellink: unha amendoada em tom nude, com brilho "glazed". */
export function NailMark({ className = "h-8 w-auto" }: { className?: string }) {
  const id = useId();
  return (
    <svg viewBox="0 0 40 72" className={className} aria-hidden>
      <defs>
        <linearGradient id={`${id}-fill`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#f6e2dd" />
          <stop offset="1" stopColor="#d7a29b" />
        </linearGradient>
      </defs>
      <path
        d="M20 1.5C23.5 1.5 34 17 35.5 36L36 60c0 7-7 10.5-16 10.5S4 67 4 60l.5-24C6 17 16.5 1.5 20 1.5Z"
        fill={`url(#${id}-fill)`}
        stroke="#c48f89"
        strokeWidth="1.2"
      />
      <path d="M8 61c3 2.8 7.5 3.8 12 3.8s9-1 12-3.8" fill="none" stroke="#fbf1ee" strokeWidth="1.6" strokeLinecap="round" />
      <ellipse cx="14.5" cy="28" rx="2.6" ry="12" fill="#fff" opacity=".75" transform="rotate(10 14.5 28)" />
    </svg>
  );
}

export function Logo({ className = "", size = "md" }: { className?: string; size?: "sm" | "md" | "lg" }) {
  const text = { sm: "text-xl", md: "text-2xl", lg: "text-4xl" }[size];
  const mark = { sm: "h-7 w-auto", md: "h-8 w-auto", lg: "h-12 w-auto" }[size];
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <NailMark className={mark} />
      <span className={`font-display ${text} leading-none tracking-tight text-brand-700`}>
        bel<span className="text-brand-500">link</span>
      </span>
    </span>
  );
}
