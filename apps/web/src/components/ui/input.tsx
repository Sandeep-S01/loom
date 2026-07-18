"use client";

import { useState } from "react";
import type { InputHTMLAttributes } from "react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  revealable?: boolean;
}

export function Input({
  className,
  id,
  label,
  revealable = false,
  type = "text",
  ...props
}: InputProps) {
  const [revealed, setRevealed] = useState(false);
  const resolvedType = revealable ? (revealed ? "text" : "password") : type;

  return (
    <div>
      {label ? (
        <label className="mb-1.5 block font-label text-[11px] font-semibold uppercase tracking-[0.08em] text-text-secondary" htmlFor={id}>
          {label}
        </label>
      ) : null}
      <div className="relative flex items-center">
        <input
          className={[
            "ui-input h-11 w-full px-4 py-3 text-sm",
            revealable ? "pr-16" : "",
            className ?? "",
          ].join(" ")}
          id={id}
          type={resolvedType}
          {...props}
        />
        {revealable ? (
          <button
            className="absolute right-3 rounded px-2 py-1 text-[12px] text-text-muted transition hover:text-text-primary"
            onClick={() => setRevealed((current) => !current)}
            type="button"
          >
            {revealed ? "Hide" : "Show"}
          </button>
        ) : null}
      </div>
    </div>
  );
}
