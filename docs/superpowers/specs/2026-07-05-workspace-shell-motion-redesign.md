# Workspace Shell Motion Redesign

## Objective

Refactor the CLM web workspace shell into a faster, cleaner chat-first interface built around:

- a persistent left icon rail
- an expanding contextual side panel
- fast `slide + fade` page transitions
- a simpler, more intentional chat experience

The redesign should take interaction cues from the reference image the user provided without copying its visual treatment, spacing, or exact component structure.

## Scope

Included in this design:

- Replace the current static left sidebar with a slim icon rail
- Add an expanding side panel that opens beside the icon rail
- Keep chat as the default section
- Refine the chat landing and empty-thread experience
- Add fast, smooth section transitions using CSS-first motion
- Support desktop and mobile behavior for the side panel
- Preserve existing data sources and application APIs

Explicitly excluded from this design:

- New backend APIs
- New chat capabilities such as attachments or prompt execution
- Full provider settings editing
- Companion protocol changes
- Realtime animation orchestration libraries
- A full visual rebrand of the entire product

## Design Constraints

This redesign must respect the current project state:

- The unified workspace shell already exists in `apps/web/src/components/workspace-app-shell.tsx`
- Current sections remain: `chat`, `workspaces`, `models`, `companion`, `activity`, `settings`
- The backend contracts remain unchanged
- The user asked for a layout similar in interaction style to the provided image, but not copied
- Motion must feel fast and smooth, not heavy or theatrical
- The implementation should avoid unnecessary runtime dependencies

## Recommended Approach

The selected approach is a CSS-first workspace shell refactor with a persistent icon rail and a contextual expanding panel.

Why this approach:

- It matches the requested interaction model closely
- It keeps motion lightweight by relying on `transform` and `opacity`
- It avoids introducing animation libraries for a layout problem that CSS can solve well
- It works within the current app shell and existing data model
- It allows a sharper, more product-specific visual language than a direct reference clone

Alternatives considered and rejected:

1. Single collapsible sidebar
   - Easier to build, but less refined and less aligned with the requested reference pattern

2. Framer Motion-driven shell
   - More expressive, but unnecessary for the level of motion requested and adds runtime weight

3. Icon rail only with no expanding panel
   - Very compact, but weaker for discoverability and conversation navigation

## Architecture

The redesign stays frontend-only and is centered on the current workspace shell.

Primary shell structure:

- `icon rail`
  - always visible
  - contains primary section icons
  - owns active state and collapse/open interactions

- `context panel`
  - opens beside the rail
  - shows section-specific content or navigation
  - collapses independently of the main content area

- `main stage`
  - renders the active section
  - animates during section changes with short slide + fade motion

This keeps navigation stable while allowing the content surface to change in place.

## Layout Design

### Desktop layout

The desktop shell has three conceptual layers:

1. a narrow icon rail pinned to the left edge
2. an expandable side panel immediately to its right
3. the main content area filling the remaining width

Desktop behavior:

- the icon rail is always present
- the contextual panel opens when a section icon is activated
- the panel can be collapsed by clicking the active icon again
- the main content shifts slightly when the panel opens to preserve spatial continuity

### Mobile layout

On smaller screens:

- the icon rail remains visible in compact form
- the contextual panel becomes an overlay instead of permanently consuming layout width
- opening the panel shows a dim backdrop
- the backdrop click closes the panel

This avoids reducing usable chat width too aggressively on smaller devices.

## Interaction Model

### Navigation behavior

- Clicking an icon in the rail activates its section
- Clicking an inactive icon both changes the section and opens the contextual panel
- Clicking the currently active icon toggles the panel closed
- The selected icon receives a stronger visual state than hover-only items

### Panel behavior by section

`chat`

- show conversation search
- show pinned and recent threads
- keep the `New` action near the top

`workspaces`

- show workspace-oriented navigation and summary content

`models`

- show provider readiness and model context

`companion`

- show pairing status and machine context

`activity`

- show conversation and run history entry points

`settings`

- show grouped configuration categories

### Main content transitions

Section changes should use:

- short duration: approximately `160ms` to `220ms`
- `opacity` transition for fade
- `translateX` transition for slight horizontal movement
- no bounce, spring, or exaggerated overshoot

Motion intent:

- side panel feels responsive and direct
- content shifts enough to communicate change
- transitions remain subtle enough for frequent daily use

## Chat UX Redesign

Chat remains the primary surface and should open by default.

### Chat shell behavior

- The conversation list moves into the expanding contextual panel
- The main thread surface becomes more focused and less box-heavy
- The chat header becomes smaller and more utility-driven
- The right-side context rail should be simplified into lighter inline status blocks or a compact supporting column

### Empty-state chat

When there is no active message history yet:

- show a stronger welcome heading
- present a small set of prompt starters
- anchor the composer clearly below the prompt suggestions
- maintain a clean visual hierarchy with generous spacing

The result should feel intentional and product-led, not like a placeholder.

### Active chat state

When a conversation is active:

- keep the composer anchored and stable
- avoid visual noise around the thread
- preserve quick access to switching conversations through the side panel

## Visual Direction

This redesign should feel original and developer-focused.

Visual principles:

- restrained dark palette
- crisp contrast
- thin borders instead of heavy card stacks
- dense but readable rail controls
- subtle active and hover states
- minimal decorative gradients
- tighter, more intentional spacing than the current shell

The provided reference is useful for:

- icon rail structure
- content centering
- conversational landing feel
- simple section transitions

The redesign should not reuse:

- exact composition
- exact control placement
- exact typography sizing
- exact card layout
- exact surface styling

## Performance Constraints

Motion must be fast and smooth.

Required implementation rules:

- prefer `transform` and `opacity` over animating expensive layout properties when possible
- keep durations short
- avoid unnecessary re-renders during section changes
- avoid heavy animation libraries
- support `prefers-reduced-motion`

Performance goal:

- section changes should feel immediate on common laptop hardware
- opening and closing the panel should not feel sticky or delayed

## Error Handling and Fallback States

The redesign must continue to handle the current runtime states:

- workspace boot loading state
- boot error state
- empty conversations list
- message loading state
- provider capacity blocked state
- pairing error state
- disconnected companion state

Motion and layout changes must not hide or delay these operational states.

## Accessibility

Required accessibility behavior:

- icon rail buttons must remain keyboard reachable
- collapsed or expanded panel state should remain understandable
- active navigation state must be visually clear
- reduced-motion users should receive a stable non-animated or minimally animated experience
- desktop and mobile interactions should not depend on hover alone

## Testing Strategy

Priority is build safety, interaction correctness, and visual smoothness.

### Code-level verification

- `pnpm --filter @clm/web typecheck`
- `pnpm --filter @clm/web build`

### Manual verification

- Chat loads by default
- Clicking each icon opens the correct section
- Clicking the active icon collapses the contextual panel
- Switching sections uses a short slide + fade transition
- Mobile-sized layout overlays the side panel instead of compressing everything
- Empty-state and active chat both remain usable
- Reduced-motion mode still feels coherent

## File Boundaries

Primary file to refactor:

- `apps/web/src/components/workspace-app-shell.tsx`

Likely supporting files to adjust:

- `apps/web/src/components/message-thread.tsx`
- `apps/web/src/components/message-composer.tsx`
- `apps/web/src/app/globals.css`

Optional helper extraction if the shell becomes too large:

- `apps/web/src/components/workspace-icon-rail.tsx`
- `apps/web/src/components/workspace-context-panel.tsx`
- `apps/web/src/components/chat-empty-state.tsx`

The implementation should prefer small focused helpers if the shell starts mixing too many responsibilities.

## Acceptance Criteria

This redesign is complete when all of the following are true:

- The workspace uses a persistent icon rail on the left
- A contextual side panel expands beside the rail
- Clicking the active icon collapses the side panel
- Chat is still the default landing section
- Section switches animate with a fast slide + fade transition
- The chat interface feels cleaner and more focused than the current version
- The UI is visibly inspired by the requested interaction model without copying the reference
- Mobile behavior remains usable
- Typecheck and production build both pass

## Implementation Notes

- Keep the motion simple, short, and hardware-friendly
- Do not introduce a new animation dependency unless blocked by a concrete limitation
- Preserve current API usage and state management
- If needed, reduce chrome in the right-side chat support content before removing useful context entirely
- Prefer a shell refactor over layering more UI on top of the current structure
