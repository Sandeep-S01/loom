# UI and UX Design

## 1. Design Goal

Create a simple, operational workspace that feels clear on mobile and trustworthy on desktop. The interface should make model complexity mostly disappear while making local-agent activity explicit.

## 2. Experience Principles

- Chat first on mobile.
- Clear mode separation on desktop.
- Low-friction navigation.
- Strong visibility into companion connection and active workspace.
- Minimal exposure to provider noise.

## 3. Information Architecture

### Mobile

Primary areas:

- `Chats`
- `Settings`
- `Provider Status`

Mobile excludes:

- Agent mode
- Project selection
- File-change views

### Desktop

Primary areas:

- `Dashboard`
- `Chat`
- `Agent`
- `Settings`

Secondary surfaces:

- Conversation sidebar
- Workspace selector
- Provider health panel
- Agent run details panel

## 4. Desktop Screen Structure

## 4.1 Dashboard

Purpose:

- Provide a control-center view of current state.

Sections:

- Recent conversations.
- Recent agent runs.
- Companion status card.
- Active workspace card.
- Provider health summary.

Primary actions:

- Start chat.
- Open agent mode.
- Reconnect companion.
- Change workspace.

## 4.2 Chat Screen

Layout:

- Left sidebar for conversation history.
- Main thread panel for messages.
- Top utility bar with conversation title and subtle provider state.
- Bottom composer with multiline input and send action.

Important behaviors:

- Streaming assistant responses.
- Lightweight system note on provider switch.
- Clear exhausted-capacity banner when no free models are available.

## 4.3 Agent Screen

Layout:

- Left sidebar for recent runs and workspace shortcuts.
- Main panel with run transcript and timeline.
- Right panel for changed files, commands, or logs.

Top bar:

- Companion status.
- Active workspace alias.
- Change workspace action.
- Stop run action.

Run timeline statuses:

- `Planning`
- `Inspecting Files`
- `Editing Files`
- `Running Commands`
- `Switching Model`
- `Completed`
- `Stopped`

## 5. Key User Flows

## 5.1 Mobile Chat Flow

1. Open app.
2. View conversation list.
3. Start or resume chat.
4. Send prompt.
5. Receive streamed response.

## 5.2 Desktop First-Time Agent Flow

1. Open app on desktop.
2. See that companion is disconnected.
3. Install or launch companion.
4. Pair companion.
5. Open agent mode.
6. Select project folder.
7. Submit objective.
8. Watch progress and review changed files.

## 5.3 Desktop Returning Agent Flow

1. Open app.
2. Companion reconnects.
3. Last workspace is shown.
4. Resume prior run or start a new one.

## 6. Visual System

Recommended direction:

- Neutral, productivity-oriented base palette.
- Strong contrast for readability.
- One accent color for primary action and connection state.
- Clear state colors for healthy, degraded, blocked, and danger.

Typography:

- Use a legible sans-serif for UI.
- Use monospaced typography for agent logs, file paths, and command output.

Spacing:

- Comfortable padding in chat.
- Tighter data density in agent logs and dashboard cards.

## 7. Interaction States

### Chat

- Empty state.
- Streaming state.
- Provider-switched note.
- Exhausted-capacity banner.
- Retry action where appropriate.

### Agent

- Companion disconnected state.
- No workspace selected state.
- Run in progress state.
- Run stopped state.
- Run blocked by capacity state.

## 8. Responsiveness

- Mobile gets only chat-centric navigation and settings.
- Tablet may still suppress agent mode unless companion behavior is explicitly supported.
- Desktop unlocks full dashboard and agent surfaces.

## 9. Accessibility

- Keyboard navigation for desktop.
- Focus-visible states.
- High-contrast text and status indicators.
- Screen-reader labels on connection, workspace, and stop controls.
- Streaming regions should announce meaningful status changes, not every token.

## 10. UX Risks

- Companion pairing can feel technical if not guided well.
- Too much provider detail can confuse the user.
- Too little agent transparency can reduce trust.

## 11. UX Recommendation

Optimize for clarity:

- Hide provider complexity by default.
- Show operational state only when it affects the user.
- Make the local execution boundary obvious at all times in agent mode.
