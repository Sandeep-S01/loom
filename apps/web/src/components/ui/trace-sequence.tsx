import { ArrowDown } from "lucide-react";

export interface TraceStep {
  index: string;
  label: string;
  value: string;
  tone?: "normal" | "active" | "highlight";
}

interface TraceSequenceProps {
  steps: TraceStep[];
  className?: string;
  animate?: boolean;
}

export function TraceSequence({ steps, className, animate = true }: TraceSequenceProps) {
  return (
    <div className={["space-y-1.5", className ?? ""].join(" ").trim()}>
      {steps.map((step, idx) => {
        const isHighlight = step.tone === "active" || step.tone === "highlight";
        // Support animations dynamically up to 3 steps as defined in CSS keyframes
        const animClass = animate && idx < 3 ? `animate-trace-${idx + 1}` : "";
        const arrowAnimClass = animate && idx < 3 ? `animate-trace-arrow-${idx}` : "";

        return (
          <div key={step.index + step.label} className="block">
            {idx > 0 ? (
              <div className={["flex justify-center py-1", arrowAnimClass].filter(Boolean).join(" ").trim()}>
                <ArrowDown className="text-[color:var(--color-border-strong)] h-3.5 w-3.5" />
              </div>
            ) : null}
            
            <div
              className={[
                "flex items-center gap-3 rounded-md border p-2.5",
                isHighlight
                  ? "border-[color:var(--color-accent)]/20 bg-[color:var(--color-accent)]/5"
                  : "border-[color:var(--color-border-subtle)] bg-[color:var(--color-bg-base)]/50",
                animClass,
              ]
                .filter(Boolean)
                .join(" ")
                .trim()}
            >
              <span className="font-mono text-[9px] text-[color:var(--color-accent)]">{step.index}</span>
              <span
                className={[
                  "font-mono text-[10px]",
                  isHighlight ? "font-semibold text-[color:var(--color-accent)]" : "text-text-secondary",
                ]
                  .filter(Boolean)
                  .join(" ")
                  .trim()}
              >
                {step.label}:
              </span>
              <span className="font-mono text-[10px] text-text-primary truncate">{step.value}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
