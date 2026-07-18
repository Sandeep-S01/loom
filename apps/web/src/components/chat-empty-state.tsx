"use client";

interface ChatEmptyStateProps {
  onPromptSelect: (text: string) => void;
}

const PROMPTS = [
  "Plan the next implementation step.",
  "Review this change for regressions.",
  "Help debug a failing request.",
];

export function ChatEmptyState({ onPromptSelect }: ChatEmptyStateProps) {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center px-4 py-6 sm:px-6">
      <div className="max-w-xl">
        <h1 className="font-headline text-2xl font-medium leading-tight tracking-[-0.03em] text-[color:var(--color-text-primary)] sm:text-3xl">
          What are we working on?
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-text-secondary">
          Start a thread or choose a prompt.
        </p>
      </div>

      <div className="mt-6 grid gap-2.5 sm:grid-cols-3">
        {PROMPTS.map((prompt, index) => (
          <button
            key={prompt}
            className="group rounded-lg border border-[color:var(--color-border-subtle)] bg-[color:var(--color-surface-panel)] px-3.5 py-3 text-left text-xs text-text-secondary transition-colors duration-200 hover:border-[color:var(--color-border-strong)] hover:bg-[color:var(--color-bg-hover)] hover:text-text-primary"
            onClick={() => onPromptSelect(prompt)}
            type="button"
          >
            <div className="flex items-start gap-2.5">
              <span className="text-[10px] font-mono text-text-muted mt-0.5 transition-colors group-hover:text-accent">
                0{index + 1}
              </span>
              <p className="leading-relaxed flex-1">{prompt}</p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
