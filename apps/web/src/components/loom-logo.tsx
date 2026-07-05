import { useId } from "react";

interface LoomLogoProps {
  className?: string;
  markClassName?: string;
  textClassName?: string;
  showWordmark?: boolean;
}

export function LoomLogo({
  className,
  markClassName,
  textClassName,
  showWordmark = true,
}: LoomLogoProps) {
  return (
    <div className={["flex items-center gap-2.5", className].filter(Boolean).join(" ")}>
      <LoomMark className={markClassName} />
      {showWordmark ? (
        <span
          className={[
            "text-[1.05rem] font-medium tracking-[0.08em] text-white lowercase",
            textClassName,
          ]
            .filter(Boolean)
            .join(" ")}
        >
          loom
        </span>
      ) : null}
    </div>
  );
}

interface LoomMarkProps {
  className?: string;
}

export function LoomMark({ className }: LoomMarkProps) {
  const gradientId = useId().replace(/:/g, "");

  return (
    <svg
      aria-hidden="true"
      className={["h-8 w-8 shrink-0", className].filter(Boolean).join(" ")}
      viewBox="0 0 96 96"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id={gradientId} x1="13" y1="20" x2="83" y2="77" gradientUnits="userSpaceOnUse">
          <stop stopColor="#6F5BFF" />
          <stop offset="0.48" stopColor="#2B8DFF" />
          <stop offset="1" stopColor="#21E4C5" />
        </linearGradient>
      </defs>

      <g stroke={`url(#${gradientId})`} strokeLinecap="round" strokeLinejoin="round" strokeWidth="10">
        <path d="M40 15 17 38a14 14 0 0 0 0 20l11 11a14 14 0 0 0 20 0l23-23" />
        <path d="m56 81 23-23a14 14 0 0 0 0-20L68 27a14 14 0 0 0-20 0L25 50" />
      </g>

      <path d="m37 38 22 22" stroke="#8EDCFF" strokeLinecap="round" strokeWidth="8" />
    </svg>
  );
}
