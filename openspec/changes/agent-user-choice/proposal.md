## Why

当前 Agent 在生成网页时，用户只能在初始阶段提供需求描述，后续所有决策（如页面布局、组件样式、配色方案等）完全由 Agent 自主决定，缺乏用户参与感。这种"黑盒式"生成导致输出结果可能与用户预期偏差较大，且用户无法在不重新描述需求的情况下微调方向。参考 Cursor 等 Agent 工具的交互模式，在关键决策节点引入用户选择机制，可以显著提升生成结果的满意度和可控性。

## What Changes

- **新增 Agent 工具 `requestUserChoice`**：Agent 可以在执行过程中主动调用此工具，向用户展示多个方案选项（如不同的页面布局、配色方案、组件风格等），支持单选、多选和自由输入模式。
- **新增数据流类型 `data-user-choice`**：服务端通过流式消息向客户端发送用户选择请求，包含选项列表、选择模式、提示文本等元数据。
- **新增 UI 组件 `UserChoiceCard`**：在聊天界面中渲染一个交互式选择卡片，支持单选（radio）、多选（checkbox）和带自定义输入的混合模式。用户做出选择并确认后，选择结果作为新的用户消息回传给 Agent。
- **新增消息状态管理**：前端需要管理"等待用户选择"的状态，在此期间暂停 Agent 执行流，禁用输入框。
- **新增数据库字段**：在 Message 模型中增加 `choiceData` 字段，用于持久化用户选择请求的内容和结果，支持历史记录回放和分叉。
- **Agent 系统提示更新**：在系统提示中增加关于 `requestUserChoice` 工具的使用规则，明确何时应该调用（如布局决策、风格选择、功能取舍等）。

## Capabilities

### New Capabilities

- `agent-user-choice`: Agent 主动请求用户做选择，支持单选、多选和自定义输入，用户选择后 Agent 根据结果继续执行
- `user-choice-ui`: 前端渲染用户选择卡片，提供直观的交互界面
- `user-choice-persistence`: 用户选择请求和结果的数据持久化，支持历史回播

### Modified Capabilities

- `agent-page-builder`: Agent 系统提示和执行规则需要更新，加入 `requestUserChoice` 工具的调用规则（非 spec 级别行为变更，仅为工具注册和提示词更新）

## Impact

- **后端**：`app/.server/llm/agents/page-builder.ts`（注册新工具）、`app/.server/llm/agents/page-builder-tools.ts`（新增 `requestUserChoice` 工具定义）、`app/routes/api/chat/chat.ts`（处理用户选择结果消息）、Prisma schema（新增字段）
- **前端**：`app/.client/components/chat/AssistantMessage.tsx`（渲染选择卡片）、`app/.client/hooks/useChatMessage.ts`（管理等待选择状态）、新增 `UserChoiceCard` 组件
- **类型系统**：`app/types/message-protocol.ts`（新增 data-user-choice 类型）、`app/types/page-builder-tools.ts`（新增 requestUserChoice 工具类型）
- **数据库**：Message 表新增 `choiceData` JSON 字段（存储用户选择请求元数据和结果）
