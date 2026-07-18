import React, { type ButtonHTMLAttributes, type ReactNode } from "react";

type ButtonVariant = "primary" | "secondary" | "ghost";
type ButtonSize = "sm" | "md";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  isLoading?: boolean;
  size?: ButtonSize;
  variant?: ButtonVariant;
}

const VARIANT_CLASSNAMES: Record<ButtonVariant, string> = {
  primary: "ui-button-accent text-[color:var(--color-accent-text)]",
  secondary: "ui-button-subtle text-text-primary",
  ghost: "bg-transparent text-text-secondary hover:text-text-primary",
};

const SIZE_CLASSNAMES: Record<ButtonSize, string> = {
  sm: "h-10 px-3.5 text-[13px] font-medium",
  md: "h-10 px-[18px] text-sm font-medium",
};

export function Button({
  children,
  className,
  disabled,
  isLoading = false,
  size = "md",
  variant = "primary",
  ...props
}: ButtonProps) {
  return (
    <button
      className={[
        "inline-flex items-center justify-center gap-2 rounded-md transition disabled:cursor-not-allowed disabled:saturate-75",
        VARIANT_CLASSNAMES[variant],
        SIZE_CLASSNAMES[size],
        className ?? "",
      ].join(" ")}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading ? (
        <svg className="h-3.5 w-3.5 animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 0 1 8-8v8H4z" />
        </svg>
      ) : null}
      {children}
    </button>
  );
}
