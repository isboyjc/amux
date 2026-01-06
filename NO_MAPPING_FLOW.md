# 无模型映射配置时的完整流程

## 场景说明

当开发者创建 Bridge 时**没有配置任何模型映射**：

```typescript
const bridge = createBridge({
  inbound: openaiAdapter,
  outbound: anthropicAdapter,
  config: { apiKey: 'ANTHROPIC_KEY' }
  // 注意：没有 targetModel、modelMapper、modelMapping
})

await bridge.chat({
  model: 'gpt-4',
  messages: [{ role: 'user', content: 'Hello!' }]
})
```

## 完整流程分析

### Step 1: 用户发送请求

```typescript
// 用户代码
await bridge.chat({
  model: 'gpt-4',
  messages: [{ role: 'user', content: 'Hello!' }]
})
```

**数据**：
```json
{
  "model": "gpt-4",
  "messages": [
    { "role": "user", "content": "Hello!" }
  ]
}
```

---

### Step 2: Inbound Adapter 解析请求 → IR

**代码位置**: `bridge.ts:40`
```typescript
const ir = this.inboundAdapter.inbound.parseRequest(request)
```

**执行**: `openaiAdapter.inbound.parseRequest()`

**结果 (IR)**:
```json
{
  "model": "gpt-4",  // ← 保持原样
  "messages": [
    { "role": "user", "content": "Hello!" }
  ]
}
```

**关键点**: IR 中的 `model` 字段保持为 `"gpt-4"`，没有任何转换。

---

### Step 3: 验证 IR（可选）

**代码位置**: `bridge.ts:43-50`
```typescript
if (this.inboundAdapter.validateRequest) {
  const validation = this.inboundAdapter.validateRequest(ir)
  if (!validation.valid) {
    throw new Error(...)
  }
}
```

**执行**: 如果 inbound adapter 有验证方法，会验证 IR 格式是否正确。

---

### Step 4: Outbound Adapter 构建提供商请求

**代码位置**: `bridge.ts:53`
```typescript
const providerRequest = this.outboundAdapter.outbound.buildRequest(ir)
```

**执行**: `anthropicAdapter.outbound.buildRequest(ir)`

**代码位置**: `adapter-anthropic/src/outbound/request-builder.ts:22`
```typescript
return {
  model: ir.model ?? 'claude-3-5-sonnet-20241022',  // ← 关键行
  messages: messages.map((msg) => buildMessage(msg)),
  // ...
}
```

**结果 (Anthropic 格式)**:
```json
{
  "model": "gpt-4",  // ← 直接使用 IR 中的 model
  "messages": [
    { "role": "user", "content": "Hello!" }
  ],
  "max_tokens": 4096
}
```

**关键点**:
- 如果 `ir.model` 存在，直接使用 `ir.model`（即 `"gpt-4"`）
- 如果 `ir.model` 为 `undefined`，才使用默认值 `'claude-3-5-sonnet-20241022'`

---

### Step 5: 发送 HTTP 请求到 Anthropic API

**代码位置**: `bridge.ts:56-64`
```typescript
const baseURL = this.config.baseURL ?? this.getDefaultBaseURL(this.outboundAdapter.name)
const endpoint = this.getEndpoint(this.outboundAdapter.name)

const response = await this.httpClient.request({
  method: 'POST',
  url: `${baseURL}${endpoint}`,
  body: providerRequest,
})
```

**实际请求**:
- URL: `https://api.anthropic.com/v1/messages`
- Method: `POST`
- Body:
```json
{
  "model": "gpt-4",  // ← Anthropic API 收到这个
  "messages": [
    { "role": "user", "content": "Hello!" }
  ],
  "max_tokens": 4096
}
```

---

### Step 6: Anthropic API 返回错误 ❌

**Anthropic API 响应**:
```json
{
  "type": "error",
  "error": {
    "type": "invalid_request_error",
    "message": "model: Input should be 'claude-3-5-sonnet-20241022', 'claude-3-opus-20240229', 'claude-3-sonnet-20240229' or 'claude-3-haiku-20240307'"
  }
}
```

**原因**: Anthropic API 不认识 `"gpt-4"` 这个模型名称。

---

## 流程图

```
┌─────────────────────────────────────────────────────────────┐
│ 用户代码                                                      │
│ bridge.chat({ model: 'gpt-4', messages: [...] })            │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│ Step 1: Inbound Adapter (OpenAI)                            │
│ parseRequest() → IR                                          │
│ IR = { model: 'gpt-4', messages: [...] }                    │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│ Step 2: 模型映射（如果配置了）                                │
│ ❌ 没有配置 → model 保持为 'gpt-4'                           │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│ Step 3: Outbound Adapter (Anthropic)                        │
│ buildRequest(IR) → Anthropic 格式                            │
│ { model: 'gpt-4', messages: [...], max_tokens: 4096 }      │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│ Step 4: HTTP 请求                                            │
│ POST https://api.anthropic.com/v1/messages                  │
│ Body: { model: 'gpt-4', ... }                               │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│ Step 5: Anthropic API 响应                                   │
│ ❌ Error: Invalid model 'gpt-4'                             │
└─────────────────────────────────────────────────────────────┘
```

## 不同场景的结果

### 场景 1: OpenAI → Anthropic（无配置）

```typescript
const bridge = createBridge({
  inbound: openaiAdapter,
  outbound: anthropicAdapter,
  config: { apiKey: 'ANTHROPIC_KEY' }
})

await bridge.chat({
  model: 'gpt-4',
  messages: [...]
})
```

**结果**: ❌ **失败** - Anthropic API 不认识 `'gpt-4'`

---

### 场景 2: OpenAI → Anthropic（用户传 Claude 模型）

```typescript
const bridge = createBridge({
  inbound: openaiAdapter,
  outbound: anthropicAdapter,
  config: { apiKey: 'ANTHROPIC_KEY' }
})

await bridge.chat({
  model: 'claude-3-5-sonnet-20241022',  // 用户知道要传 Claude 模型
  messages: [...]
})
```

**结果**: ✅ **成功** - 虽然格式是 OpenAI 的，但模型名是 Claude 的

---

### 场景 3: OpenAI → Anthropic（用户不传 model）

```typescript
const bridge = createBridge({
  inbound: openaiAdapter,
  outbound: anthropicAdapter,
  config: { apiKey: 'ANTHROPIC_KEY' }
})

await bridge.chat({
  // 没有 model 字段
  messages: [...]
})
```

**流程**:
1. IR: `{ model: undefined, messages: [...] }`
2. Anthropic adapter: `model: ir.model ?? 'claude-3-5-sonnet-20241022'`
3. 最终: `{ model: 'claude-3-5-sonnet-20241022', ... }`

**结果**: ✅ **成功** - 使用 Anthropic adapter 的默认模型

---

### 场景 4: Anthropic → OpenAI（无配置）

```typescript
const bridge = createBridge({
  inbound: anthropicAdapter,
  outbound: openaiAdapter,
  config: { apiKey: 'OPENAI_KEY' }
})

await bridge.chat({
  model: 'claude-3-5-sonnet-20241022',
  messages: [...]
})
```

**结果**: ❌ **失败** - OpenAI API 不认识 `'claude-3-5-sonnet-20241022'`

---

## 总结

### 无配置时的行为

1. **模型名直接传递**: IR 中的 `model` 字段会原样传递给 outbound adapter
2. **没有自动映射**: 不会自动将 `'gpt-4'` 映射到 `'claude-3-5-sonnet-20241022'`
3. **使用默认值**: 只有当 `ir.model` 为 `undefined` 时，才使用 adapter 的默认模型

### 什么时候会成功？

✅ **成功的情况**:
- 用户传入的模型名恰好是目标 API 支持的
- 用户不传 model，使用 adapter 的默认模型
- Inbound 和 Outbound 是同一个 adapter（如 OpenAI → OpenAI）

❌ **失败的情况**:
- 用户传入的模型名是源 API 的，但目标 API 不支持
- 例如：传 `'gpt-4'` 给 Anthropic API
- 例如：传 `'claude-3-5-sonnet'` 给 OpenAI API

### 为什么需要模型映射？

**核心问题**: 不同提供商的模型名称不同，直接传递会导致 API 错误。

**解决方案**: 开发者必须配置模型映射，告诉 Bridge 如何转换模型名称。

```typescript
// ✅ 正确做法
const bridge = createBridge({
  inbound: openaiAdapter,
  outbound: anthropicAdapter,
  config: { apiKey: 'ANTHROPIC_KEY' },

  // 配置模型映射
  modelMapping: {
    'gpt-4': 'claude-3-5-sonnet-20241022',
    'gpt-3.5-turbo': 'claude-3-haiku-20240307'
  }
})
```

这样，当用户传 `'gpt-4'` 时，会自动映射到 `'claude-3-5-sonnet-20241022'`。
