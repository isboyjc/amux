<div align="center">

# Amux

**This project is no longer maintained and has been archived.**
**本项目已停止维护，仓库已封存。**

Its ideas live on in **[Amux AI](https://amux.ai/?utm_source=github&utm_medium=readme&utm_campaign=amux-legacy)**: one API for every major model, up to 95% off official pricing.

[English](#english) · [简体中文](#简体中文)

</div>

---

## English

Amux was an open-source, bidirectional LLM API adapter: `@amux.ai/llm-bridge`, the `@amux.ai/adapter-*` packages, and a desktop app. It let you call one provider's models through another provider's API format, with the conversion running inside your own code.

Development has stopped. There will be no further fixes, releases, or support.

- **npm packages**: `@amux.ai/llm-bridge`, `@amux.ai/adapter-*`, and `@amux.ai/utils` are deprecated. Published versions remain installable, so existing projects keep working.
- **Desktop app**: discontinued.
- **Source code**: kept here under the MIT License. Forks are welcome.
- **Original documentation**: [README.backup.md](./README.backup.md).

### Amux AI: the same idea, as a hosted gateway

If you used Amux to talk to several providers through one interface, [Amux AI](https://amux.ai/?utm_source=github&utm_medium=readme&utm_campaign=amux-legacy) does that work on the server side. There is no library to install and no adapter to maintain.

- **One API for every major model**: Claude, GPT, Gemini, DeepSeek, Qwen, Kimi, GLM, MiniMax, Grok, plus image and video models.
- **Use the SDK you already have**: OpenAI Chat Completions, OpenAI Responses, Anthropic Messages, and Gemini are implemented natively, along with 10+ protocols in total. Calling Claude with the OpenAI SDK, or Gemini with the Anthropic SDK, works as is.
- **Up to 95% off official pricing**: every provider's price for the same model is listed side by side, and there are no top-up fees.
- **Automatic failover**: when one provider fails, the request moves to the next.
- **Works with your tools**: Claude Code, Codex, Cursor, Cherry Studio, and more need only a new base URL.

```python
from openai import OpenAI

client = OpenAI(base_url="https://gateway.amux.ai/v1", api_key="YOUR_AMUX_KEY")

response = client.chat.completions.create(
    model="anthropic/claude-opus-5",
    messages=[{"role": "user", "content": "Hello"}],
)
```

[Get started](https://amux.ai/docs/quickstart?utm_source=github&utm_medium=readme&utm_campaign=amux-legacy) · [Model catalog and pricing](https://amux.ai/models?utm_source=github&utm_medium=readme&utm_campaign=amux-legacy) · [Tool integrations](https://amux.ai/integrations?utm_source=github&utm_medium=readme&utm_campaign=amux-legacy)

---

## 简体中文

Amux 是一个开源的双向大模型 API 适配库，包括 `@amux.ai/llm-bridge`、`@amux.ai/adapter-*` 系列包和桌面客户端。它可以用一家厂商的 API 格式调用另一家的模型，格式转换在你自己的代码里完成。

项目已停止开发，此后不再提供修复、新版本或技术支持。

- **npm 包**：`@amux.ai/llm-bridge`、`@amux.ai/adapter-*`、`@amux.ai/utils` 均已标记为废弃。已发布的版本仍可安装，现有项目不受影响。
- **桌面客户端**：已停止。
- **源代码**：保留在本仓库，继续以 MIT 协议开放，欢迎 fork。
- **原有文档**：[README.backup.md](./README.backup.md)。

### Amux AI：同一个思路，做成托管网关

如果你用 Amux 是为了通过一套接口调用多家模型，[Amux AI](https://amux.ai/zh?utm_source=github&utm_medium=readme&utm_campaign=amux-legacy) 把这件事放到了服务端：不用装库，也不用维护适配器。

- **一个 API 接入所有主流模型**：Claude、GPT、Gemini、DeepSeek、通义千问、Kimi、GLM、MiniMax、Grok，以及图像和视频模型。
- **沿用现有 SDK**：原生实现 OpenAI Chat Completions、OpenAI Responses、Anthropic Messages、Gemini 等 10+ 种协议。用 OpenAI SDK 调 Claude、用 Anthropic SDK 调 Gemini，都可以直接调用。
- **低至官方价 0.5 折**：同一模型各家供应商的价格并列展示，充值零手续费。
- **自动故障转移**：一家供应商失败时，请求会自动切换到下一家。
- **常用工具开箱即用**：Claude Code、Codex、Cursor、Cherry Studio 等只需改一个 base URL。

代码示例同上。

[快速开始](https://amux.ai/zh/docs/quickstart?utm_source=github&utm_medium=readme&utm_campaign=amux-legacy) · [模型目录与价格](https://amux.ai/zh/models?utm_source=github&utm_medium=readme&utm_campaign=amux-legacy) · [工具接入](https://amux.ai/zh/integrations?utm_source=github&utm_medium=readme&utm_campaign=amux-legacy)
