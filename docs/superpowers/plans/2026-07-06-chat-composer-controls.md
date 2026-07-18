# Chat Composer Controls Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add working composer controls for local attachments, composer settings, and manual model selection without changing the backend chat contract.

**Architecture:** Keep the backend unchanged and implement the feature entirely in the web app. Extend `MessageComposer` with small local state helpers and presentational subcomponents, then pass optional composer metadata through the chat shell only where needed for UI state and persistence. Use pure helper tests for deterministic logic and keep popover behavior contained to the composer layer.

**Tech Stack:** Next.js, React 19, TypeScript, existing workspace shell CSS, Vitest, browser `localStorage`, browser file input APIs.

---

## File Structure

- Create: `apps/web/src/components/message-composer-controls.tsx`
  - Small local subcomponents for attachment chips, model button, settings popover.
- Create: `apps/web/src/components/message-composer-state.ts`
  - Pure helpers for attachment dedupe, settings defaults, model options, local storage serialization.
- Create: `apps/web/src/components/message-composer-state.test.ts`
  - Focused tests for helper logic.
- Modify: `apps/web/src/components/message-composer.tsx`
  - Add hidden file input, chips, settings menu, model picker, local persistence hooks.
- Modify: `apps/web/src/components/message-composer.test.tsx`
  - Add render-level assertions for new accessible controls.
- Modify: `apps/web/src/components/chat-shell.tsx`
  - Accept richer composer callbacks if needed, keep send path backend-compatible.
- Modify: `apps/web/src/components/use-workspace-chat-controller.ts`
  - If needed, hold selected model badge state in parent layer for active conversation UI continuity.
- Modify: `apps/web/src/components/workspace-section-renderer.tsx`
  - Thread new composer props into workspace chat section if the composer contract changes.
- Modify: `apps/web/src/app/globals.css`
  - Add polished styles for attachment chips, popovers, model badge, and tool active states.

## Task 1: Add Pure Composer State Helpers

**Files:**
- Create: `apps/web/src/components/message-composer-state.ts`
- Test: `apps/web/src/components/message-composer-state.test.ts`

- [ ] **Step 1: Write the failing helper tests**

```ts
import { describe, expect, it } from "vitest";
import {
  appendUniqueFiles,
  buildAttachmentKey,
  getDefaultComposerSettings,
  normalizeModelOptions,
} from "./message-composer-state";

describe("message composer state helpers", () => {
  it("deduplicates files by name, size, and lastModified", () => {
    const first = { name: "spec.pdf", size: 100, lastModified: 1 } as File;
    const duplicate = { name: "spec.pdf", size: 100, lastModified: 1 } as File;
    const second = { name: "notes.txt", size: 50, lastModified: 2 } as File;

    expect(appendUniqueFiles([first], [duplicate, second]).map(buildAttachmentKey)).toEqual([
      "spec.pdf:100:1",
      "notes.txt:50:2",
    ]);
  });

  it("returns stable defaults for composer settings", () => {
    expect(getDefaultComposerSettings()).toEqual({
      enterToSend: true,
      showModelBadge: true,
    });
  });

  it("normalizes model options to unique id/label pairs", () => {
    expect(
      normalizeModelOptions([
        { id: "mdl_qwen", label: "Qwen 3 30B" },
        { id: "mdl_qwen", label: "Qwen 3 30B" },
        { id: "mdl_gemini", label: "Gemini 1.5 Flash" },
      ]),
    ).toEqual([
      { id: "mdl_qwen", label: "Qwen 3 30B" },
      { id: "mdl_gemini", label: "Gemini 1.5 Flash" },
    ]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `apps/backend/node_modules/.bin/vitest.cmd run apps/web/src/components/message-composer-state.test.ts`

Expected: FAIL with module-not-found or missing export errors for `message-composer-state.ts`.

- [ ] **Step 3: Write minimal helper implementation**

```ts
export interface ComposerSettings {
  enterToSend: boolean;
  showModelBadge: boolean;
}

export interface ComposerModelOption {
  id: string;
  label: string;
}

export function buildAttachmentKey(file: Pick<File, "name" | "size" | "lastModified">) {
  return `${file.name}:${file.size}:${file.lastModified}`;
}

export function appendUniqueFiles(current: File[], incoming: File[]) {
  const seen = new Set(current.map(buildAttachmentKey));
  const next = [...current];

  for (const file of incoming) {
    const key = buildAttachmentKey(file);
    if (seen.has(key)) continue;
    seen.add(key);
    next.push(file);
  }

  return next;
}

export function getDefaultComposerSettings(): ComposerSettings {
  return {
    enterToSend: true,
    showModelBadge: true,
  };
}

export function normalizeModelOptions(options: ComposerModelOption[]) {
  const seen = new Set<string>();
  const normalized: ComposerModelOption[] = [];

  for (const option of options) {
    if (seen.has(option.id)) continue;
    seen.add(option.id);
    normalized.push(option);
  }

  return normalized;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `apps/backend/node_modules/.bin/vitest.cmd run apps/web/src/components/message-composer-state.test.ts`

Expected: PASS with 3 passing tests.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/message-composer-state.ts apps/web/src/components/message-composer-state.test.ts
git commit -m "feat: add composer state helpers"
```

## Task 2: Extend Composer Render Contract

**Files:**
- Modify: `apps/web/src/components/message-composer.tsx`
- Modify: `apps/web/src/components/message-composer.test.tsx`

- [ ] **Step 1: Write the failing render test**

```ts
it("renders attachment, settings, and model controls with accessible labels", () => {
  const markup = renderToStaticMarkup(
    <MessageComposer
      availableModels={[
        { id: "mdl_qwen", label: "Qwen 3 30B" },
        { id: "mdl_gemini", label: "Gemini 1.5 Flash" },
      ]}
      onSend={vi.fn()}
    />,
  );

  expect(markup).toContain('aria-label="Attach files"');
  expect(markup).toContain('aria-label="Composer settings"');
  expect(markup).toContain('aria-label="Choose model"');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `apps/backend/node_modules/.bin/vitest.cmd run apps/web/src/components/message-composer.test.tsx`

Expected: FAIL because `MessageComposer` does not yet accept `availableModels` and does not render those labels.

- [ ] **Step 3: Update the composer props minimally**

```ts
interface ComposerModelOption {
  id: string;
  label: string;
}

interface MessageComposerProps {
  availableModels?: ComposerModelOption[];
  disabled?: boolean;
  draftValue?: string;
  onDraftChange?: (value: string) => void;
  onSend: (text: string) => void | Promise<void>;
}
```

Add the three labeled buttons and keep existing send behavior unchanged.

- [ ] **Step 4: Run test to verify it passes**

Run: `apps/backend/node_modules/.bin/vitest.cmd run apps/web/src/components/message-composer.test.tsx`

Expected: PASS with the original textarea test and the new control-label test both passing.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/message-composer.tsx apps/web/src/components/message-composer.test.tsx
git commit -m "feat: add composer control contract"
```

## Task 3: Implement Attachments, Settings, and Model UI

**Files:**
- Create: `apps/web/src/components/message-composer-controls.tsx`
- Modify: `apps/web/src/components/message-composer.tsx`
- Modify: `apps/web/src/app/globals.css`

- [ ] **Step 1: Add the failing interaction test at the helper level**

```ts
it("keeps attachments local and removable before send", () => {
  const fileA = { name: "a.txt", size: 10, lastModified: 1 } as File;
  const fileB = { name: "b.txt", size: 20, lastModified: 2 } as File;

  const attached = appendUniqueFiles([], [fileA, fileB]);
  expect(attached.map((file) => file.name)).toEqual(["a.txt", "b.txt"]);

  const afterRemove = attached.filter((file) => buildAttachmentKey(file) !== buildAttachmentKey(fileA));
  expect(afterRemove.map((file) => file.name)).toEqual(["b.txt"]);
});
```

- [ ] **Step 2: Run test to verify it passes and then implement UI using that helper**

Run: `apps/backend/node_modules/.bin/vitest.cmd run apps/web/src/components/message-composer-state.test.ts`

Expected: PASS. Use this as the green baseline before editing UI.

- [ ] **Step 3: Implement the local composer UI**

Implement:
- hidden `<input type="file" multiple>`
- attachment chips above toolbar
- settings popover with:
  - `Enter to send`
  - `Show selected model badge`
- model picker popover using `availableModels`
- click-outside and `Escape` close behavior

Core component shape:

```tsx
const [attachments, setAttachments] = useState<File[]>([]);
const [settings, setSettings] = useState(loadComposerSettings());
const [selectedModelId, setSelectedModelId] = useState<string | null>(initialModelId);
const [openPopover, setOpenPopover] = useState<"attachments" | "settings" | "models" | null>(null);
```

Keep `handleSubmit()` backend-compatible:

```tsx
await onSend(trimmed);
```

Do not include files or model override in the request body in this pass.

- [ ] **Step 4: Add styles and verify the UI remains stable**

Add CSS blocks in `globals.css` for:
- `.composer-attachments`
- `.composer-chip`
- `.composer-popover`
- `.composer-model-btn`
- `.tool-btn-active`

Keep dimensions stable and avoid layout jump when chips appear.

- [ ] **Step 5: Run web typecheck**

Run: `pnpm --filter @clm/web typecheck`

Expected: PASS with no TypeScript errors.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/components/message-composer-controls.tsx apps/web/src/components/message-composer.tsx apps/web/src/app/globals.css
git commit -m "feat: add local composer controls"
```

## Task 4: Wire Model Options Into Chat Surfaces

**Files:**
- Modify: `apps/web/src/components/chat-shell.tsx`
- Modify: `apps/web/src/components/workspace-section-renderer.tsx`
- Modify: `apps/web/src/components/use-workspace-chat-controller.ts`

- [ ] **Step 1: Write the failing helper assertion for model options**

Use a narrow helper-driven check rather than a full UI harness:

```ts
it("normalizes the manual model list for display", () => {
  expect(
    normalizeModelOptions([
      { id: "mdl_qwen", label: "Qwen 3 30B" },
      { id: "mdl_gemini", label: "Gemini 1.5 Flash" },
    ]),
  ).toHaveLength(2);
});
```

- [ ] **Step 2: Run helper tests to confirm green baseline**

Run: `apps/backend/node_modules/.bin/vitest.cmd run apps/web/src/components/message-composer-state.test.ts`

Expected: PASS.

- [ ] **Step 3: Thread available models into the composer**

Create a local model list in the chat surfaces:

```ts
const composerModels = [
  { id: "mdl_qwen3_30b_free", label: "Qwen 3 30B" },
  { id: "mdl_deepseek_chat_free", label: "DeepSeek Chat" },
  { id: "mdl_gemini_15_flash", label: "Gemini 1.5 Flash" },
  { id: "mdl_gemini_15_pro", label: "Gemini 1.5 Pro" },
];
```

Pass it into:
- `ChatShell` composer
- workspace chat section composer

Do not refactor backend provider loading into the frontend in this pass unless the current UI already exposes a clean source.

- [ ] **Step 4: Run web typecheck again**

Run: `pnpm --filter @clm/web typecheck`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/chat-shell.tsx apps/web/src/components/workspace-section-renderer.tsx apps/web/src/components/use-workspace-chat-controller.ts
git commit -m "feat: wire manual model picker into chat surfaces"
```

## Task 5: Verify End-to-End UI and Production Build

**Files:**
- Modify: `apps/web/src/components/message-composer.tsx` only if fixes are required

- [ ] **Step 1: Run targeted frontend tests**

Run: `apps/backend/node_modules/.bin/vitest.cmd run apps/web/src/components/message-composer-state.test.ts apps/web/src/components/message-composer.test.tsx`

Expected: PASS with all targeted composer tests green.

- [ ] **Step 2: Run web build**

Run: `pnpm --filter @clm/web build`

Expected: PASS with successful Next.js production build.

- [ ] **Step 3: Manual verification in the browser**

Check all of the following at `http://localhost:3000`:
- paperclip opens file picker
- selected files render as chips
- chip remove button works
- gear opens and closes settings popover
- settings persist across refresh
- model button opens and allows selection
- selected model remains visible when enabled
- send still works with the existing backend chat flow
- no console errors from the new controls

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/message-composer.tsx apps/web/src/components/message-composer.test.tsx apps/web/src/components/message-composer-state.ts apps/web/src/components/message-composer-state.test.ts apps/web/src/components/message-composer-controls.tsx apps/web/src/components/chat-shell.tsx apps/web/src/components/workspace-section-renderer.tsx apps/web/src/components/use-workspace-chat-controller.ts apps/web/src/app/globals.css
git commit -m "feat: add professional chat composer controls"
```

## Self-Review

- Spec coverage:
  - paperclip behavior: covered in Task 3
  - settings popover and persistence: covered in Tasks 1 and 3
  - manual model picker: covered in Tasks 1, 3, and 4
  - no backend contract changes: preserved across Tasks 3 and 4
  - verification: covered in Task 5
- Placeholder scan:
  - No `TBD`, `TODO`, or vague “handle appropriately” language left in the task steps.
- Type consistency:
  - `ComposerModelOption`, `ComposerSettings`, `appendUniqueFiles`, and `normalizeModelOptions` are used consistently across the plan.
