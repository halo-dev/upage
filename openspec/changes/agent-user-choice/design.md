## Context

UPage 使用 Vercel AI SDK 的 `Experimental_Agent`（ToolLoopAgent）作为页面生成 Agent 的运行时。Agent 通过工具调用（tool calling）与用户交互，当前已注册的工具包括 `historySummary`、`selectRelevantPages`、`buildPageOutlineSnapshot`、`buildPageDetailedSnapshot`、`ensureDesignSystem`、`announceUpageBlock`、`upage`、`finishRun` 等。所有工具调用都是"即发即走"的——Agent 调用工具后立即获得结果并继续执行，用户无法干预中间决策过程。

用户希望在 Agent 执行的关键节点引入选择机制：Agent 生成多个备选方案，用户通过 UI 选择（或输入自定义内容）后，Agent 根据选择结果继续后续工作。这类似于 Cursor Composer 中的"Ask / Choose"模式。

当前架构约束：
- 消息流基于 `createUIMessageStream`，服务端通过流式数据推送消息 parts 到前端
- 前端使用 `@ai-sdk/react` 的 `useChat` hook 接收消息，消息格式为 `UIMessage<metadata, dataParts, tools>`
- Agent 工具调用是同步的——`execute` 函数必须返回结果，无法暂停等待异步用户输入
- 数据库使用 Prisma + SQLite，Message 模型已支持 JSON metadata 字段

## Goals / Non-Goals

**Goals:**
- Agent 能够在执行过程中主动发起用户选择请求
- 前端展示美观的交互式选择卡片，支持单选、多选和自定义输入
- 用户选择后，Agent 能够接收到选择结果并继续执行
- 用户选择请求和结果能够被持久化，支持历史回放和聊天分叉
- 整个流程对现有 Agent 执行流程影响最小，保持向后兼容

**Non-Goals:**
- 不支持 Agent 在等待用户选择期间保持内存状态（选择机制通过消息上下文实现）
- 不实现复杂的投票或多轮协商机制（MVP 仅支持一轮选择）
- 不涉及对 AI SDK Agent 运行时本身的修改（通过消息重组实现暂停/恢复）
- 不修改现有的页面生成协议（upage 协议保持不变）

## Decisions

### Decision 1: 通过消息上下文 + 工具调用实现选择机制，而非修改 Agent 运行时

**选择**：不修改 AI SDK 的 `ToolLoopAgent` 内部逻辑，而是利用现有的消息流机制：Agent 调用 `requestUserChoice` 工具后，工具返回一个特殊的占位结果（`{ status: 'pending', choiceId }`），服务端将此结果写入 assistant message。然后服务端主动中断 Agent 流（通过不继续调用 `agent.run` 或类似方式），前端检测到 pending 状态后渲染选择卡片。用户选择后，前端将选择结果作为一条新的 user message 发送，服务端重新启动 Agent 执行（或继续现有流），Agent 从消息上下文中读取之前的选择结果。

**理由**：
- AI SDK 的 `ToolLoopAgent` 是第三方库，修改成本高且容易引入兼容性问题
- 消息上下文是 Agent 的天然状态载体，Agent 可以从历史消息中读取之前的工具调用结果
- 与现有架构一致，复用 `useChat` 的消息发送/接收机制

**替代方案**：修改 Agent 运行时支持 async pause/resume。被否决，因为需要 fork AI SDK 源码，维护成本高。

### Decision 2: 选择结果作为独立 user message 发送

**选择**：用户在前端做出选择后，将选择结果包装为一条新的 `user` 角色消息发送给服务端，消息内容包含选择结果的文本描述。

**理由**：
- 与现有的聊天消息模型完全兼容
- 选择结果自然地进入 Agent 的消息上下文，无需额外的状态传递机制
- 支持历史回放、rewind、fork 等现有功能
- 消息内容可以包含选择结果的文本描述，便于人类阅读历史记录

**替代方案**：通过单独的 API endpoint 提交选择结果。被否决，因为这会引入额外的状态同步复杂性，且与现有的消息流模型不一致。

### Decision 3: 使用 data part 传输选择请求，而非 text/tool part

**选择**：Agent 调用 `requestUserChoice` 工具时，工具内部通过 writer 写入一个 `data-user-choice` 类型的 data part，而不是通过 text delta 或 tool result 传输。

**理由**：
- data part 是 UPage 消息协议中已有的扩展机制（已有 `data-preparation-stage`、`data-design-md` 等）
- data part 可以被前端 `onData` 回调直接捕获和处理，不依赖 message parts 的解析
- 选择请求是纯元数据，不需要流式传输，data part 适合这种一次性推送的场景
- 保持与现有 preparation stage 等数据推送机制的一致性

**替代方案**：通过 tool result 的 output 字段传输。被否决，因为 tool result 需要等待 execute 完成，且前端解析 tool parts 的复杂度更高。

### Decision 4: 前端使用 aiState store 管理"等待用户选择"状态

**选择**：在 `app/.client/stores/ai-state.ts` 中新增 `isAwaitingUserChoice` 状态，当检测到 pending 的用户选择请求时设为 true，禁用输入框并显示选择卡片。

**理由**：
- `ai-state` store 已经是前端全局状态管理中心，集中管理聊天相关状态
- 与现有的 `isStreaming`、`requestPhase` 等状态管理模式一致
- 选择卡片可以在 `AssistantMessage` 组件中根据消息 parts 渲染，状态管理独立进行

### Decision 5: 在 Message metadata 中持久化选择数据

**选择**：利用现有的 `metadata` JSON 字段存储选择请求和结果，新增 `choiceData` 字段结构：`{ request: UserChoiceRequest, response?: UserChoiceResponse }`。

**理由**：
- 无需数据库 schema 迁移（metadata 已经是 JSON 类型）
- 选择数据与消息强关联，放在 metadata 中语义正确
- 支持通过现有的消息查询和保存机制自动持久化

**替代方案**：新增数据库列。被否决，因为 metadata JSON 字段足够灵活，避免不必要的 schema 变更。

## Risks / Trade-offs

- **[Risk] Agent 可能不遵循选择结果**：Agent 从消息上下文中读取选择结果，但 LLM 可能"遗忘"或忽略之前的选择。→ **Mitigation**：在 `prepareStep` 中，如果检测到历史消息中有 pending 的用户选择，在 system prompt 中明确提示 Agent 必须遵循用户的选择结果。
- **[Risk] 选择请求出现在不合适的时机**：Agent 可能在已经有部分页面变更后发起选择请求，导致用户困惑。→ **Mitigation**：在工具描述和 system prompt 中明确规范选择工具的调用时机（如：在 announceUpageBlock/upage 之前调用，或在开始新任务时调用）。
- **[Risk] 用户长时间不做选择**：会话处于 pending 状态，可能占用资源或导致超时。→ **Mitigation**：前端不设置超时（用户体验优先），但服务端 Agent 流已经结束，不占用资源；用户可以稍后回来继续选择。
- **[Risk] 多选 + 自定义输入的组合复杂性**：N 选多且允许自定义输入时，UI 交互逻辑较复杂。→ **Mitigation**：MVP 先实现单选 + 自定义输入，多选模式后续迭代。
- **[Trade-off] 选择流程增加交互步骤**：每次选择需要用户主动操作，可能降低"一键生成"的效率。→ 这是预期内的权衡，目标用户更重视结果可控性而非速度。

## Migration Plan

无需数据迁移。新增功能完全向后兼容：
1. 没有历史选择数据的消息正常渲染
2. Agent 系统提示中新增工具描述，但现有工具集不变
3. 前端检测到 `data-user-choice` 时渲染选择卡片，否则保持原有行为

部署步骤：
1. 部署代码变更
2. 无需数据库迁移（metadata JSON 字段已有）
3. 无需配置变更

## Open Questions

1. 是否需要限制 Agent 每轮最多发起一次选择请求？（建议：是，防止选择轰炸）
2. 用户选择后是否需要在 UI 中展示"已选择"的确认状态？（建议：是，在选择卡片上显示已选状态）
3. 是否支持 Agent 根据选择结果自动调整后续 tool 调用策略？（如用户选择"简约风格"后自动跳过 ensureDesignSystem）
