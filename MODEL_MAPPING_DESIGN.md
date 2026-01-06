# 模型映射设计方案

## 问题描述

当前 LLM Bridge 在不同厂商之间转换时，没有自动的模型映射机制。用户必须知道目标提供商的模型名称，这违背了"透明转换"的设计理念。

### 当前问题示例

```typescript
// ❌ 这样会失败 - OpenAI 模型名发给 Anthropic API
const bridge = createBridge({
  inbound: openaiAdapter,
  outbound: anthropicAdapter,
  config: { apiKey: '...' }
})

await bridge.chat({
  model: 'gpt-4', // Anthropic API 不认识这个模型
  messages: [...]
})
```

## 解决方案

### 核心理念

**LLM Bridge 不应该自动映射模型**，因为：
1. 不同模型的能力、成本、性能差异很大
2. 自动映射可能导致意外的成本或性能问题
3. 开发者应该明确知道实际调用的是哪个模型

**正确的做法**：让开发者在配置时明确指定模型映射关系。

### 方案 1: 简单映射对象（推荐）

```typescript
// packages/core/src/bridge/types.ts
export interface BridgeOptions {
  inbound: LLMAdapter
  outbound: LLMAdapter
  config: BridgeConfig

  // 模型映射配置
  modelMapping?: {
    [inboundModel: string]: string  // 入站模型 → 出站模型
  }
}
```

使用示例：

```typescript
const bridge = createBridge({
  inbound: anthropicAdapter,
  outbound: openaiAdapter,
  config: { apiKey: 'OPENAI_KEY' },

  // 开发者明确配置映射
  modelMapping: {
    'claude-3-5-sonnet-20241022': 'gpt-4',
    'claude-3-opus-20240229': 'gpt-4',
    'claude-3-haiku-20240307': 'gpt-3.5-turbo'
  }
})

// 用户请求
await bridge.chat({
  model: 'claude-3-5-sonnet-20241022', // 会被映射到 'gpt-4'
  messages: [...]
})
```

### 方案 2: 映射函数（更灵活）

```typescript
export interface BridgeOptions {
  inbound: LLMAdapter
  outbound: LLMAdapter
  config: BridgeConfig

  // 使用函数进行映射
  modelMapper?: (inboundModel: string) => string
}
```

使用示例：

```typescript
const bridge = createBridge({
  inbound: anthropicAdapter,
  outbound: openaiAdapter,
  config: { apiKey: 'OPENAI_KEY' },

  // 使用函数进行灵活映射
  modelMapper: (model) => {
    // 根据模型名称前缀映射
    if (model.startsWith('claude-3-5')) return 'gpt-4'
    if (model.startsWith('claude-3-opus')) return 'gpt-4'
    if (model.startsWith('claude-3-haiku')) return 'gpt-3.5-turbo'

    // 默认映射
    return 'gpt-4'
  }
})
```

### 方案 3: 固定目标模型（最简单）

```typescript
export interface BridgeOptions {
  inbound: LLMAdapter
  outbound: LLMAdapter
  config: BridgeConfig

  // 固定使用某个模型，忽略入站模型
  targetModel?: string
}
```

使用示例：

```typescript
const bridge = createBridge({
  inbound: anthropicAdapter,
  outbound: openaiAdapter,
  config: { apiKey: 'OPENAI_KEY' },

  // 无论用户传什么模型，都使用 gpt-4
  targetModel: 'gpt-4'
})

await bridge.chat({
  model: 'claude-3-5-sonnet-20241022', // 会被忽略，使用 'gpt-4'
  messages: [...]
})
```

### 方案 4: 组合使用（推荐）

支持多种配置方式，按优先级使用：

```typescript
export interface BridgeOptions {
  inbound: LLMAdapter
  outbound: LLMAdapter
  config: BridgeConfig

  // 优先级：targetModel > modelMapper > modelMapping > 原模型
  targetModel?: string
  modelMapper?: (inboundModel: string) => string
  modelMapping?: { [inboundModel: string]: string }
}
```

使用示例：

```typescript
// 示例 1: 只使用 targetModel（最简单）
const bridge1 = createBridge({
  inbound: anthropicAdapter,
  outbound: openaiAdapter,
  config: { apiKey: 'OPENAI_KEY' },
  targetModel: 'gpt-4'
})

// 示例 2: 使用 modelMapping（常用）
const bridge2 = createBridge({
  inbound: anthropicAdapter,
  outbound: openaiAdapter,
  config: { apiKey: 'OPENAI_KEY' },
  modelMapping: {
    'claude-3-5-sonnet-20241022': 'gpt-4',
    'claude-3-haiku-20240307': 'gpt-3.5-turbo'
  }
})

// 示例 3: 使用 modelMapper（最灵活）
const bridge3 = createBridge({
  inbound: anthropicAdapter,
  outbound: openaiAdapter,
  config: { apiKey: 'OPENAI_KEY' },
  modelMapper: (model) => {
    // 自定义逻辑
    if (model.includes('opus')) return 'gpt-4'
    if (model.includes('haiku')) return 'gpt-3.5-turbo'
    return 'gpt-4'
  }
})

// 示例 4: 组合使用
const bridge4 = createBridge({
  inbound: anthropicAdapter,
  outbound: openaiAdapter,
  config: { apiKey: 'OPENAI_KEY' },

  // 先尝试映射表
  modelMapping: {
    'claude-3-5-sonnet-20241022': 'gpt-4'
  },

  // 映射表找不到时使用函数
  modelMapper: (model) => {
    if (model.startsWith('claude')) return 'gpt-4'
    return 'gpt-3.5-turbo'
  }
})
```

## 实现细节

### Bridge 类中的实现

```typescript
// packages/core/src/bridge/bridge.ts
export class Bridge implements LLMBridge {
  private inboundAdapter: LLMAdapter
  private outboundAdapter: LLMAdapter
  private config: BridgeConfig
  private httpClient: HTTPClient

  // 模型映射配置
  private targetModel?: string
  private modelMapper?: (model: string) => string
  private modelMapping?: { [key: string]: string }

  constructor(options: BridgeOptions) {
    this.inboundAdapter = options.inbound
    this.outboundAdapter = options.outbound
    this.config = options.config

    // 保存模型映射配置
    this.targetModel = options.targetModel
    this.modelMapper = options.modelMapper
    this.modelMapping = options.modelMapping

    this.httpClient = new HTTPClient({
      headers: {
        Authorization: `Bearer ${this.config.apiKey}`,
        ...this.config.headers,
      },
      timeout: this.config.timeout,
    })
  }

  /**
   * 映射模型名称
   * 优先级：targetModel > modelMapper > modelMapping > 原模型
   */
  private mapModel(inboundModel?: string): string | undefined {
    // 如果没有入站模型，返回 undefined
    if (!inboundModel) return undefined

    // 1. 如果配置了 targetModel，直接使用
    if (this.targetModel) {
      return this.targetModel
    }

    // 2. 如果配置了 modelMapper 函数，使用函数映射
    if (this.modelMapper) {
      return this.modelMapper(inboundModel)
    }

    // 3. 如果配置了 modelMapping 对象，查找映射
    if (this.modelMapping && this.modelMapping[inboundModel]) {
      return this.modelMapping[inboundModel]
    }

    // 4. 没有配置映射，返回原模型
    return inboundModel
  }

  async chat(request: unknown): Promise<unknown> {
    // Step 1: Inbound adapter parses request → IR
    const ir = this.inboundAdapter.inbound.parseRequest(request)

    // Step 2: Map model if configured
    if (ir.model) {
      ir.model = this.mapModel(ir.model)
    }

    // Step 3: Validate IR (optional)
    if (this.inboundAdapter.validateRequest) {
      const validation = this.inboundAdapter.validateRequest(ir)
      if (!validation.valid) {
        throw new Error(
          `Invalid request: ${validation.errors?.join(', ') ?? 'Unknown error'}`
        )
      }
    }

    // Step 4: Outbound adapter builds provider request from IR
    const providerRequest = this.outboundAdapter.outbound.buildRequest(ir)

    // ... 其余代码保持不变
  }

  async *chatStream(request: unknown): AsyncIterable<unknown> {
    // Step 1: Inbound adapter parses request → IR
    const ir = this.inboundAdapter.inbound.parseRequest(request)

    // Step 2: Map model if configured
    if (ir.model) {
      ir.model = this.mapModel(ir.model)
    }

    // Ensure streaming is enabled
    ir.stream = true

    // ... 其余代码保持不变
  }
}
```

### 类型定义

```typescript
// packages/core/src/bridge/types.ts
export interface BridgeOptions {
  /**
   * 入站适配器 - 解析入站请求格式
   */
  inbound: LLMAdapter

  /**
   * 出站适配器 - 构建出站请求格式
   */
  outbound: LLMAdapter

  /**
   * Bridge 配置
   */
  config: BridgeConfig

  /**
   * 固定目标模型（优先级最高）
   * 如果设置，将忽略入站模型，总是使用此模型
   */
  targetModel?: string

  /**
   * 模型映射函数（优先级第二）
   * 接收入站模型名称，返回出站模型名称
   */
  modelMapper?: (inboundModel: string) => string

  /**
   * 模型映射表（优先级第三）
   * 键为入站模型名称，值为出站模型名称
   */
  modelMapping?: {
    [inboundModel: string]: string
  }
}
```

## 文档更新

需要在文档中说明：

1. 模型映射的工作原理
2. 默认映射表
3. 如何自定义映射
4. 不同策略的优缺点
5. 最佳实践

## 测试用例

```typescript
describe('Model Mapping', () => {
  it('should map gpt-4 to claude-3-5-sonnet', () => {
    const mapper = new ModelMapper()
    const result = mapper.map('openai', 'gpt-4', 'anthropic')
    expect(result).toBe('claude-3-5-sonnet-20241022')
  })

  it('should use custom mapping', () => {
    const mapper = new ModelMapper({
      openai: {
        'gpt-4': { anthropic: 'claude-3-opus-20240229' }
      }
    })
    const result = mapper.map('openai', 'gpt-4', 'anthropic')
    expect(result).toBe('claude-3-opus-20240229')
  })

  it('should fallback to original model if no mapping found', () => {
    const mapper = new ModelMapper()
    const result = mapper.map('openai', 'unknown-model', 'anthropic')
    expect(result).toBe('unknown-model')
  })
})
```

## 总结

**当前状态**: ❌ 没有模型映射，用户必须知道目标模型名称

**推荐方案**:
1. 短期：实现显式指定（方案 3）
2. 中期：实现自动映射（方案 1）
3. 长期：实现能力匹配（方案 2）

这样可以让 LLM Bridge 真正做到"透明转换"，用户不需要关心底层调用的是哪个提供商。
