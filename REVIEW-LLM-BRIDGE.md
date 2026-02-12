# LLM Bridge SDK 系统性审查报告

> 审查范围：`packages/llm-bridge` + 全部 8 个 adapter 包 + `packages/utils`
> 审查维度：架构设计、性能、稳定性、可维护性
> 审查原则：不建议大规模重构、不引入不必要依赖

---

## 一、核心包 `@amux.ai/llm-bridge`

### 1. [高风险] `APIError.retryable` 标志与 `HTTPClient.shouldRetry()` 行为不一致

**位置：** `packages/llm-bridge/src/errors/index.ts:40` + `packages/llm-bridge/src/bridge/http-client.ts:36`

**问题：** `APIError` 中 `retryable` 的赋值逻辑为 `status >= 500`，意味着 429 (Rate Limit) 的 `retryable` 为 `false`。但 `HTTPClient.shouldRetry()` 会在 408/429/500/502/503/504 时重试。消费方如果基于 `error.retryable` 决定是否重试，会得到与 SDK 内部行为矛盾的信号。

**为什么重要：** 下游服务（如 Desktop proxy server）可能基于 `error.retryable` 做熔断/限流决策，不一致的标志会导致错误的降级行为。

**建议：** 将 `APIError` 的 `retryable` 判定逻辑与 `shouldRetry` 对齐：

```typescript
// errors/index.ts
this.retryable = status === 408 || status === 429 || status >= 500
```

**验证方式：** 单元测试断言 `new APIError('...', 429, 'rate_limit').retryable === true`；在 bridge.test.ts 中补充 429 场景的重试行为测试。

---

### 2. [高风险] 流式传输中 JSON 解析失败被静默吞没

**位置：** `packages/llm-bridge/src/bridge/bridge.ts:449-453`

**问题：** `processSSELines` 方法中 `JSON.parse(data)` 如果失败，只执行 `continue` 跳过该行，不抛出错误、不发射 error 事件、不触发 `onError` hook。Provider 返回的畸形 JSON 对调用方完全不可见。

**为什么重要：** 在生产环境中，Provider 偶尔返回截断或格式错误的 JSON 是已知场景（网络中断、CDN 注入等）。静默跳过意味着：(1) 用户看到内容突然中断但无错误提示；(2) 监控系统无法感知这类异常。

**建议：** 在 catch 块中发射一个 warning 级别的 stream event 并触发 `onError` hook：

```typescript
catch (e) {
  // 发射 error stream event，但不中断流
  yield {
    type: 'error' as StreamEventType,
    error: { message: `Malformed JSON in stream: ${(e as Error).message}`, code: 'PARSE_ERROR' }
  }
  continue
}
```

**验证方式：** 添加测试：构造包含畸形 JSON 的 SSE 流，断言 `chatStreamRaw` 输出中包含 `type: 'error'` 事件。

---

### 3. [高风险] `chatRaw` 方法跳过了 Hook、能力校验和错误处理

**位置：** `packages/llm-bridge/src/bridge/bridge.ts:217-259`

**问题：** `chatRaw` 不调用 `onRequest`/`onResponse`/`onError` hook，不调用 `validateCapabilities()`。对比 `chat()` 方法，这导致：
- Hook 用于计费/日志的场景完全失效
- 不支持 tools 的 adapter 接收到 tool 请求时，不会在 Bridge 层报错，而是透传到 Provider 返回不可读的错误

**为什么重要：** Desktop 的 bridge-manager 在某些路径可能使用 `chatRaw` 进行原始 IR 调用，导致监控盲区。

**建议：** 在 `chatRaw` 中添加 `validateCapabilities` 调用，并在 try-catch 中触发 `onError` hook（与 `chat` 保持一致）。Hook 触发可设为可选（通过参数或配置控制）。

```typescript
async chatRaw(request: unknown, options?: { skipHooks?: boolean }): Promise<LLMResponseIR> {
  // ... parse request
  this.validateCapabilities(ir)
  if (!options?.skipHooks) {
    await this.hooks?.onRequest?.(ir)
  }
  // ... rest of flow
}
```

**验证方式：** 测试：向 `tools: false` 的 adapter 发送含 tools 的 `chatRaw` 请求，断言抛出 `ValidationError`。

---

### 4. [高风险] `validateCapabilities` 只校验了部分能力

**位置：** `packages/llm-bridge/src/bridge/bridge.ts:95-124`

**问题：** 当前只校验 `tools`、`vision`、`reasoning` 三项。`systemPrompt`、`toolChoice`、`multimodal`、`jsonMode`、`logprobs`、`seed`、`webSearch` 全部未校验。IR 中携带了不被目标 adapter 支持的特性时，会悄无声息地透传并在 Provider 端报错。

**为什么重要：** Provider 的错误信息通常含义模糊（如 "invalid parameter"），不如 Bridge 层预先拦截并给出明确的能力不匹配提示。

**建议：** 逐步补充校验，优先补充 `toolChoice` 和 `jsonMode`（这两个最容易因不兼容导致 Provider 400 错误）：

```typescript
if (ir.toolChoice && ir.toolChoice !== 'auto' && ir.toolChoice !== 'none'
    && !this.outboundAdapter.capabilities.toolChoice) {
  throw new ValidationError('Outbound adapter does not support toolChoice', ['toolChoice not supported'])
}
if (ir.generation?.responseFormat?.type === 'json_object'
    && !this.outboundAdapter.capabilities.jsonMode) {
  throw new ValidationError('Outbound adapter does not support JSON mode', ['jsonMode not supported'])
}
```

**验证方式：** 分别测试每种能力不匹配场景，断言抛出 `ValidationError` 且 `errors` 数组包含描述性信息。

---

### 5. [高风险] 核心包测试覆盖率严重不足

**位置：** `packages/llm-bridge/tests/`

**问题：** 当前只有 3 个测试文件（bridge/registry/ir），合计 689 行。缺失以下关键场景的测试：
- `chat()` 完整流程（parse → build → HTTP → parse → build）
- `chatStream()` / `chatStreamRaw()` 流式流程
- `chatRaw()` 流程
- Model mapping（targetModel / modelMapper / modelMapping）
- `[DONE]` 过滤逻辑
- 重复 end event 去重逻辑
- `HTTPClient` 重试/超时/退避逻辑
- `SSELineParser` 分块解析
- Content helpers / Usage parser / Error parser
- 自定义 Error 类层级

**为什么重要：** 项目设定的覆盖率目标是 80%，但核心包当前的实际覆盖率远低于此。Bridge 和 HTTPClient 是所有请求的必经路径，缺少测试意味着任何改动都有高回归风险。

**建议：** 按优先级分批补充：
1. **P0：** Bridge `chat()` + `chatStream()` 端到端测试（mock HTTP 层）
2. **P0：** HTTPClient 重试/超时测试
3. **P1：** SSELineParser 边界场景测试
4. **P1：** Model mapping 各优先级测试
5. **P2：** Utility 函数测试、Error 类测试

**验证方式：** `pnpm --filter @amux.ai/llm-bridge test:coverage` 达到 80% 四项指标。

---

### 6. [中风险] 自定义 `signal` 会使内部超时机制完全失效

**位置：** `packages/llm-bridge/src/bridge/http-client.ts:77`

**问题：** `fetch` 使用 `options.signal ?? controller.signal`。当调用方传入自己的 `signal` 时，内部 `AbortController` 的 `setTimeout → controller.abort()` 不再连接到 `fetch`，超时保护被旁路。

**为什么重要：** Desktop proxy server 可能为请求设置外部 signal（如客户端断开连接时取消），此时 Provider 端无响应的请求会无限挂起。

**建议：** 组合两个 signal，使任一触发都中止请求：

```typescript
const internalController = new AbortController()
const timeoutId = setTimeout(() => internalController.abort(), timeout)
const combinedSignal = options.signal
  ? AbortSignal.any([options.signal, internalController.signal])
  : internalController.signal
```

> 注：`AbortSignal.any()` 在 Node 20+ 可用。若需兼容 Node 18，可使用手动监听模式。

**验证方式：** 测试：传入外部 signal + 设置 timeout，模拟 Provider 不响应，断言在 timeout 时间后请求被中止。

---

### 7. [中风险] SSELineParser 不处理 `\r\n` 行尾

**位置：** `packages/llm-bridge/src/utils/sse-parser.ts:28`

**问题：** 仅按 `\n` 分割。SSE 规范支持 `\r\n`、`\r`、`\n` 三种行尾。部分 Provider（尤其是通过 CDN 代理时）可能使用 `\r\n`，此时解析出的行会带有尾部 `\r`。

**为什么重要：** 虽然 `data: ` 行的后续处理有 `.trim()`，但如果某些 adapter 的 stream-parser 直接比较字符串（如 `=== '[DONE]'`），尾部 `\r` 会导致匹配失败。

**建议：** 在 `extractLines` 中规范化行尾：

```typescript
// 替换 indexOf('\n') 逻辑
const normalized = this.buffer.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
```

或在提取行后 trim 每行。

**验证方式：** 测试：输入 `"data: hello\r\ndata: world\r\n"` 的 chunk，断言解析出两行且无 `\r`。

---

### 8. [中风险] 流式传输无超时保护

**位置：** `packages/llm-bridge/src/bridge/http-client.ts:162-249`

**问题：** `requestStream` 中，`clearTimeout` 在收到 response 后立即调用。之后的流读取（`reader.read()` 循环）没有任何超时保护。如果 Provider 保持连接但停止发送数据（如 CDN 30s 空闲断开问题），流会无限挂起。

**为什么重要：** 在 Desktop proxy 场景下，一个挂起的流占用一个连接和对应的内存缓冲区。多个此类流可导致资源耗尽。

**建议：** 添加 chunk 间超时（idle timeout）：

```typescript
const IDLE_TIMEOUT = 60_000 // 60s 无新数据则超时
let idleTimer: ReturnType<typeof setTimeout>

while (true) {
  const readPromise = reader.read()
  const timeoutPromise = new Promise<never>((_, reject) => {
    idleTimer = setTimeout(() => reject(new TimeoutError('Stream idle timeout', IDLE_TIMEOUT)), IDLE_TIMEOUT)
  })
  const { done, value } = await Promise.race([readPromise, timeoutPromise])
  clearTimeout(idleTimer)
  if (done) break
  // ... process value
}
```

**验证方式：** 测试：模拟流在发送部分数据后停顿超过 idle timeout，断言抛出 `TimeoutError`。

---

### 9. [中风险] Bridge 内部使用 `throw new Error()` 而非自定义错误类型

**位置：** `packages/llm-bridge/src/bridge/bridge.ts` 多处

**问题：** `validateCapabilities`、`chat`、`chatRaw` 中使用 `throw new Error(...)` 而非 `ValidationError`、`BridgeError`、`AdapterError`。自定义错误类层级定义完善但在 Bridge 内部未被充分使用。

**为什么重要：** 消费方通过 `instanceof` 判断错误类型来决定处理策略。使用原生 `Error` 会使错误分类系统失效。

**建议：** 替换为对应的自定义错误类型：

```typescript
// validateCapabilities 中
throw new ValidationError('...', ['specific error details'])

// chat/chatRaw 中 adapter 相关错误
throw new AdapterError('...', adapter.name)

// 配置/初始化错误
throw new BridgeError('...')
```

**验证方式：** 搜索 Bridge 源码中所有 `throw new Error`，逐一替换后运行测试确认行为不变。

---

### 10. [中风险] `usage-parser` 中 truthy 判断导致值为 0 时信息丢失

**位置：** `packages/llm-bridge/src/utils/usage-parser.ts:30-31`

**问题：** 代码使用 `if (usage.completion_tokens_details?.reasoning_tokens || usage.prompt_cache_hit_tokens)` 进行 truthy 判断。当 `reasoning_tokens` 为 0 时，条件为 `false`，`details` 对象不会被创建，丢失了 "使用了 0 个推理 token" 这个有效信息。

**为什么重要：** 计费和监控系统需要区分 "没有推理 token 数据" 和 "推理 token 为 0"。

**建议：** 使用显式的 `!== undefined` 检查：

```typescript
if (usage.completion_tokens_details?.reasoning_tokens !== undefined
    || usage.prompt_cache_hit_tokens !== undefined) {
  details = {
    reasoningTokens: usage.completion_tokens_details?.reasoning_tokens,
    cachedTokens: usage.prompt_cache_hit_tokens,
  }
}
```

**验证方式：** 测试：输入 `{ completion_tokens_details: { reasoning_tokens: 0 } }`，断言输出 `details.reasoningTokens === 0`。

---

### 11. [低风险] `(this.config as any).chatPath` 中不必要的类型断言

**位置：** `packages/llm-bridge/src/bridge/bridge.ts:553,578`

**问题：** `BridgeConfig` 接口已声明 `chatPath?: string` 和 `modelsPath?: string`，但代码通过 `(this.config as any).chatPath` 访问。`as any` 绕过了类型检查。

**为什么重要：** 如果 `BridgeConfig` 的字段名被重构（如重命名），TypeScript 编译器不会检测到此处引用。

**建议：** 直接使用 `this.config.chatPath`。

**验证方式：** 全局搜索 `as any`，替换后 `pnpm typecheck` 通过。

---

### 12. [低风险] `Error.captureStackTrace` 在非 V8 运行时报错

**位置：** `packages/llm-bridge/src/errors/index.ts:20`

**问题：** 所有自定义错误类调用 `Error.captureStackTrace(this, this.constructor)`，这是 V8 特有 API。虽然目标环境（Node.js/Electron/Cloudflare Workers）都基于 V8，但作为发布的 npm 包，应有防御性处理。

**建议：** 添加存在性检查：

```typescript
if (typeof Error.captureStackTrace === 'function') {
  Error.captureStackTrace(this, this.constructor)
}
```

**验证方式：** 现有测试通过即可。可选：在非 V8 环境（如 Bun）中运行测试。

---

### 13. [低风险] `requestStream` 无重试机制

**位置：** `packages/llm-bridge/src/bridge/http-client.ts:162-249`

**问题：** 非流式 `request()` 方法有 3 次重试，但 `requestStream()` 对初始连接失败也不重试。

**为什么重要：** 流式请求的初始连接阶段与非流式请求无本质区别。瞬时网络抖动导致的连接失败应可重试。

**建议：** 为 `requestStream` 的初始 `fetch()` 调用添加有限重试（如最多 1 次）：

```typescript
async *requestStream(options: HTTPRequestOptions, retries = 0): AsyncGenerator<string> {
  try {
    const response = await fetch(url, fetchOptions)
    // ... process stream
  } catch (error) {
    if (retries < 1 && this.shouldRetry((error as any).status ?? 0)) {
      await this.getBackoffDelay(retries)
      yield* this.requestStream(options, retries + 1)
      return
    }
    throw error
  }
}
```

**验证方式：** 测试：模拟首次连接 503，第二次成功，断言流正常返回。

---

### 14. [低风险] `Retry-After` 头解析不支持 HTTP-date 格式

**位置：** `packages/llm-bridge/src/bridge/http-client.ts:122-124`

**问题：** 只使用 `parseInt` 解析 `Retry-After`。HTTP 规范允许两种格式：秒数整数（如 `120`）和 HTTP-date（如 `Wed, 21 Oct 2025 07:28:00 GMT`）。

**建议：** 添加日期格式判断：

```typescript
const retryAfterRaw = response.headers['retry-after']
let retryAfterMs: number | undefined
if (retryAfterRaw) {
  const seconds = parseInt(retryAfterRaw, 10)
  if (!isNaN(seconds)) {
    retryAfterMs = seconds * 1000
  } else {
    const date = new Date(retryAfterRaw)
    if (!isNaN(date.getTime())) {
      retryAfterMs = Math.max(0, date.getTime() - Date.now())
    }
  }
}
```

**验证方式：** 测试：分别传入秒数和 HTTP-date 格式的 Retry-After 头，断言计算出正确的退避时间。

---

### 15. [低风险] `enableSearch` 是 Qwen 特有字段却放在核心 `GenerationConfig`

**位置：** `packages/llm-bridge/src/types/generation.ts:106`

**问题：** `enableSearch` 仅 Qwen 使用，但放在核心类型中。这造成了核心包与特定 Provider 的耦合。

**为什么重要：** 如果后续有更多 Provider 特有字段，核心类型会持续膨胀。

**建议：** 当前因为只有一个此类字段，保持现状可接受。如果未来增加第二个 Provider 特有字段，应迁移到 `extensions`。在类型定义中添加注释标明来源：

```typescript
/** @provider qwen - Enable web search. Consider moving to extensions if more provider-specific fields are added. */
enableSearch?: boolean
```

**验证方式：** 代码审查确认注释到位即可。

---

## 二、Adapter 包

### 16. [高风险] Zhipu adapter 声明 `vision: true` 但 request-builder 静默丢弃图片

**位置：** `packages/adapter-zhipu/src/outbound/request-builder.ts`

**问题：** `capabilities` 声明 `vision: true, multimodal: true`，但 `buildContent` 函数只处理文本 ContentPart，图片内容被 `.filter(part => part.type === 'text')` 过滤掉。Bridge 的 `validateCapabilities` 因为 `vision: true` 不会拦截包含图片的请求，导致图片数据被静默丢弃。

**为什么重要：** 用户发送包含图片的请求到 Zhipu，不会收到任何错误，但 Zhipu 实际只收到文本部分。这是一个数据丢失 bug。

**建议：** 两种方案择一：
- **方案 A**（推荐）：将 capabilities 改为 `vision: false, multimodal: false`，诚实反映当前实现
- **方案 B**：在 `buildContent` 中实现 Zhipu 的多模态格式（如果 Zhipu API 支持）

**验证方式：** 方案 A：测试向 Zhipu adapter 发送含 vision 内容的请求，Bridge 层应抛出能力不匹配错误。方案 B：端到端测试向 Zhipu 发送图片消息并验证响应。

---

### 17. [高风险] 多个 adapter 中 `JSON.parse(toolCall.function.arguments)` 无异常处理

**位置：**
- `packages/adapter-anthropic/src/outbound/request-builder.ts:89`
- `packages/adapter-anthropic/src/outbound/response-builder.ts:53`
- `packages/adapter-google/src/outbound/request-builder.ts:156`
- `packages/adapter-google/src/outbound/response-builder.ts:73`
- `packages/adapter-google/src/outbound/stream-builder.ts:55`

**问题：** Tool call 的 `arguments` 字段是 JSON 字符串，这些位置直接 `JSON.parse` 无 try-catch。如果 LLM 返回格式错误的 arguments（这在实际场景中时有发生），会抛出未捕获的异常导致整个请求失败。

**为什么重要：** LLM 生成的 JSON 并非总是合法的。尤其在流式场景中，arguments 可能不完整。

**建议：** 统一添加防御性解析：

```typescript
function safeParseJSON(str: string): unknown {
  try {
    return JSON.parse(str)
  } catch {
    return str  // 回退为原始字符串
  }
}
```

在上述所有位置使用 `safeParseJSON` 替代直接 `JSON.parse`。

**验证方式：** 测试：构造 `arguments: "not valid json"`，断言不抛异常且回退值为原始字符串。

---

### 18. [高风险] Moonshot request-parser 未解析 `reasoning_content`

**位置：** `packages/adapter-moonshot/src/inbound/request-parser.ts`

**问题：** Adapter 声明 `reasoning: true`，response-parser 和 stream-parser 都正确处理了 `reasoning_content`，但 request-parser 中 `content` 字段使用 `msg.content ?? ''`（纯字符串），完全忽略了来自 Moonshot 消息中的 `reasoning_content` 字段，不会转换为 IR 的 `reasoningContent`。

**为什么重要：** 当 Moonshot 作为 inbound adapter 时，携带推理内容的请求在转换到 IR 后丢失推理上下文。

**建议：** 在 message 解析中加入 `reasoning_content` 的提取：

```typescript
const message: Message = {
  role: msg.role as Role,
  content: msg.content ?? '',
  reasoningContent: msg.reasoning_content,
  // ... other fields
}
```

**验证方式：** 测试：构造含 `reasoning_content` 的 Moonshot 请求，断言 IR 消息的 `reasoningContent` 有值。

---

### 19. [中风险] OpenAI 兼容 adapter 间大量代码重复

**现象：** 以下文件在 6+ 个 adapter 中有 90%+ 相似度：
- `outbound/stream-builder.ts`（~200 行 × 6 个 adapter）
- `inbound/request-parser.ts`（系统消息提取、内容解析、工具解析逻辑）
- `inbound/stream-parser.ts`（`mapFinishReason` 局部定义 × 16+ 处）

**为什么重要：** 修复一个 bug 需要在 6 个文件中同步修改。遗漏任何一个就是潜在的不一致。

**建议：** 在不违反 "adapter 独立" 原则的前提下，在 `packages/llm-bridge/src/utils/` 中提供更多可复用的辅助函数：
1. 提取 `createOpenAICompatibleStreamBuilder(options)` 工厂函数，通过配置区分各 adapter 的差异（reasoning 字段名、自定义 finish reason 映射等）
2. 将各 stream-parser 中重复的 `mapFinishReason` 统一使用核心包已有的 `mapFinishReason`（目前只有 response-parser 在用）
3. 提取 `parseOpenAICompatibleRequest(request, options)` 通用解析函数

每个 adapter 仍然是独立包，只是从核心包导入工具函数，与导入 IR 类型的模式一致。

**验证方式：** 重构后对比各 adapter 的测试结果不变。统计各 adapter 的代码行数，预期减少 30-40%。

---

### 20. [中风险] Anthropic stream-parser 未提取 usage 信息

**位置：** `packages/adapter-anthropic/src/inbound/stream-parser.ts`

**问题：** Anthropic 在流式响应中通过 `message_start`（input_tokens）和 `message_delta`（output_tokens）分别发送 usage 信息。当前 stream-parser 处理了这些事件但没有将 usage 数据映射到 IR 的 `LLMStreamEvent.usage`。

**为什么重要：** 流式请求的 token 计数丢失，影响计费统计和配额管理。

**建议：** 在 `message_start` 和 `message_delta` 的处理中提取 usage：

```typescript
case 'message_start':
  return {
    type: 'start',
    usage: event.message?.usage ? {
      promptTokens: event.message.usage.input_tokens,
      completionTokens: 0,
      totalTokens: event.message.usage.input_tokens,
    } : undefined,
    // ...
  }
case 'message_delta':
  return {
    type: 'end',
    usage: event.usage ? {
      promptTokens: 0,
      completionTokens: event.usage.output_tokens,
      totalTokens: event.usage.output_tokens,
    } : undefined,
    // ...
  }
```

**验证方式：** 测试：模拟含 usage 的 Anthropic 流式事件序列，断言 end 事件的 `usage` 字段有值。

---

### 21. [中风险] DeepSeek reasoner 模型检测逻辑过于脆弱

**位置：** `packages/adapter-deepseek/src/outbound/request-builder.ts`

**问题：** 使用 `ir.model?.includes('reasoner')` 判断是否为 reasoner 模型。任何模型名中包含 "reasoner" 子串的都会触发特殊行为（跳过系统消息、跳过输入 reasoning_content），包括误匹配场景如 "not-a-reasoner"。

**建议：** 使用更精确的匹配模式：

```typescript
const REASONER_MODEL_PATTERN = /\breasoner\b/i
const isReasonerModel = REASONER_MODEL_PATTERN.test(ir.model ?? '')
```

或维护已知 reasoner 模型列表：

```typescript
const REASONER_MODELS = ['deepseek-reasoner']
const isReasonerModel = REASONER_MODELS.some(m => ir.model?.startsWith(m))
```

**验证方式：** 测试：分别传入 `deepseek-reasoner`、`deepseek-chat`、`my-reasoner-test` 模型名，断言只有第一个触发 reasoner 逻辑。

---

### 22. [中风险] Qwen adapter 声明 `webSearch: false` 但实际支持搜索功能

**位置：** `packages/adapter-qwen/src/adapter.ts`

**问题：** Qwen adapter 支持 `enable_search` 参数（在 request-parser 和 request-builder 中均有处理），但 capabilities 声明 `webSearch: false`（实际该字段未定义，等同 false）。

**建议：** 修正为 `webSearch: true`。

**验证方式：** `adapter.getInfo().capabilities.webSearch === true`。

---

### 23. [中风险] Google adapter 双格式解析中系统消息处理不一致

**位置：** `packages/adapter-google/src/inbound/request-parser.ts`

**问题：** OpenAI 格式解析路径不提取系统消息到 IR 的 `system` 字段（系统消息保留在 messages 数组中）。Gemini 格式解析路径正确提取 `systemInstruction` 到 `system` 字段。

**为什么重要：** 通过 OpenAI 格式发送到 Google adapter 的请求，系统消息的行为与其他 adapter 不一致。

**建议：** 在 OpenAI 格式解析路径中添加系统消息提取逻辑（与其他 OpenAI 兼容 adapter 一致）：

```typescript
function parseOpenAIRequest(req: any): LLMRequestIR {
  const systemMessages = req.messages.filter((m: any) => m.role === 'system')
  const system = systemMessages.map((m: any) => typeof m.content === 'string' ? m.content : '').join('\n')
  const nonSystemMessages = req.messages.filter((m: any) => m.role !== 'system')
  // ...
  return { ..., system: system || undefined, messages: parsedNonSystemMessages }
}
```

**验证方式：** 测试：发送含系统消息的 OpenAI 格式请求到 Google adapter，断言 IR 的 `system` 字段有值。

---

### 24. [低风险] 所有 adapter 对 `request: unknown` 使用不安全的 `as` 类型断言

**问题：** 每个 adapter 的 `parseRequest` 方法直接 `const req = request as ProviderRequestType`，无运行时验证。畸形输入会在后续属性访问时抛出难以定位的错误。

**建议：** 在各 adapter 的 `parseRequest` 入口添加最小化的结构验证：

```typescript
function parseRequest(request: unknown): LLMRequestIR {
  if (!request || typeof request !== 'object') {
    throw new ValidationError('Request must be a non-null object', ['invalid request type'])
  }
  const req = request as ProviderRequestType
  if (!Array.isArray(req.messages)) {
    throw new ValidationError('Request must contain a messages array', ['missing messages'])
  }
  // ... proceed with parsing
}
```

不需要完整的 schema 校验（不引入 zod 等依赖），只需关键字段的存在性检查。

**验证方式：** 测试：分别传入 `null`、`undefined`、`{}`、`{ messages: "not array" }`，断言抛出 `ValidationError`。

---

### 25. [低风险] Adapter 间 start event 检测逻辑不一致

**问题：** 两种不同检测策略：
- **基于 role**（OpenAI/DeepSeek/Moonshot/MiniMax）：`delta.role && !delta.content`
- **基于 index**（Qwen/Zhipu/Google）：`choice.index === 0 && 空 delta && 无 finish_reason`

index 策略可能将空 delta（但非 start event）误判为 start，尤其在 Provider 发送心跳空块时。

**建议：** 统一为 role 策略（因为 OpenAI 兼容格式的首个 chunk 必定包含 `delta.role`）。如果 Qwen/Zhipu 不发送 role，添加注释说明原因。

**验证方式：** 测试：模拟空 delta chunk（无 role），断言不会被误判为 start event。

---

### 26. [低风险] `tsconfig.base.json` 缺少 `adapter-minimax` 的路径别名

**位置：** `/tsconfig.base.json`

**问题：** `paths` 映射中包含所有 adapter，唯独缺少 `@amux.ai/adapter-minimax`。

**建议：** 添加：

```json
"@amux.ai/adapter-minimax": ["./packages/adapter-minimax/src/index.ts"]
```

**验证方式：** `pnpm typecheck` 通过。

---

## 三、`@amux.ai/utils` 包

### 27. [低风险] Vitest 版本严重过时

**位置：** `packages/utils/package.json`

**问题：** 声明 `vitest: "^1.2.1"`，而根目录为 `"^4.0.16"`，差了 3 个大版本。

**建议：** 统一更新为 `"^4.0.16"`。

**验证方式：** `pnpm --filter @amux.ai/utils test` 通过。

---

### 28. [低风险] `normalizeError` 不感知核心包的错误层级

**位置：** `packages/utils/src/error.ts`

**问题：** 核心包的 `APIError`、`NetworkError` 等经过 `normalizeError` 时会丢失 `status`、`code` 等结构化字段（被当作普通 `Error` 处理）。

**建议：** 在 `normalizeError` 中添加对含 `status`/`code` 属性的 Error 对象的处理：

```typescript
if (error instanceof Error) {
  return {
    message: error.message,
    code: (error as any).code,
    status: (error as any).status,
  }
}
```

**验证方式：** 测试：传入含 `status: 429` 属性的 Error 对象，断言 `normalized.status === 429`。

---

## 四、问题汇总表

| # | 风险 | 模块 | 问题简述 |
|---|------|------|----------|
| 1 | 高 | llm-bridge/errors | `APIError.retryable` 与 `HTTPClient.shouldRetry` 不一致 |
| 2 | 高 | llm-bridge/bridge | 流式 JSON 解析失败被静默吞没 |
| 3 | 高 | llm-bridge/bridge | `chatRaw` 跳过 hook、校验和错误处理 |
| 4 | 高 | llm-bridge/bridge | `validateCapabilities` 只校验 3/11 项能力 |
| 5 | 高 | llm-bridge/tests | 核心流程测试覆盖率远低于 80% 目标 |
| 6 | 高 | adapter-zhipu | 声明 vision: true 但静默丢弃图片内容 |
| 7 | 高 | adapter-* | 5 处 JSON.parse 无异常处理 |
| 8 | 高 | adapter-moonshot | 未解析 inbound reasoning_content |
| 9 | 中 | llm-bridge/http-client | 自定义 signal 使内部超时失效 |
| 10 | 中 | llm-bridge/sse-parser | 不处理 \r\n 行尾 |
| 11 | 中 | llm-bridge/http-client | 流式传输无 idle timeout |
| 12 | 中 | llm-bridge/bridge | 使用原生 Error 而非自定义错误类型 |
| 13 | 中 | llm-bridge/usage-parser | truthy 判断丢失 0 值 |
| 14 | 中 | adapter-* | 6 个 adapter 间 ~1200 行重复代码 |
| 15 | 中 | adapter-anthropic | 流式 usage 信息丢失 |
| 16 | 中 | adapter-deepseek | reasoner 模型检测逻辑脆弱 |
| 17 | 中 | adapter-qwen | webSearch 能力声明不正确 |
| 18 | 中 | adapter-google | 双格式系统消息处理不一致 |
| 19 | 低 | llm-bridge/bridge | 不必要的 `as any` 类型断言 |
| 20 | 低 | llm-bridge/errors | `Error.captureStackTrace` 非 V8 兼容 |
| 21 | 低 | llm-bridge/http-client | requestStream 无初始重试 |
| 22 | 低 | llm-bridge/http-client | Retry-After 不支持 HTTP-date |
| 23 | 低 | llm-bridge/types | enableSearch 耦合 Qwen |
| 24 | 低 | adapter-* | 无运行时输入验证 |
| 25 | 低 | adapter-* | start event 检测逻辑不一致 |
| 26 | 低 | tsconfig | 缺少 adapter-minimax 路径别名 |
| 27 | 低 | utils | Vitest 版本严重过时 |
| 28 | 低 | utils | normalizeError 不感知核心错误层级 |
