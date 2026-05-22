# Design: Fix Save/Load Persistence Chain

## Data Flow Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          PERSISTENCE CHAIN                              │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│   ┌─────────────┐     ┌─────────────┐     ┌─────────────────────────┐  │
│   │   AI Agent  │────▶│ onDraftCkpt │────▶│ replaceProjectSnapshot  │  │
│   │  (streaming)│     │             │     │ (userMsgId, pagesV2)    │  │
│   └─────────────┘     └─────────────┘     └─────────────────────────┘  │
│          │                                    │                         │
│          │                                    ▼                         │
│          │                           ┌─────────────────┐               │
│          │                           │   Database      │               │
│          │                           │   (PageV2/      │               │
│          │                           │    Section)     │               │
│          │                           └─────────────────┘               │
│          │                                    ▲                         │
│          ▼                                    │                         │
│   ┌─────────────┐     ┌─────────────┐     ┌─────────────────────────┐  │
│   │   useChat   │────▶│   onFinish  │────▶│    saveChatMessages     │  │
│   │   (frontend)│     │             │     │ (assistantMsg, parts)   │  │
│   └─────────────┘     └─────────────┘     └─────────────────────────┘  │
│                                                                         │
│   ┌─────────────┐     ┌─────────────┐     ┌─────────────────────────┐  │
│   │ ActionRunner│────▶│  Editor DOM │────▶│ MutationObserver        │  │
│   │             │     │             │     │ → editorDocuments       │  │
│   └─────────────┘     └─────────────┘     └─────────────────────────┘  │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

## Key Insight: Dual State Problem

The system maintains **two parallel representations** of page content:

1. **`pagesStore.pages`** - The "saved" snapshot, updated only via `savePage()`
2. **`editorStore.editorDocuments`** - The "live" DOM representation, updated in real-time

`collectProjectData` reads from #1, but #2 is the actual truth during streaming.

## Design Decisions

### Decision 1: `collectProjectData` reads from `editorDocuments`

**Rationale**: `editorDocuments` is updated synchronously via `MutationObserver` when the DOM changes. It reflects the actual rendered state. `pages` map is only updated on explicit save operations.

**Implementation**:
```typescript
function collectProjectData(options?: { strict?: boolean }) {
  const editorDocuments = webBuilderStore.editorStore.editorDocuments.get();
  
  const projectPages = Object.values(webBuilderStore.pagesStore.pages.get())
    .filter(hasValidPageName)
    .map((page) => {
      const editorDoc = editorDocuments[page.name];
      return {
        ...page,
        content: editorDoc?.content ?? page.content ?? '',
      };
    });
  // ...
}
```

**Risk**: `editorDocuments` may contain unsaved user edits. This is acceptable because:
- `saveProject` is called when AI completes (no concurrent user editing)
- `saveDraftProject` saves draft state; preserving user edits is actually desirable

### Decision 2: Abort path still saves assistant message

**Rationale**: The assistant message contains structured `parts` (tool-upage events) that the frontend uses to reconstruct state. Without the message, frontend falls back to `pagesV2` reconstruction which has different semantics.

**Implementation**: In `chat.ts:onFinish`, remove the early return for `isAborted` and let `saveChatMessages` run with `persistedMessages`.

**Risk**: Saves an incomplete assistant message. Mitigation: the message metadata includes `runStatus: 'aborted'` so the frontend knows it's incomplete.

### Decision 3: IndexedDB validation gate

**Rationale**: IndexedDB is a cache, not source of truth. Invalid cache entries should be discarded.

**Implementation**:
```typescript
const projectData = await loadEditorProject();
if (projectData?.pages?.some(p => p.content?.trim())) {
  return projectData;
}
return await getProjectByMessageId();
```

### Decision 4: `saveAllPages` pre-sync

**Rationale**: Ensures `pages` map is up-to-date before `collectProjectData` reads it (defense-in-depth).

**Implementation**: Before iterating `unsavedDocuments`, iterate all `editorDocuments` and call `savePage` for any page whose content differs from `pages` map.

## State Diagram: Save Paths

```
                    ┌─────────────┐
                    │  Streaming  │
                    │   Active    │
                    └──────┬──────┘
                           │
              ┌────────────┼────────────┐
              │            │            │
              ▼            ▼            ▼
         ┌────────┐  ┌────────┐  ┌────────┐
         │ Abort  │  │ Error  │  │Finish  │
         └───┬────┘  └───┬────┘  └───┬────┘
             │           │           │
             ▼           ▼           ▼
    ┌────────────────┐  │  ┌────────────────┐
    │ saveDraftProject│  │  │  saveProject   │
    │ (strict: false)│  │  │  (strict: true)│
    └───────┬────────┘  │  └───────┬────────┘
            │           │          │
            ▼           ▼          ▼
    ┌───────────────────────────────┐
    │   collectProjectData          │
    │   - reads editorDocuments     │
    │   - no empty content          │
    └───────────────────────────────┘
```

## Testing Strategy

1. **Unit test**: `collectProjectData` with empty `pages.content` but non-empty `editorDocuments`
2. **Integration test**: Interrupt streaming mid-generation, verify refresh shows partial state
3. **Integration test**: Complete generation, modify editor, refresh, verify latest state
4. **Edge case**: Empty IndexedDB cache falls back to server data
