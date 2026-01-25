export const content = {
  en: {
    hero: {
      badge: 'Open Source',
      title: 'Bidirectional',
      titleHighlight: 'LLM API Adapter',
      description:
        'Freely convert any LLM provider API to another. OpenAI ↔ Claude ↔ DeepSeek ↔ Gemini. One codebase, unlimited flexibility.',
      getStarted: 'Get Started',
      viewDocs: 'Documentation',
      github: 'GitHub',
    },
    painPoints: {
      title: 'The Problem',
      subtitle: 'Dealing with multiple LLM providers is painful',
      items: [
        {
          title: 'Different API Formats',
          description:
            'Each provider has its own request/response format. OpenAI uses messages, Claude uses content blocks.',
        },
        {
          title: 'Vendor Lock-in',
          description:
            'Switching providers means rewriting your entire codebase. Migration takes weeks.',
        },
        {
          title: 'Maintenance Burden',
          description:
            'Supporting multiple providers multiplies your code complexity and testing effort.',
        },
      ],
    },
    solution: {
      title: 'The Solution',
      subtitle: 'Choose your path to LLM freedom',
    },
    products: {
      bridge: {
        badge: 'For Developers',
        title: 'LLM Bridge',
        subtitle: 'SDK for seamless LLM API conversion',
        description:
          'Zero-dependency TypeScript library that converts between any LLM provider format using an Intermediate Representation (IR) pattern.',
        features: [
          'Zero runtime dependencies',
          'Full TypeScript support',
          '7+ official adapters',
          'Streaming & tool calling',
          'Custom adapter support',
          'Battle-tested in production',
        ],
        cta: 'npm install @amux.ai/llm-bridge',
        ctaButton: 'View Documentation',
      },
      desktop: {
        badge: 'For Everyone',
        title: 'Amux Desktop',
        subtitle: 'Local LLM proxy with GUI',
        description:
          'Cross-platform desktop app that runs a local proxy server. Manage API keys, monitor requests, and switch between providers - all without code.',
        features: [
          'Beautiful GUI interface',
          'Local proxy server',
          'API key management',
          'Real-time monitoring',
          'Request logging',
          'Multi-language support',
        ],
        cta: 'Download for',
        ctaButton: 'Download Now',
        platforms: {
          mac: 'macOS',
          windows: 'Windows',
          linux: 'Linux',
        },
      },
    },
    features: {
      title: 'Core Capabilities',
      subtitle: 'Everything you need for LLM integration',
      items: [
        {
          icon: 'arrows',
          title: 'Bidirectional',
          description: 'Convert any format to any other format seamlessly',
        },
        {
          icon: 'feather',
          title: 'Zero Dependencies',
          description: 'Core package has no runtime dependencies',
        },
        {
          icon: 'puzzle',
          title: 'Extensible',
          description: 'Create custom adapters for any provider',
        },
        {
          icon: 'stream',
          title: 'Streaming',
          description: 'Native SSE support for real-time responses',
        },
        {
          icon: 'tool',
          title: 'Tool Calling',
          description: 'Full function/tool calling support across providers',
        },
        {
          icon: 'image',
          title: 'Multimodal',
          description: 'Vision and image support where available',
        },
      ],
    },
    providers: {
      title: 'Supported Providers',
      subtitle: 'And growing...',
    },
    codeExample: {
      title: 'Simple & Intuitive',
      subtitle: 'See how easy it is',
      comment1: '// Use OpenAI format, call Claude API',
      comment2: '// Your existing OpenAI-style code works as-is',
    },
    useCases: {
      title: 'Use Cases',
      subtitle: 'Who benefits from Amux',
      items: [
        {
          icon: 'code',
          title: 'App Developers',
          description:
            'Integrate multiple LLM providers with a single SDK. Switch models without code changes.',
        },
        {
          icon: 'building',
          title: 'Enterprises',
          description:
            'Implement provider failover, optimize costs, and maintain vendor flexibility.',
        },
        {
          icon: 'flask',
          title: 'Researchers',
          description:
            'Compare models easily. Run the same prompts across different providers for benchmarking.',
        },
      ],
    },
    cta: {
      title: 'Ready to simplify your LLM integration?',
      subtitle: 'Get started in minutes with our SDK or Desktop app',
      primary: 'Read the Docs',
      secondary: 'View on GitHub',
    },
    footer: {
      product: 'Product',
      docs: 'Documentation',
      github: 'GitHub',
      desktop: 'Desktop App',
      resources: 'Resources',
      quickStart: 'Quick Start',
      adapters: 'Adapters',
      apiReference: 'API Reference',
      community: 'Community',
      discord: 'Discord',
      twitter: 'Twitter',
      issues: 'Issues',
      copyright: '© 2024 Amux. Open source under MIT License.',
    },
  },
  zh: {
    hero: {
      badge: '开源项目',
      title: '双向转换',
      titleHighlight: '任意大模型 API',
      description:
        '自由地将一个大模型厂商的 API 转换成另一个。OpenAI ↔ Claude ↔ DeepSeek ↔ Gemini。一次编写，随时切换。',
      getStarted: '开始使用',
      viewDocs: '查看文档',
      github: 'GitHub',
    },
    painPoints: {
      title: '痛点',
      subtitle: '对接多个大模型供应商令人头疼',
      items: [
        {
          title: 'API 格式各异',
          description:
            '每个供应商都有自己的请求/响应格式。OpenAI 用 messages，Claude 用 content blocks。',
        },
        {
          title: '供应商锁定',
          description:
            '切换供应商意味着重写整个代码库。迁移需要数周时间。',
        },
        {
          title: '维护负担',
          description:
            '支持多个供应商会成倍增加代码复杂度和测试工作量。',
        },
      ],
    },
    solution: {
      title: '解决方案',
      subtitle: '选择适合你的方式',
    },
    products: {
      bridge: {
        badge: '面向开发者',
        title: 'LLM Bridge',
        subtitle: '无缝 LLM API 转换 SDK',
        description:
          '零依赖的 TypeScript 库，通过中间表示 (IR) 模式在任意大模型供应商格式之间转换。',
        features: [
          '零运行时依赖',
          '完整 TypeScript 支持',
          '7+ 官方适配器',
          '流式输出 & 函数调用',
          '支持自定义适配器',
          '生产环境验证',
        ],
        cta: 'npm install @amux.ai/llm-bridge',
        ctaButton: '查看文档',
      },
      desktop: {
        badge: '面向所有人',
        title: 'Amux Desktop',
        subtitle: '本地大模型代理客户端',
        description:
          '跨平台桌面应用，运行本地代理服务器。管理 API 密钥、监控请求、切换供应商 - 无需编写代码。',
        features: [
          '精美图形界面',
          '本地代理服务器',
          'API 密钥管理',
          '实时监控面板',
          '请求日志记录',
          '多语言支持',
        ],
        cta: '下载',
        ctaButton: '立即下载',
        platforms: {
          mac: 'macOS',
          windows: 'Windows',
          linux: 'Linux',
        },
      },
    },
    features: {
      title: '核心能力',
      subtitle: '大模型集成所需的一切',
      items: [
        {
          icon: 'arrows',
          title: '双向转换',
          description: '任意格式之间无缝转换',
        },
        {
          icon: 'feather',
          title: '零依赖',
          description: '核心包无运行时依赖',
        },
        {
          icon: 'puzzle',
          title: '可扩展',
          description: '为任意供应商创建自定义适配器',
        },
        {
          icon: 'stream',
          title: '流式输出',
          description: '原生 SSE 支持实时响应',
        },
        {
          icon: 'tool',
          title: '工具调用',
          description: '跨供应商完整支持函数/工具调用',
        },
        {
          icon: 'image',
          title: '多模态',
          description: '支持视觉和图像功能',
        },
      ],
    },
    providers: {
      title: '支持的供应商',
      subtitle: '持续增加中...',
    },
    codeExample: {
      title: '简单直观',
      subtitle: '看看有多简单',
      comment1: '// 使用 OpenAI 格式，调用 Claude API',
      comment2: '// 你现有的 OpenAI 风格代码无需修改',
    },
    useCases: {
      title: '应用场景',
      subtitle: '谁能从 Amux 中受益',
      items: [
        {
          icon: 'code',
          title: '应用开发者',
          description:
            '用单一 SDK 集成多个大模型供应商。切换模型无需修改代码。',
        },
        {
          icon: 'building',
          title: '企业用户',
          description:
            '实现供应商容灾、优化成本、保持供应商灵活性。',
        },
        {
          icon: 'flask',
          title: '研究人员',
          description:
            '轻松对比模型。在不同供应商间运行相同提示词进行基准测试。',
        },
      ],
    },
    cta: {
      title: '准备好简化你的大模型集成了吗？',
      subtitle: '使用 SDK 或桌面应用，几分钟内即可上手',
      primary: '阅读文档',
      secondary: '在 GitHub 查看',
    },
    footer: {
      product: '产品',
      docs: '文档',
      github: 'GitHub',
      desktop: '桌面应用',
      resources: '资源',
      quickStart: '快速开始',
      adapters: '适配器',
      apiReference: 'API 参考',
      community: '社区',
      discord: 'Discord',
      twitter: 'Twitter',
      issues: '问题反馈',
      copyright: '© 2024 Amux. 基于 MIT 协议开源。',
    },
  },
} as const;

export type Locale = keyof typeof content;
export type Content = (typeof content)[Locale];
