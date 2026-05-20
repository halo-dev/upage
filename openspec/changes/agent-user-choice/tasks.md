## 1. Type Definitions

- [x] 1.1 Add `UserChoiceRequest` and `UserChoiceResponse` types to `app/types/page-builder-tools.ts`
- [x] 1.2 Add `data-user-choice` type to `UPageDataParts` in `app/types/message-protocol.ts`
- [x] 1.3 Add `choiceData` field to message metadata types in `app/types/message-protocol.ts`
- [x] 1.4 Add `requestUserChoice` tool type to `PageBuilderCoreUITools` in `app/types/page-builder-tools.ts`

## 2. Backend Agent Tool

- [x] 2.1 Create `requestUserChoice` tool in `app/.server/llm/agents/page-builder-tools.ts`
- [x] 2.2 Register `requestUserChoice` in `getPageBuilderActiveTools` in `app/.server/llm/agents/page-builder.ts`
- [x] 2.3 Update agent system prompt in `page-builder.ts` to include `requestUserChoice` usage rules
- [x] 2.4 Implement tool execute logic: write `data-user-choice` part, return pending result
- [x] 2.5 Add guardrail to prevent multiple choice requests per turn

## 3. Backend Message Flow Integration

- [x] 3.1 Update `createChatStreamEventWriters` in `app/routes/api/chat/runtime.ts` to handle `data-user-choice` events
- [x] 3.2 Update chat action in `app/routes/api/chat/chat.ts` to persist `choiceData` in message metadata
- [x] 3.3 Handle user choice response message: extract choice result from metadata and inject into agent context
- [x] 3.4 Update `sanitizeMessagesForAgent` to include choice data in message context

## 4. Frontend UI Component

- [x] 4.1 Create `UserChoiceCard` component in `app/.client/components/chat/UserChoiceCard.tsx`
- [x] 4.2 Implement single selection mode (radio buttons) in `UserChoiceCard`
- [x] 4.3 Implement multiple selection mode (checkboxes) in `UserChoiceCard`
- [x] 4.4 Implement custom text input support in `UserChoiceCard`
- [x] 4.5 Add submit/confirm button and Enter key handler
- [x] 4.6 Add completed state rendering (read-only display of selected options)
- [x] 4.7 Add component styles using existing CSS utility classes

## 5. Frontend Message Rendering

- [x] 5.1 Update `AssistantMessage.tsx` to detect `data-user-choice` parts and render `UserChoiceCard`
- [x] 5.2 Update `assistant-message-structure.ts` to include `data-user-choice` in structured part handling
- [x] 5.3 Update `useChatMessage.ts` to handle choice response submission as user message

## 6. Frontend State Management

- [x] 6.1 Add `isAwaitingUserChoice` state to `app/.client/stores/ai-state.ts`
- [x] 6.2 Add `pendingUserChoice` state to track current pending choice request
- [x] 6.3 Update `ChatTextarea` to disable input when awaiting user choice
- [x] 6.4 Add visual indicator (e.g., placeholder text change) when input is disabled

## 7. Persistence

- [x] 7.1 Update `saveChatMessages` in `app/.server/service/message.ts` to handle `choiceData` in metadata
- [x] 7.2 Update `getHistoryChatMessages` to restore `choiceData` from metadata
- [x] 7.3 Ensure `choiceData` is preserved during chat rewind and fork operations

## 8. Testing and Polish

- [x] 8.1 Add unit tests for `requestUserChoice` tool execute logic
- [x] 8.2 Add unit tests for `UserChoiceCard` component interactions
- [x] 8.3 Verify single choice flow end-to-end
- [x] 8.4 Verify multiple choice flow end-to-end
- [x] 8.5 Verify custom input flow end-to-end
- [x] 8.6 Run `pnpm check` and `pnpm typecheck` to ensure code quality
- [x] 8.7 Update CLAUDE.md or project docs if needed
