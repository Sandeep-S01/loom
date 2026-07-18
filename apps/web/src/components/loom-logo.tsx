import React from "react";

interface LoomLogoProps {
  className?: string;
  markClassName?: string;
  textClassName?: string;
  showWordmark?: boolean;
  ariaLabel?: string;
  variant?: "color" | "mono" | "white";
}

export function LoomLogo({
  className,
  markClassName,
  textClassName,
  showWordmark = true,
  ariaLabel = "Loom",
  variant = "color",
}: LoomLogoProps) {
  const imageClassName = showWordmark
    ? textClassName ?? "h-6 sm:h-[25px] w-auto"
    : markClassName ?? "h-8 w-auto";
  const imageSrc = getLogoSrc(showWordmark, variant);
  const fallbackSize = showWordmark
    ? { width: 220, height: 63 }
    : { width: 64, height: 64 };

  return (
    <span
      aria-label={ariaLabel}
      className={["inline-flex items-center", className].filter(Boolean).join(" ")}
      role="img"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        alt=""
        aria-hidden="true"
        className={["block object-contain", imageClassName].filter(Boolean).join(" ")}
        height={fallbackSize.height}
        src={imageSrc}
        width={fallbackSize.width}
      />
    </span>
  );
}

function getLogoSrc(
  showWordmark: boolean,
  variant: NonNullable<LoomLogoProps["variant"]>,
) {
  if (!showWordmark) {
    return "/brand/loom-favicon-transparent.png";
  }

  if (variant === "white") {
    return "/brand/loom-logo-header-white.png";
  }

  return "/brand/loom-logo-header.png";
}
