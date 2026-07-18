# Chat Composer Controls Design

## Goal

Add working, professional composer controls for chat:
- a paperclip button for local attachment selection
- a gear button for local composer settings
- a new model picker button for manual model selection

This pass is intentionally scoped to frontend behavior only for attachments and model override selection. The backend chat contract remains unchanged.

## Scope

### In scope

- Replace the current decorative paperclip and gear buttons with real interactions.
- Add a third toolbar control for model selection.
- Show selected attachments as removable chips in the composer.
- Persist composer settings locally.
- Persist or retain the selected model in client state for the active UI session.
- Keep the interaction quality aligned with the rest of the workspace shell.

### Out of scope

- File upload or attachment delivery to backend chat endpoints.
- Backend-enforced model override routing.
- Per-conversation saved model preferences in the database.
- Provider capability filtering beyond what is already available in frontend-accessible data.

## Product Behavior

### Paperclip button

The paperclip button opens a hidden file input and lets the user select one or more local files. Selected files appear above the composer toolbar as compact chips with:

- file name
- lightweight metadata such as size
- remove action

The composer keeps attachments in local component state only. They are not uploaded or sent with the message payload in this pass.

Duplicate files are ignored using a simple file identity key composed from name, size, and lastModified.

If the user sends a message while attachments are present, the attachments remain visible in the composer until the user removes them or clears the draft. This avoids implying a completed upload.

### Gear button

The gear button opens a compact composer settings popover. This popover is local to the chat composer and includes small, immediately useful settings:

- `Enter to send`
- `Show selected model badge`

These settings are stored in local storage so they survive refreshes.

### Model picker button

The new model button opens a small popover list of available models. The initial source should be frontend-available model options derived from existing seeded/provider-facing application state, with a conservative fallback static list if the current UI layer does not already expose a model list cleanly.

When the user selects a model:

- the composer shows the selected model in a restrained badge or button label
- the selection is stored locally
- the next message is sent normally through the existing backend API without a model override field

This means the model picker is a real control with stable UI state, but backend routing behavior is unchanged in this pass.

## UX Design

### Visual design

The controls should look native to the current dark workspace shell:

- icon-first toolbar buttons
- quiet hover/focus treatment
- compact rounded menus
- no oversized labels
- no card-inside-card styling

The model button should sit with the existing toolbar controls and read as a first-class control, not as an afterthought. If space is tight, it should collapse to an icon plus abbreviated label while preserving clean alignment.

### Interaction quality

- Click outside closes open popovers.
- `Escape` closes the currently open popover.
- Keyboard focus order remains logical.
- Active state is visually distinct.
- Disabled states are explicit.

Only one popover should be open at a time.

### Composer layout

Attachment chips should appear between the textarea and the toolbar, or immediately above the composer footer controls, without shifting the main message thread unexpectedly. The layout should remain stable across empty, one-line, and multi-line drafts.

## Architecture

## Frontend composition

The existing `MessageComposer` currently owns draft editing behavior and toolbar rendering. The new controls should remain centered there, but the logic should be split into small helpers/components if needed:

- attachment state and chip rendering
- settings popover
- model picker popover

Avoid turning `MessageComposer` into a monolith. If extracting subcomponents reduces complexity, prefer local component files colocated under `apps/web/src/components/`.

## State ownership

### Local composer state

Keep these in the composer or chat shell layer:

- selected attachments
- popover open/close state
- selected model
- local composer settings

### Message send integration

The send callback contract may be widened on the frontend to carry local metadata if that simplifies future backend evolution, but the current backend request body must remain compatible with the existing API.

If widening the frontend callback now adds noise without current value, keep `onSend(text)` unchanged and treat model/attachment state as UI-only.

## Error handling

- File picker cancellation is a no-op.
- Invalid or duplicate file selections should not create noisy errors.
- Clipboard/model/settings failures should degrade quietly with local inline feedback where useful.
- Local storage read failures should fall back to sane defaults.

## Testing

### Frontend tests

Add focused tests for:

- attachment selection state behavior
- duplicate attachment suppression
- settings persistence helpers if extracted
- model selection helper behavior if extracted

Because the current web test setup is lightweight, prefer testing pure helpers and minimally structured component output rather than building a heavy browser harness unless the repo already supports it.

### Verification

- web typecheck
- web build
- targeted helper tests
- manual browser verification of:
  - selecting/removing attachments
  - opening/closing settings menu
  - selecting a model
  - sending a message with controls populated

## Trade-offs

This design deliberately avoids fake backend support. The paperclip and model picker become real, usable UI controls now, but they do not pretend to upload files or force provider routing until the server contract exists. That keeps the behavior honest and reduces regression risk in the active chat flow.
