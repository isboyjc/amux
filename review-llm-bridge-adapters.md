# `packages/llm-bridge` 与 `packages/adapter-*` 系统性审查

> 审查维度：架构设计、性能、稳定性、可维护性  
> 约束：不建议大规模重构，不引入不必要依赖  
> 结论基于当前实现代码，不推断未落地能力。

## 风险分级说明

- **高**：容易导致错误结果、数据错配、协议不兼容，且在线上高频触发。
- **中**：在特定条件下触发，影响可观测性/鲁棒性/行为一致性。
- **低**：主要影响长期维护成本、调试效率或边界一致性。

---

## 1) `chatRaw` 与 `chat` 语义不一致（能力校验/Hook 缺失）

- **风险等级**：中
- **问题点（架构 + 稳定性）**：`chat` 路径会做能力校验并触发 hooks，`chatRaw` 不会，导致两条“主调用路径”行为不一致。
- **为什么**：调用方如果切到 `chatRaw`，将失去前置兼容性检查与观测点（`onRequest/onResponse/onError`），容易出现“同请求在不同入口行为不同”的排障成本。
- **建议（小改动）**：
  - 在 `chatRaw` 中复用 `validateCapabilities`。
  - 增加可选参数控制是否触发 hooks（默认与 `chat` 对齐，允许关闭）。
- **如何验证**：
  1. 增加单测：构造不支持 tools 的 outbound adapter，分别调用 `chat`/`chatRaw`，两者都应在出网前报错。
  2. 增加单测：为 `chatRaw` 注入 hooks，验证 `onRequest/onResponse/onError` 触发次数。
- **代码位置**：`packages/llm-bridge/src/bridge/bridge.ts:154`，`packages/llm-bridge/src/bridge/bridge.ts:217`

## 2) `HTTPClient` 在传入外部 `signal` 时超时控制可能失效

- **风险等级**：中
- **问题点（稳定性）**：内部创建了超时 `AbortController`，但 `fetch` 优先使用 `options.signal`，会绕过内部超时信号。
- **为什么**：上层若传了 signal（常见于链路取消），实际 timeout 可能不生效，表现为“偶发长时间挂起”。
- **建议（小改动）**：
  - 将外部 signal 与内部 timeout signal 合并（如 `AbortSignal.any([...])`，或手写桥接）。
  - 保持重试策略不变，不引入新依赖。
- **如何验证**：
  1. 模拟一个永不返回的 endpoint。
  2. 分别在“传 signal / 不传 signal”场景验证都按 timeout 抛出 `TimeoutError`。
- **代码位置**：`packages/llm-bridge/src/bridge/http-client.ts:62`，`packages/llm-bridge/src/bridge/http-client.ts:76`，`packages/llm-bridge/src/bridge/http-client.ts:165`，`packages/llm-bridge/src/bridge/http-client.ts:182`

## 3) SSE 行解析过于严格且异常静默吞掉

- **风险等级**：中
- **问题点（稳定性 + 可观测性）**：仅处理 `data: `（带空格），且 JSON 解析失败直接 `continue`，无最小诊断信息。
- **为什么**：不同 SSE 实现可能发 `data:`（无空格）或混合字段；静默吞掉会让“流丢片段”难以定位。
- **建议（小改动）**：
  - 兼容 `data:` 与 `data: ` 两种前缀。
  - 对连续解析失败计数并通过 hook/可选 debug 日志暴露（默认低噪声）。
- **如何验证**：
  1. 构造混合 `data:`/`data: ` 的流，确保都可解析。
  2. 注入非法 JSON chunk，验证至少有失败计数或 debug 事件可观测。
- **代码位置**：`packages/llm-bridge/src/bridge/bridge.ts:434`，`packages/llm-bridge/src/bridge/bridge.ts:452`

## 4) 多个 adapter 的 `parseRequest` 缺少输入形状守卫

- **风险等级**：中
- **问题点（稳定性 + 可维护性）**：大量 `request as XxxRequest` 后直接访问 `req.messages`，遇到畸形输入会抛非语义化异常。
- **为什么**：边界错误会变成 `TypeError`，难与 provider 错误区分，影响接入稳定性和错误分级。
- **建议（小改动）**：
  - 每个 adapter 在 `parseRequest` 开头增加最小守卫（如 `Array.isArray(req.messages)`）。
  - 抛统一 `ValidationError` 风格消息，不改核心 IR 结构。
- **如何验证**：
  1. 对每个 adapter 注入 `null/{}`/缺少 messages 的输入。
  2. 断言返回统一可预期错误，而非运行时 `TypeError`。
- **代码位置**：`packages/adapter-openai/src/inbound/request-parser.ts:16`，`packages/adapter-anthropic/src/inbound/request-parser.ts:8`

## 5) Moonshot 流解析在 `tool_call` 分支提前 `return`，可能丢失同 chunk 其它事件

- **风险等级**：高
- **问题点（稳定性）**：`delta.tool_calls` 分支直接返回单事件，而非像 reasoning/content 一样聚合到 `events`。
- **为什么**：若同一 chunk 同时携带 reasoning/content/tool_call/end，当前实现会丢失一部分事件，破坏 IR 完整性。
- **建议（小改动）**：
  - 将 `tool_call` 也 `push` 进 `events`，统一在函数末尾返回。
  - 与 `deepseek/qwen/minimax` 的聚合逻辑对齐。
- **如何验证**：
  1. 构造同时含 `reasoning_content + tool_calls + finish_reason` 的 chunk。
  2. 断言解析结果同时包含 `reasoning/tool_call/end`。
- **代码位置**：`packages/adapter-moonshot/src/inbound/stream-parser.ts:90`，`packages/adapter-moonshot/src/inbound/stream-parser.ts:94`

## 6) Anthropic/Google 对 `toolCall.arguments` 的 `JSON.parse` 无保护

- **风险等级**：中
- **问题点（稳定性）**：将 IR 中工具参数字符串直接 `JSON.parse`，遇到不合法 JSON 会中断整次请求/响应构建。
- **为什么**：工具调用参数常为增量拼接，边界字符或上游格式偏差都可能导致解析失败。
- **建议（小改动）**：
  - 对 `JSON.parse` 加 `try/catch`，失败时：
    - 保守回退 `{}`，并在扩展字段保留原始字符串；或
    - 抛明确 `ValidationError`（包含工具名与字段路径）。
- **如何验证**：
  1. 传入非法 arguments（如 `{"a":`）。
  2. 验证不会出现非预期崩溃，且有可诊断错误。
- **代码位置**：`packages/adapter-anthropic/src/outbound/request-builder.ts:88`，`packages/adapter-anthropic/src/outbound/response-builder.ts:53`，`packages/adapter-google/src/outbound/request-builder.ts:155`，`packages/adapter-google/src/outbound/response-builder.ts:72`

## 7) OpenAI Responses 流构建中 `function_call_arguments.delta` 的 `item_id` 绑定错误

- **风险等级**：高
- **问题点（稳定性 + 协议正确性）**：函数调用参数增量事件使用了 `messageItemId`，而不是对应的 `toolItemId`。
- **为什么**：客户端按 item 组装时会将函数参数拼到错误对象，导致 tool call 结构损坏或丢失。
- **建议（小改动）**：
  - 在 tool call 生命周期中保存当前 `toolItemId`，`function_call_arguments.delta` 使用该 id。
  - 补一个端到端流单测覆盖“tool_call name + arguments 增量”。
- **如何验证**：
  1. 输入 IR 事件序列：`tool_call(name)` -> `tool_call(arguments)`。
  2. 断言 SSE 中 `response.function_call_arguments.delta.data.item_id` 等于 function_call item id。
- **代码位置**：`packages/adapter-openai/src/responses/stream-builder.ts:214`，`packages/adapter-openai/src/responses/stream-builder.ts:241`

## 8) Google 原生格式工具调用 ID 使用随机生成，调用/结果关联不稳定

- **风险等级**：中
- **问题点（架构 + 可维护性）**：`functionCall` 与 `functionResponse` 分别生成随机 `toolCallId`，天然不可能稳定关联。
- **为什么**：工具调用链路依赖一致 ID 做配对；随机 ID 会增加上下游适配复杂度与排障成本。
- **建议（小改动）**：
  - 优先使用 provider 原始字段中的可关联标识（若有）。
  - 无原生 ID 时，基于 chunk 顺序 + function 名生成确定性 ID（同轮可复现）。
- **如何验证**：
  1. 构造包含 call + response 的 Gemini native 输入。
  2. 断言 IR 中 `toolCalls[].id` 与 `tool role message.toolCallId` 可稳定对应。
- **代码位置**：`packages/adapter-google/src/inbound/request-parser.ts:278`，`packages/adapter-google/src/inbound/request-parser.ts:290`

## 9) OpenAI 兼容 adapter 的流构建逻辑大量重复，且存在未使用状态变量

- **风险等级**：低
- **问题点（可维护性）**：`openai/deepseek/moonshot/qwen/zhipu` 的 stream-builder 基本同构，且 `toolCallsState` 仅写不读。
- **为什么**：复制粘贴式演进会让缺陷修复横向扩散慢、易漏改；未使用状态会干扰后续维护理解。
- **建议（小改动）**：
  - 先做“微抽象”：提取一个内部共享 helper（仅限当前 monorepo，不新增第三方依赖）。
  - 首轮仅收敛公共 chunk 框架与 finish/usage 映射，保留 provider 差异逻辑。
- **如何验证**：
  1. 对五个 adapter 跑现有流式测试，确保行为一致。
  2. 新增快照测试校验 end chunk/usage 映射不回归。
- **代码位置**：`packages/adapter-openai/src/outbound/stream-builder.ts:16`，`packages/adapter-deepseek/src/outbound/stream-builder.ts:16`，`packages/adapter-moonshot/src/outbound/stream-builder.ts:16`

---

## 建议落地优先级（小步快跑）

1. **P0（本周）**：#5、#7、#2  
2. **P1（次周）**：#1、#3、#6、#8  
3. **P2（持续）**：#4、#9

以上建议均可在现有架构内增量实施，不需要大规模重构，也不需要引入额外依赖。

