# Tasks: Fix Save/Load Persistence Chain

## Task 1: Fix `collectProjectData` to read from `editorDocuments`

- [x] **Done**

**File**: `app/.client/hooks/useProject.ts`

**Current behavior**: `collectProjectData` reads `pages` from `pagesStore.pages.get()`. During streaming, `pages.content` may be stale/empty because `pages` is only updated on explicit save.

**Required change**: Pull latest content from `editorStore.editorDocuments` as the authoritative source for page content.

```typescript
function collectProjectData(options?: { strict?: boolean }) {
  const strict = options?.strict ?? false;
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
  
  const projectSections = Object.values(webBuilderStore.pagesStore.sections.get())
    .filter(hasValidSectionPageName)
    .map((section) => ({
      ...section,
      actionId: section.id,
    }));
  // ... rest of validation
}
```

**Acceptance**: `collectProjectData` returns pages with non-empty content when editor DOM has content, even if `pagesStore.pages` hasn't been explicitly saved yet.

---

## Task 2: Save assistant message on abort

- [x] **Done**

**File**: `app/routes/api/chat/chat.ts`

**Current behavior**: `onFinish` has an early return when `isAborted` is true, skipping `saveChatMessages` entirely.

**Required change**: Remove the early return. The assistant message (with its parts and metadata) should be persisted regardless of abort state. The metadata already includes `runStatus: 'aborted'` which signals incompleteness to the frontend.

```typescript
// Remove this block:
// if (isAborted) {
//   logger.info(...);
//   return;
// }

// Keep the transaction, it handles both aborted and normal cases
await prisma.$transaction(async (tx) => {
  if (rewindTo) {
    await updateDiscardedMessage(chatId, rewindTo, tx);
  }
  await saveChatMessages(chatId, persistedMessages, tx);
});
```

**Acceptance**: After interrupting AI generation and refreshing, the assistant message appears in chat history with its tool-upage parts intact.

---

## Task 3: Validate IndexedDB cache in `getLoadProject`

- [x] **Done**

**File**: `app/.client/hooks/useChatHistory.ts`

**Current behavior**: `getLoadProject` unconditionally returns IndexedDB data if it exists, even if the data is incomplete (empty content).

**Required change**: Add validation to check if IndexedDB data contains meaningful content before using it.

```typescript
const getLoadProject = useCallback(async (): Promise<ProjectData | undefined> => {
  // ... existing code ...

  const projectData = await loadEditorProject();
  // Only use IndexedDB cache if it contains pages with actual content
  if (projectData?.pages?.some((page) => page.content?.trim())) {
    return {
      messageId: projectData.messageId,
      pages: projectData.pages,
      sections: projectData.sections,
    };
  }

  // Fall back to server-loaded data
  return await getProjectByMessageId();
}, [...]);
```

**Acceptance**: When IndexedDB contains empty draft data, refresh loads from server-loaded `pagesV2` instead.

---

## Task 4: Pre-sync `editorDocuments` in `saveAllPages`

- [x] **Done**

**File**: `app/.client/stores/web-builder.ts`

**Current behavior**: `saveAllPages` only iterates `unsavedDocuments`, missing pages whose content is in `editorDocuments` but not yet flagged as unsaved.

**Required change**: Before iterating `unsavedDocuments`, sync all pages where `editorDocuments` content differs from `pages` map.

```typescript
async saveAllPages(changeSource: ChangeSource) {
  await this.flushIncomingChanges();

  // Pre-sync: ensure pages map reflects latest editorDocuments
  const documents = this.editorStore.editorDocuments.get();
  for (const [pageName, doc] of Object.entries(documents)) {
    const page = this.pagesStore.getPage(pageName);
    if (page && doc.content !== page.content) {
      await this.pagesStore.savePage(pageName, doc.content, changeSource);
    }
  }

  for (const pageName of this.editorStore.unsavedDocuments.get()) {
    await this.saveDocument(pageName, changeSource);
  }
}
```

**Acceptance**: After AI modifies DOM, calling `saveAllPages` captures the latest content even if `unsavedDocuments` hasn't been updated yet.

---

## Task 5: Verify fix with end-to-end test

- [x] **Done** — `pnpm check` passed (fixed 2 files), `pnpm typecheck` passed with no errors

**Scenario 1: Interrupt mid-generation**
1. Start new chat, send message
2. Wait for AI to generate at least one section
3. Click abort button
4. Refresh page
5. **Expected**: Editor shows the partially generated section(s)

**Scenario 2: Complete then refresh**
1. Start new chat, send message
2. Wait for AI to complete
3. Refresh page
4. **Expected**: Editor shows the completed state (not reverted to empty)

**Scenario 3: Multiple turns**
1. Complete first AI generation
2. Send follow-up message
3. Wait for AI to modify existing page
4. Refresh page
5. **Expected**: Editor shows the latest modifications (not the first generation)

---

## Task 6: Code review and cleanup

- [x] **Done**
  - `pnpm check` — passed, auto-fixed 2 formatting issues
  - `pnpm typecheck` — passed with no errors
  - No unintended changes to non-abort flow (transaction structure preserved)
