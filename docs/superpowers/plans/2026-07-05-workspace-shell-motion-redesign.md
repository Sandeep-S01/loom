# Workspace Shell Motion Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current static workspace sidebar with a persistent icon rail, an expanding contextual panel, and a faster chat-first shell with smooth CSS-based slide and fade transitions.

**Architecture:** Keep the existing data-fetching and section state in the workspace shell, but split the UI into smaller presentational helpers: an icon rail, a contextual panel, and a refined chat stage. Use CSS-first transitions driven by component state and `prefers-reduced-motion`, avoiding any new animation runtime.

**Tech Stack:** Next.js App Router, React 19, TypeScript, Tailwind CSS, existing CLM web API helpers

---

## File Structure

### Files to create

- `apps/web/src/components/workspace-icon-rail.tsx`
  - Renders the persistent left icon rail, active states, collapse toggle behavior, and mobile open button.
- `apps/web/src/components/workspace-context-panel.tsx`
  - Renders the expanding side panel and section-specific panel content wrappers.
- `apps/web/src/components/chat-empty-state.tsx`
  - Renders the new intentional chat landing state with heading, prompt starters, and input framing.

### Files to modify

- `apps/web/src/components/workspace-app-shell.tsx`
  - Keeps all stateful orchestration, but delegates layout pieces to the new helpers and drives motion state.
- `apps/web/src/components/message-composer.tsx`
  - Tightens the composer layout to fit the cleaner chat stage and empty-state experience.
- `apps/web/src/components/message-thread.tsx`
  - Reduces excess chrome so the active thread matches the new shell.
- `apps/web/src/app/globals.css`
  - Adds shared motion classes and reduced-motion fallbacks for panel and section transitions.

### Files to verify only

- `apps/web/src/app/page.tsx`
- `apps/web/src/app/chat/page.tsx`

These routes should continue rendering `WorkspaceAppShell` without structural changes.

## Task 1: Extract Navigation Metadata And Icon Rail

**Files:**
- Create: `apps/web/src/components/workspace-icon-rail.tsx`
- Modify: `apps/web/src/components/workspace-app-shell.tsx`
- Test: `apps/web/src/components/workspace-app-shell.tsx`

- [ ] **Step 1: Define a reusable section type and navigation metadata in `workspace-app-shell.tsx`**

Add an exported section type and metadata shape so the new helpers can consume consistent labels and descriptions.

```tsx
export type WorkspaceSection =
  | "chat"
  | "workspaces"
  | "models"
  | "companion"
  | "activity"
  | "settings";

export interface WorkspaceSectionMeta {
  label: string;
  eyebrow: string;
  description: string;
  shortLabel: string;
}

export const SECTION_ORDER: WorkspaceSection[] = [
  "chat",
  "workspaces",
  "models",
  "companion",
  "activity",
  "settings",
];
```

- [ ] **Step 2: Extend the section metadata with compact labels for the rail**

Update `SECTION_META` so each section has a compact `shortLabel` used in the icon rail.

```tsx
const SECTION_META: Record<WorkspaceSection, WorkspaceSectionMeta> = {
  chat: {
    label: "Chat",
    eyebrow: "Primary",
    description:
      "Conversations stay in focus while workspace and provider status remain nearby.",
    shortLabel: "CH",
  },
  workspaces: {
    label: "Workspaces",
    eyebrow: "Local Folders",
    description: "Manage registered folders and monitor the machine they are bound to.",
    shortLabel: "WS",
  },
  models: {
    label: "Models & API Keys",
    eyebrow: "Providers",
    description: "Review model availability and provider routing readiness from one place.",
    shortLabel: "MD",
  },
  companion: {
    label: "Companion",
    eyebrow: "Desktop Pairing",
    description: "Pair, reconnect, and troubleshoot the desktop companion without leaving the workspace.",
    shortLabel: "CP",
  },
  activity: {
    label: "Activity",
    eyebrow: "History",
    description: "Recent conversations and agent runs stay visible in one consolidated stream.",
    shortLabel: "AC",
  },
  settings: {
    label: "Settings",
    eyebrow: "Configuration",
    description: "Organize application preferences by category instead of scattering them across views.",
    shortLabel: "ST",
  },
};
```

- [ ] **Step 3: Create `workspace-icon-rail.tsx`**

Implement a focused icon rail component using lightweight text glyphs instead of adding an icon package.

```tsx
import type { WorkspaceSection, WorkspaceSectionMeta } from "./workspace-app-shell";

interface WorkspaceIconRailProps {
  activeSection: WorkspaceSection;
  isPanelOpen: boolean;
  onSelectSection: (section: WorkspaceSection) => void;
  sectionMeta: Record<WorkspaceSection, WorkspaceSectionMeta>;
  sectionOrder: WorkspaceSection[];
  conversationCount: number;
}

export function WorkspaceIconRail({
  activeSection,
  isPanelOpen,
  onSelectSection,
  sectionMeta,
  sectionOrder,
  conversationCount,
}: WorkspaceIconRailProps) {
  return (
    <aside className="flex h-full w-[76px] flex-col border-r border-white/8 bg-[#0d1016]">
      <div className="flex items-center justify-center px-3 py-5">
        <button
          className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/6 text-sm font-semibold text-white transition hover:bg-white/10"
          onClick={() => onSelectSection(activeSection)}
          type="button"
        >
          CLM
        </button>
      </div>

      <nav className="flex-1 px-3 py-3">
        <div className="space-y-2">
          {sectionOrder.map((section) => {
            const selected = section === activeSection;

            return (
              <button
                key={section}
                aria-pressed={selected}
                className={[
                  "group flex h-12 w-12 items-center justify-center rounded-2xl border text-[11px] font-semibold tracking-[0.18em] transition",
                  selected && isPanelOpen
                    ? "border-accent/60 bg-accent/14 text-white shadow-[0_10px_30px_rgba(99,102,241,0.22)]"
                    : "border-transparent bg-transparent text-text-muted hover:border-white/8 hover:bg-white/5 hover:text-text-primary",
                ].join(" ")}
                onClick={() => onSelectSection(section)}
                title={sectionMeta[section].label}
                type="button"
              >
                {section === "chat" ? conversationCount : sectionMeta[section].shortLabel}
              </button>
            );
          })}
        </div>
      </nav>
    </aside>
  );
}
```

- [ ] **Step 4: Add panel-open state and section toggle logic in `workspace-app-shell.tsx`**

Add a dedicated `isPanelOpen` state and a toggle handler so clicking the active section collapses the panel.

```tsx
const [isPanelOpen, setIsPanelOpen] = useState(true);

function handleSelectSection(section: WorkspaceSection) {
  setActiveSection((current) => {
    if (current === section) {
      setIsPanelOpen((open) => !open);
      return current;
    }

    setIsPanelOpen(true);
    return section;
  });
}
```

- [ ] **Step 5: Replace the old static sidebar with the icon rail**

Update the shell root layout to mount `WorkspaceIconRail` and remove the current button list sidebar.

```tsx
<div className="flex min-h-screen bg-[#0a0c11] text-text-primary">
  <WorkspaceIconRail
    activeSection={activeSection}
    conversationCount={conversations.length}
    isPanelOpen={isPanelOpen}
    onSelectSection={handleSelectSection}
    sectionMeta={SECTION_META}
    sectionOrder={SECTION_ORDER}
  />
  <div className="flex min-h-screen min-w-0 flex-1">
    {/* contextual panel + main stage live here */}
  </div>
</div>
```

- [ ] **Step 6: Run typecheck to catch component export/import mistakes**

Run: `pnpm --filter @clm/web typecheck`

Expected: `tsc --noEmit` completes without import or prop errors related to `WorkspaceIconRail`.

- [ ] **Step 7: Commit the navigation extraction**

```bash
git add apps/web/src/components/workspace-app-shell.tsx apps/web/src/components/workspace-icon-rail.tsx
git commit -m "feat: add workspace icon rail shell"
```

## Task 2: Build The Expanding Context Panel And Responsive Shell

**Files:**
- Create: `apps/web/src/components/workspace-context-panel.tsx`
- Modify: `apps/web/src/components/workspace-app-shell.tsx`
- Modify: `apps/web/src/app/globals.css`
- Test: `apps/web/src/components/workspace-context-panel.tsx`

- [ ] **Step 1: Create `workspace-context-panel.tsx` with panel container motion classes**

Implement the shared panel shell first so each section can render inside one animated wrapper.

```tsx
import type { ReactNode } from "react";
import type { WorkspaceSection, WorkspaceSectionMeta } from "./workspace-app-shell";

interface WorkspaceContextPanelProps {
  activeSection: WorkspaceSection;
  isOpen: boolean;
  meta: WorkspaceSectionMeta;
  children: ReactNode;
}

export function WorkspaceContextPanel({
  activeSection,
  isOpen,
  meta,
  children,
}: WorkspaceContextPanelProps) {
  return (
    <aside
      aria-hidden={!isOpen}
      className={[
        "workspace-panel-shell",
        isOpen ? "workspace-panel-shell--open" : "workspace-panel-shell--closed",
      ].join(" ")}
      data-section={activeSection}
    >
      <div className="flex h-full flex-col">
        <div className="border-b border-white/8 px-5 py-5">
          <p className="text-[11px] uppercase tracking-[0.24em] text-text-muted">
            {meta.eyebrow}
          </p>
          <h2 className="mt-2 text-lg font-semibold text-white">{meta.label}</h2>
          <p className="mt-2 text-sm leading-6 text-text-secondary">{meta.description}</p>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
      </div>
    </aside>
  );
}
```

- [ ] **Step 2: Add shared motion classes in `globals.css`**

Create CSS classes that animate width, opacity, and transform together while respecting reduced motion.

```css
@layer components {
  .workspace-panel-shell {
    width: 0;
    opacity: 0;
    transform: translateX(-14px);
    overflow: hidden;
    border-right: 1px solid rgba(255, 255, 255, 0.08);
    background: #11141b;
    transition:
      width 180ms ease,
      opacity 160ms ease,
      transform 180ms ease;
  }

  .workspace-panel-shell--open {
    width: 320px;
    opacity: 1;
    transform: translateX(0);
  }

  .workspace-panel-shell--closed {
    width: 0;
    opacity: 0;
    transform: translateX(-14px);
  }

  .workspace-stage-enter {
    opacity: 0;
    transform: translateX(12px);
  }

  .workspace-stage-enter-active {
    opacity: 1;
    transform: translateX(0);
    transition:
      opacity 180ms ease,
      transform 180ms ease;
  }
}

@media (prefers-reduced-motion: reduce) {
  .workspace-panel-shell,
  .workspace-stage-enter-active {
    transition: none;
    transform: none;
  }
}
```

- [ ] **Step 3: Add responsive panel overlay state in `workspace-app-shell.tsx`**

Track mobile panel visibility separately so the desktop open/close behavior does not fight the mobile overlay.

```tsx
const [isMobilePanelOpen, setIsMobilePanelOpen] = useState(false);

function handleSelectSection(section: WorkspaceSection) {
  const isSmallScreen = typeof window !== "undefined" && window.innerWidth < 1024;

  setActiveSection((current) => {
    if (current === section) {
      if (isSmallScreen) {
        setIsMobilePanelOpen((open) => !open);
      } else {
        setIsPanelOpen((open) => !open);
      }

      return current;
    }

    if (isSmallScreen) {
      setIsMobilePanelOpen(true);
    } else {
      setIsPanelOpen(true);
    }

    return section;
  });
}
```

- [ ] **Step 4: Mount the contextual panel beside the rail and before the main stage**

Move panel-specific content from the main stage into the panel wrapper.

```tsx
<div className="relative flex min-h-screen min-w-0 flex-1">
  <WorkspaceContextPanel
    activeSection={activeSection}
    isOpen={isPanelOpen}
    meta={SECTION_META[activeSection]}
  >
    {renderContextPanel()}
  </WorkspaceContextPanel>

  <main className="min-w-0 flex-1">{renderMainStage()}</main>
</div>
```

- [ ] **Step 5: Implement `renderContextPanel()` in `workspace-app-shell.tsx`**

Lift the chat conversation list into the panel and keep other sections concise.

```tsx
function renderContextPanel() {
  if (activeSection === "chat") {
    return (
      <div className="flex h-full flex-col">
        <div className="border-b border-white/8 px-5 py-4">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-text-secondary">Search, switch, and pin important threads.</p>
            <button
              className="rounded-xl bg-accent px-3 py-2 text-sm font-medium text-white transition hover:bg-accent-hover"
              onClick={handleCreateConversation}
              type="button"
            >
              New
            </button>
          </div>
          <input
            className="mt-4 w-full rounded-2xl border border-white/10 bg-[#0b0d12] px-3 py-2.5 text-sm text-text-primary outline-none transition placeholder:text-text-muted focus:border-accent"
            onChange={(event) => setConversationSearch(event.target.value)}
            placeholder="Search conversations"
            value={conversationSearch}
          />
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-3">
          {renderConversationList()}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 px-5 py-5 text-sm text-text-secondary">
      <p>{SECTION_META[activeSection].description}</p>
      <p>Use the main stage to view and act on this section.</p>
    </div>
  );
}
```

- [ ] **Step 6: Add mobile overlay markup and close interactions**

Render a backdrop only when the mobile panel is open.

```tsx
{isMobilePanelOpen ? (
  <button
    aria-label="Close side panel"
    className="fixed inset-0 z-20 bg-black/50 lg:hidden"
    onClick={() => setIsMobilePanelOpen(false)}
    type="button"
  />
) : null}
```

- [ ] **Step 7: Run build to verify responsive shell code compiles**

Run: `pnpm --filter @clm/web build`

Expected: `next build` completes successfully with no CSS or component errors.

- [ ] **Step 8: Commit the panel shell**

```bash
git add apps/web/src/components/workspace-app-shell.tsx apps/web/src/components/workspace-context-panel.tsx apps/web/src/app/globals.css
git commit -m "feat: add expanding workspace context panel"
```

## Task 3: Redesign The Chat Stage And Empty State

**Files:**
- Create: `apps/web/src/components/chat-empty-state.tsx`
- Modify: `apps/web/src/components/workspace-app-shell.tsx`
- Modify: `apps/web/src/components/message-composer.tsx`
- Modify: `apps/web/src/components/message-thread.tsx`
- Test: `apps/web/src/components/chat-empty-state.tsx`

- [ ] **Step 1: Create `chat-empty-state.tsx`**

Add a presentational component for the new landing view so the shell stays readable.

```tsx
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
    <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col justify-center px-6 py-10">
      <div className="max-w-3xl">
        <p className="text-sm uppercase tracking-[0.28em] text-text-muted">CLM Workspace</p>
        <h1 className="mt-5 text-4xl font-semibold leading-tight text-white sm:text-5xl">
          Build, debug, and move the workspace forward.
        </h1>
        <p className="mt-4 max-w-2xl text-lg leading-8 text-text-secondary">
          Start with a thread, paste an error, or pick a focused prompt to begin.
        </p>
      </div>

      <div className="mt-10 grid gap-3 lg:grid-cols-2">
        {PROMPTS.map((prompt) => (
          <button
            key={prompt}
            className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-4 text-left text-sm text-text-primary transition hover:border-white/18 hover:bg-white/[0.05]"
            onClick={() => onPromptSelect(prompt)}
            type="button"
          >
            {prompt}
          </button>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Add draft message state in `workspace-app-shell.tsx`**

Store prompt clicks locally so empty-state prompt selection can seed the composer.

```tsx
const [draftMessage, setDraftMessage] = useState("");
```

- [ ] **Step 3: Render the empty-state component when there are no messages**

In the chat main stage, replace the generic blank thread area with the new landing component.

```tsx
const showChatEmptyState = messages.length === 0 && !isLoadingMessages;

<section className="flex min-h-0 flex-1 flex-col">
  {showChatEmptyState ? (
    <ChatEmptyState onPromptSelect={setDraftMessage} />
  ) : (
    <div className="min-h-0 flex-1 overflow-y-auto px-6 py-6">
      <MessageThread isLoading={isLoadingMessages} messages={messages} />
    </div>
  )}

  <MessageComposer
    disabled={isSending}
    draftValue={draftMessage}
    onDraftChange={setDraftMessage}
    onSend={handleSend}
  />
</section>
```

- [ ] **Step 4: Extend `message-composer.tsx` to support controlled draft values**

Replace internal-only text state with optional controlled props so the shell can push prompt text in.

```tsx
interface MessageComposerProps {
  disabled?: boolean;
  draftValue?: string;
  onDraftChange?: (value: string) => void;
  onSend: (text: string) => void | Promise<void>;
}

const [internalValue, setInternalValue] = useState("");
const value = draftValue ?? internalValue;

function updateValue(nextValue: string) {
  onDraftChange?.(nextValue);

  if (draftValue === undefined) {
    setInternalValue(nextValue);
  }
}
```

- [ ] **Step 5: Tighten the composer and thread visuals**

Simplify the chrome so the chat stage feels less card-stacked.

```tsx
// message-composer outer wrapper
<div className="border-t border-white/8 bg-[#0d1016] px-6 py-5">

// message-thread outer wrapper
<div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
```

- [ ] **Step 6: Simplify the chat header and supporting context column in `workspace-app-shell.tsx`**

Replace the heavier right-side card stack with compact inline status items near the top of the stage.

```tsx
<div className="flex flex-wrap items-center gap-3 text-sm text-text-secondary">
  <span className="rounded-full border border-white/8 px-3 py-1.5">
    {dashboard?.companion.connected ? "Companion online" : "Companion offline"}
  </span>
  <span className="rounded-full border border-white/8 px-3 py-1.5">
    {dashboard?.activeWorkspace?.alias ?? "No workspace"}
  </span>
  <span className="rounded-full border border-white/8 px-3 py-1.5">
    {dashboard ? `${dashboard.providerSummary.eligibleCount} eligible models` : "Loading models"}
  </span>
</div>
```

- [ ] **Step 7: Run typecheck after controlled-composer changes**

Run: `pnpm --filter @clm/web typecheck`

Expected: `tsc --noEmit` passes with updated `MessageComposer` props.

- [ ] **Step 8: Commit the chat stage redesign**

```bash
git add apps/web/src/components/workspace-app-shell.tsx apps/web/src/components/chat-empty-state.tsx apps/web/src/components/message-composer.tsx apps/web/src/components/message-thread.tsx
git commit -m "feat: redesign chat stage and empty state"
```

## Task 4: Add Main Stage Motion And Reduced-Motion Behavior

**Files:**
- Modify: `apps/web/src/components/workspace-app-shell.tsx`
- Modify: `apps/web/src/app/globals.css`
- Test: `apps/web/src/app/globals.css`

- [ ] **Step 1: Add transition key state for section changes**

Track section changes with a key so the stage can replay the entry transition when sections switch.

```tsx
const [stageKey, setStageKey] = useState(0);

function handleSelectSection(section: WorkspaceSection) {
  setActiveSection((current) => {
    if (current !== section) {
      setStageKey((value) => value + 1);
    }

    // keep existing open/close logic here
    return nextSection;
  });
}
```

- [ ] **Step 2: Add stage transition classes to the main content root**

Wrap the main stage with a keyed container so each section switch receives the short slide + fade entry.

```tsx
<div
  key={stageKey}
  className="workspace-stage-enter workspace-stage-enter-active flex min-h-screen min-w-0 flex-1 flex-col"
>
  {renderMainStage()}
</div>
```

- [ ] **Step 3: Add mobile-specific panel width rules in `globals.css`**

Ensure the panel overlays cleanly on smaller screens instead of shrinking the main stage.

```css
@media (max-width: 1023px) {
  .workspace-panel-shell {
    position: fixed;
    left: 76px;
    top: 0;
    z-index: 30;
    height: 100vh;
    max-width: calc(100vw - 76px);
  }

  .workspace-panel-shell--open {
    width: min(320px, calc(100vw - 76px));
  }
}
```

- [ ] **Step 4: Add stage containment styles for faster repaints**

Use containment selectively on the stage wrapper to reduce visual jank during section swaps.

```css
@layer components {
  .workspace-stage-frame {
    contain: layout paint;
    will-change: transform, opacity;
  }
}
```

- [ ] **Step 5: Apply containment class only to the animating stage wrapper**

```tsx
<div
  key={stageKey}
  className="workspace-stage-enter workspace-stage-enter-active workspace-stage-frame flex min-h-screen min-w-0 flex-1 flex-col"
>
  {renderMainStage()}
</div>
```

- [ ] **Step 6: Run production build after motion changes**

Run: `pnpm --filter @clm/web build`

Expected: `next build` succeeds and emits the `/` and `/chat` static routes.

- [ ] **Step 7: Commit motion and responsive behavior**

```bash
git add apps/web/src/components/workspace-app-shell.tsx apps/web/src/app/globals.css
git commit -m "feat: add workspace shell motion states"
```

## Task 5: Final Verification And Cleanup

**Files:**
- Modify: `apps/web/src/components/workspace-app-shell.tsx`
- Test: `apps/web/src/components/workspace-app-shell.tsx`

- [ ] **Step 1: Remove any duplicated panel or sidebar markup left behind during refactor**

The final shell should have one icon rail, one contextual panel, and one main stage. Delete any dead JSX from the old static sidebar and old chat left column.

```tsx
// remove patterns like:
<aside className="flex min-h-0 flex-col rounded-2xl border border-white/8 bg-[#11141b]">
  {/* old conversation sidebar */}
</aside>
```

- [ ] **Step 2: Normalize chat layout spacing and section wrappers**

Make sure all main-stage section wrappers use a consistent container width and padding rhythm.

```tsx
<div className="flex-1 px-6 py-6 lg:px-8 lg:py-7">
  {renderSectionBody()}
</div>
```

- [ ] **Step 3: Run the full verification commands**

Run: `pnpm --filter @clm/web typecheck`

Expected: PASS

Run: `pnpm --filter @clm/web build`

Expected: PASS with routes for `/` and `/chat`

- [ ] **Step 4: Perform manual UI verification**

Check these behaviors in the browser:

- `/` opens the chat section by default
- icon rail remains visible at all times
- clicking an inactive icon opens its section and the panel
- clicking the active icon collapses the panel
- panel open/close feels smooth and completes quickly
- section changes use subtle slide + fade motion
- mobile-width viewport overlays the panel with a backdrop
- empty-state prompt click seeds the composer

- [ ] **Step 5: Commit the completed shell refactor**

```bash
git add apps/web/src/components/workspace-app-shell.tsx apps/web/src/components/workspace-icon-rail.tsx apps/web/src/components/workspace-context-panel.tsx apps/web/src/components/chat-empty-state.tsx apps/web/src/components/message-composer.tsx apps/web/src/components/message-thread.tsx apps/web/src/app/globals.css
git commit -m "feat: redesign workspace shell motion"
```

## Self-Review

### Spec coverage

- Persistent icon rail: covered by Task 1
- Expanding contextual panel: covered by Task 2
- Chat-first shell and cleaner empty state: covered by Task 3
- Fast slide + fade motion: covered by Task 4
- Mobile overlay behavior and reduced motion: covered by Task 2 and Task 4
- Final build safety and behavior verification: covered by Task 5

No spec gaps found.

### Placeholder scan

- No `TODO`, `TBD`, or “implement later” placeholders remain
- Each task names exact files and commands
- Each code-changing step includes concrete code to add or adapt

### Type consistency

- `WorkspaceSection` and `WorkspaceSectionMeta` are defined once in Task 1 and reused consistently
- `MessageComposer` controlled props are introduced in Task 3 and consumed with matching names
- `WorkspaceIconRail` and `WorkspaceContextPanel` prop names match their call sites in later tasks

