"use client";

interface ChatEmptyStateProps {
  onPromptSelect: (text: string) => void;
}

const PROMPTS = [
  "Outline a step-by-step implementation plan for the current milestone.",
  "Review this code change and list the highest-risk regressions.",
  "Summarize the current workspace state and next engineering actions.",
  "Help me debug a failing API request in this project.",
];

export function ChatEmptyState({ onPromptSelect }: ChatEmptyStateProps) {
  return (
    <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col justify-center px-6 py-8">
      <div className="max-w-2xl">
        <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-text-muted">
          Loom Workspace
        </p>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight leading-tight text-transparent bg-clip-text bg-gradient-to-r from-white via-white to-white/50 sm:text-4xl">
          Build, debug, and move the workspace forward.
        </h1>
        <p className="mt-3 max-w-xl text-sm leading-relaxed text-text-secondary">
          Start with a thread, paste an error, or pick a focused prompt to begin.
        </p>
      </div>

      <div className="mt-8 grid gap-3 sm:grid-cols-2">
        {PROMPTS.map((prompt, index) => (
          <button
            key={prompt}
            className="group relative rounded-xl border border-white/5 bg-white/[0.01] px-4 py-3.5 text-left text-xs text-text-secondary transition-all duration-200 hover:-translate-y-0.5 hover:border-accent/25 hover:bg-accent/[0.02] hover:text-text-primary"
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
