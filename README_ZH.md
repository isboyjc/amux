# Amux

> 双向 LLM API 适配器 - 用于在不同 LLM 提供商 API 之间转换的统一基础设施

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue)](https://www.typescriptlang.org/)
[![pnpm](https://img.shields.io/badge/pnpm-8.15-orange)](https://pnpm.io/)

[English](./README.md) | [中文](./README_ZH.md)

## 特性

- **双向转换**: 可以在任意 LLM 提供商 API 格式之间转换
- **类型安全**: 完整的 TypeScript 支持和全面的类型定义
- **可扩展**: 轻松为新提供商添加自定义适配器
- **零依赖**: 核心包无运行时依赖
- **测试完善**: 高测试覆盖率的综合测试套件
- **Tree-Shakable**: 针对现代打包工具优化
- **8 个官方适配器**: OpenAI、Anthropic、DeepSeek、Moonshot、Zhipu、Qwen、Gemini、MiniMax

## 快速开始

### 安装

```bash
# 安装核心包和所需的适配器
pnpm add @amux.ai/llm-bridge @amux.ai/adapter-openai @amux.ai/adapter-anthropic
```

### 基本用法

```typescript
import { createBridge } from '@amux.ai/llm-bridge'
import { openaiAdapter } from '@amux.ai/adapter-openai'
import { anthropicAdapter } from '@amux.ai/adapter-anthropic'

// 创建桥接: OpenAI 格式输入 → Anthropic API 输出
const bridge = createBridge({
  inbound: openaiAdapter,
  outbound: anthropicAdapter,
  config: {
    apiKey: process.env.ANTHROPIC_API_KEY,
    baseURL: 'https://api.anthropic.com'
  }
})

// 发送 OpenAI 格式请求，获得 OpenAI 格式响应
// 但实际上在后台调用的是 Claude API
const response = await bridge.chat({
  model: 'gpt-4',
  messages: [{ role: 'user', content: '你好!' }]
})

console.log(response.choices[0].message.content)
```

## 包列表

| 包 | 描述 | 版本 | 状态 |
|---------|-------------|---------|--------|
| [@amux.ai/llm-bridge](./packages/llm-bridge) | 核心 IR 和适配器接口 | - | 稳定 |
| [@amux.ai/adapter-openai](./packages/adapter-openai) | OpenAI 适配器 | - | 稳定 |
| [@amux.ai/adapter-anthropic](./packages/adapter-anthropic) | Anthropic (Claude) 适配器 | - | 稳定 |
| [@amux.ai/adapter-deepseek](./packages/adapter-deepseek) | DeepSeek 适配器 | - | 稳定 |
| [@amux.ai/adapter-moonshot](./packages/adapter-moonshot) | Moonshot (Kimi) 适配器 | - | 稳定 |
| [@amux.ai/adapter-zhipu](./packages/adapter-zhipu) | 智谱 AI (GLM) 适配器 | - | 稳定 |
| [@amux.ai/adapter-qwen](./packages/adapter-qwen) | Qwen 适配器 | - | 稳定 |
| [@amux.ai/adapter-google](./packages/adapter-google) | Google Gemini 适配器 | - | 稳定 |
| [@amux.ai/adapter-minimax](./packages/adapter-minimax) | MiniMax 适配器 | - | 稳定 |
| [@amux.ai/utils](./packages/utils) | 共享工具库 | - | 稳定 |

## 架构

```
┌─────────────────────────────────────────────────────────┐
│                    你的应用程序                           │
└────────────────────┬────────────────────────────────────┘
                     │ OpenAI 格式请求
                     ▼
┌─────────────────────────────────────────────────────────┐
│                   入站适配器                             │
│              (解析 OpenAI → IR)                         │
└────────────────────┬────────────────────────────────────┘
                     │ 中间表示 (IR)
                     ▼
┌─────────────────────────────────────────────────────────┐
│                      桥接层                              │
│         (验证与兼容性检查)                               │
└────────────────────┬────────────────────────────────────┘
                     │ IR
                     ▼
┌─────────────────────────────────────────────────────────┐
│                   出站适配器                             │
│              (IR → 构建 Anthropic 请求)                  │
└────────────────────┬────────────────────────────────────┘
                     │ Anthropic 格式请求
                     ▼
┌─────────────────────────────────────────────────────────┐
│                  Anthropic API                           │
└─────────────────────────────────────────────────────────┘
```

## 使用场景

- **多提供商支持**: 构建支持多个 LLM 提供商的应用程序
- **提供商迁移**: 轻松从一个提供商迁移到另一个
- **成本优化**: 根据成本/性能将请求路由到不同提供商
- **降级策略**: 实现自动降级到备用提供商
- **测试**: 无需更改代码即可使用不同提供商测试应用程序

## 示例

### 所有适配器

```typescript
import { createBridge } from '@amux.ai/llm-bridge'
import { openaiAdapter } from '@amux.ai/adapter-openai'
import { anthropicAdapter } from '@amux.ai/adapter-anthropic'
import { deepseekAdapter } from '@amux.ai/adapter-deepseek'
import { moonshotAdapter } from '@amux.ai/adapter-moonshot'
import { qwenAdapter } from '@amux.ai/adapter-qwen'
import { geminiAdapter } from '@amux.ai/adapter-google'

// OpenAI → Anthropic
const bridge1 = createBridge({
  inbound: openaiAdapter,
  outbound: anthropicAdapter,
  config: { apiKey: process.env.ANTHROPIC_API_KEY }
})

// Anthropic → DeepSeek
const bridge2 = createBridge({
  inbound: anthropicAdapter,
  outbound: deepseekAdapter,
  config: { apiKey: process.env.DEEPSEEK_API_KEY }
})

// 任意组合都可以工作!
```

### 流式响应

```typescript
const bridge = createBridge({
  inbound: openaiAdapter,
  outbound: anthropicAdapter,
  config: { apiKey: process.env.ANTHROPIC_API_KEY }
})

for await (const chunk of bridge.chatStream({
  model: 'gpt-4',
  messages: [{ role: 'user', content: '给我讲个故事' }],
  stream: true
})) {
  console.log(chunk)
}
```

### 函数调用

```typescript
const response = await bridge.chat({
  model: 'gpt-4',
  messages: [{ role: 'user', content: '旧金山的天气怎么样?' }],
  tools: [{
    type: 'function',
    function: {
      name: 'get_weather',
      description: '获取当前天气',
      parameters: {
        type: 'object',
        properties: {
          location: { type: 'string' }
        },
        required: ['location']
      }
    }
  }]
})
```

## Amux Desktop

Amux 还提供了**桌面应用程序**，将所有桥接功能带入可视化界面。

### 功能特性

- **提供商管理**: 使用 API 密钥配置和管理多个 LLM 提供商
- **代理管理**: 创建和管理带有模型映射的 API 代理
- **聊天界面**: 直接在应用中测试 LLM 对话
- **OAuth 账户池**: 管理提供商的 OAuth 账户（如 Azure OpenAI）
- **隧道**: 创建 Cloudflare 隧道以实现远程访问
- **仪表盘**: 使用图表查看使用统计和分析
- **Code Switch**: 动态 CLI 配置管理，用于在不同模型配置之间切换
- **本地代理服务器**: 内置 Fastify 服务器用于本地 API 代理

### 下载

从 [Releases](https://github.com/isboyjc/amux/releases) 页面下载最新版本。

### 从源码构建

```bash
# 开发模式
pnpm dev:desktop

# 构建
pnpm build:desktop

# 打包发布
pnpm package:desktop

# 打包特定平台
pnpm package:desktop:mac      # macOS
pnpm package:desktop:win      # Windows
pnpm package:desktop:linux    # Linux
```

## 测试

```bash
# 运行所有测试
pnpm test

# 运行特定包的测试
cd packages/llm-bridge && pnpm test

# 运行带覆盖率的测试
pnpm test:coverage
```

## 开发

```bash
# 安装依赖
pnpm install

# 构建所有包
pnpm build

# 运行示例
cd examples/basic && pnpm start

# 类型检查
pnpm typecheck

# 代码检查
pnpm lint
```

### 发布流程

#### NPM 包

发布 npm 包，请使用手动发布工作流:

```bash
# 1. 添加 changeset (描述你的更改)
pnpm changeset

# 2. 更新版本并生成 CHANGELOG
pnpm changeset:version

# 3. 提交并推送版本更新
git add .
git commit -m "chore: bump package versions"
git push

# 4. 构建包
pnpm --filter "./packages/**" build

# 5. 发布到 npm (需要 npm 登录)
pnpm changeset:publish

# 6. 推送生成的标签
git push --tags
```

#### 桌面应用

发布桌面应用程序:

```bash
# 使用发布脚本 (推荐)
pnpm release

# 或手动创建标签
git tag -a desktop-v0.2.1 -m "Release Desktop v0.2.1"
git push origin desktop-v0.2.1
```

桌面版本发布将自动触发 GitHub Actions 为 macOS、Windows和 Linux 构建安装程序。

## 项目状态

**MVP 已完成!**

- 核心基础设施
- 8 个官方适配器 (OpenAI、Anthropic、DeepSeek、Moonshot、Zhipu、Qwen、Gemini、MiniMax)
- 双向转换
- TypeScript 类型安全
- 单元测试
- 可用的示例
- 桌面应用程序

## 路线图

- 完成所有适配器的流式支持
- 添加更多单元测试 (目标: 80%+ 覆盖率)
- 创建文档网站 (fumadocs)
- 添加集成测试
- 发布到 npm
- 添加更多适配器 (欢迎社区贡献!)

## 贡献

我们欢迎贡献! 请查看我们的 [贡献指南](./CONTRIBUTING.md) 了解更多详情。

## 许可证

MIT © [isboyjc](https://github.com/isboyjc)

## 致谢

本项目灵感来自:
- [Vercel AI SDK](https://sdk.vercel.ai/)

---

**由 Amux 团队用爱制作**
