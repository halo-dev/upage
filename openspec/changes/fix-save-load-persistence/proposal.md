# Fix Save/Load Persistence Chain

## Problem Statement

The AI page builder has critical data loss bugs in its save/load persistence chain. Three specific symptoms:

1. **Save failures on interruption**: When AI generation is interrupted (abnormally or by user), chat messages survive but editor pages are lost.
2. **No editor data after refresh**: After refresh, editor shows no data even if generation was partially complete.
3. **Refresh reverts to previous state**: After AI completes and modifies editor, refresh reverts to previous saved state (overwritten).

## Root Cause Analysis

After deep investigation of the full persistence chain (DB → Loader → useChatMessage → useMessageParser → PageChangeCoordinator → ActionRunner → EditorBridge → PageRender → MutationObserver → saveProject/saveDraftProject → IndexedDB/Server → getLoadProject → setPages), three root causes were identified:

### Root Cause 1: Assistant message not saved on abort

In `app/routes/api/chat/chat.ts:395-398`, when `isAborted` is true, `onFinish` directly returns without calling `saveChatMessages`. This means the assistant message (containing `tool-upage` parts in its `parts` array) is never persisted to the database.

While `onDraftCheckpoint` does save pagesV2/sections under the **user message ID**, the assistant message itself is lost. Frontend reconstruction depends on assistant message `parts`.

### Root Cause 2: `pagesStore.pages` out of sync with `editorDocuments`

`pagesStore.pages` is the source of truth for `collectProjectData` (used by both `saveProject` and `saveDraftProject`). However, `pages.content` is only updated when `savePage` is called, which only happens for pages in `unsavedDocuments`.

During streaming generation:
- AI modifies DOM via `ActionRunner` → `EditorBridge` → iframe
- `MutationObserver` detects changes asynchronously
- `onUpdate` → `updateDocumentContent` → `unsavedDocuments` update is delayed
- If `saveDraftProject` runs before this async chain completes, `pages.content` is still empty

Worse, `getLoadProject` prioritizes IndexedDB over server-loaded data. If IndexedDB contains empty-content draft data, it shadows the complete server data.

### Root Cause 3: `saveProject` strict check fails on empty content

`saveProject` uses `collectProjectData({ strict: true })` which validates:
```typescript
if (actionIds.length > 0 && !content) return undefined; // fails!
```

When the race condition triggers and `pages.content` is empty, `saveProject` silently fails. The project is not saved under the **assistant message ID**. On next refresh, `getLatestProjectMessage` finds no pagesV2 on the latest assistant message, falls back to the previous assistant message → user sees stale state.

## Proposed Solution

### Fix 1: Save assistant message even on abort

In `chat.ts`, persist the assistant message with its parts/metadata even when aborted. The pagesV2 data is already saved via `onDraftCheckpoint`; we just need the message record itself.

### Fix 2: Sync `editorDocuments` content into `collectProjectData`

In `useProject.ts`, modify `collectProjectData` to pull the latest content from `editorStore.editorDocuments` rather than relying solely on `pagesStore.pages`. `editorDocuments` is updated in real-time via `MutationObserver` and reflects the actual DOM state.

### Fix 3: Validate IndexedDB cache before using

In `useChatHistory.ts`, add validation to `getLoadProject`: only use IndexedDB data if it contains pages with actual content. Otherwise fall back to server-loaded `pagesV2`.

### Fix 4: Pre-sync `editorDocuments` in `saveAllPages`

In `web-builder.ts`, before iterating `unsavedDocuments`, explicitly sync any `editorDocuments` content that differs from `pages` map.

## Scope

### In Scope
- `app/routes/api/chat/chat.ts` - abort handling
- `app/.client/hooks/useProject.ts` - `collectProjectData`
- `app/.client/hooks/useChatHistory.ts` - `getLoadProject` validation
- `app/.client/stores/web-builder.ts` - `saveAllPages` sync

### Out of Scope
- Database schema changes
- Editor DOM manipulation logic
- ActionRunner or PageChangeCoordinator logic
- Rewind functionality behavior

## Acceptance Criteria

1. Interrupting AI generation mid-stream, then refreshing, should show the partially generated editor state
2. After AI completes and modifies editor, refreshing should show the latest state (not revert)
3. `saveProject` should not silently fail due to empty content
4. IndexedDB draft cache should not shadow valid server data
