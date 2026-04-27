/**
 * CLI 代理处理器（V2 架构）
 * 
 * 处理 Claude Code 和 Codex 的代理请求
 * 支持热切换、模型映射、多 CLI 独立管理
 */

import { randomUUID } from 'crypto'
import { Bridge } from '@amux.ai/llm-bridge'
import type { FastifyRequest, FastifyReply } from 'fastify'

import { CliType, getCliDefinition } from '../../types/cli'
import { getCliCodeSwitchCache, type CachedCliConfig } from '../cli-switch/cache'
import { getAdapter, setBridgeUsage, getBridgeUsage } from './bridge-manager'
import { ProxyErrorCode } from './types'
import { createErrorResponse } from './utils'
import { logRequest } from '../logger'
import { recordRequest as recordMetrics } from '../metrics'

interface ChatRequestBody {
  model?: string
  stream?: boolean
  thinking?: { type?: string; budget_tokens?: number }
  effort?: string // Claude 4.6+ adaptive thinking
  system?: string | unknown[]
  messages?: unknown[]
  [key: string]: unknown
}

/**
 * 解析目标模型（应用映射规则）
 * 
 * 优先级：
 * 1. Reasoning 模型（检测 thinking、effort 或复杂 system 提示）
 * 2. Exact 映射
 * 3. Family 映射（关键词匹配）
 * 4. Default 模型
 * 5. 原始模型（兜底）
 */
function resolveTargetModel(
  requestModel: string,
  body: ChatRequestBody,
  cached: CachedCliConfig
): string {
  // 1. Reasoning 模型检测
  // Claude 3.7+: thinking.type = 'enabled' | 'adaptive' 
  // Claude 4.6+: effort = 'max' | 'high' | 'medium' | 'low'
  const hasThinking =
    body?.thinking?.type === 'enabled' || 
    body?.thinking?.type === 'adaptive' ||
    (body?.effort && ['max', 'high', 'medium', 'low'].includes(body.effort))
  
  // 复杂的 system prompt 也可能需要推理模型
  const hasComplexSystemPrompt = 
    body?.system && typeof body.system === 'string' && body.system.length > 500

  if ((hasThinking || hasComplexSystemPrompt) && cached.reasoningModel) {
    return cached.reasoningModel
  }

  // 2. Exact 映射
  if (cached.exactMappings.has(requestModel)) {
    return cached.exactMappings.get(requestModel)!
  }

  // 3. Family 映射（关键词匹配）
  const lowerModel = requestModel.toLowerCase()
  for (const fm of cached.familyMappings) {
    if (fm.keywords.some((kw) => lowerModel.includes(kw.toLowerCase()))) {
      return fm.targetModel
    }
  }

  // 4. Default 模型
  if (cached.defaultModel) {
    return cached.defaultModel
  }

  // 5. 兜底：使用原始模型
  return requestModel
}

/**
 * 处理 CLI 代理请求（通用处理器）
 */
export async function handleCliProxy(
  request: FastifyRequest,
  reply: FastifyReply,
  cliType: CliType
): Promise<void> {
  const requestId = randomUUID()
  const startTime = Date.now()
  const cliDef = getCliDefinition(cliType)

  console.log(`\n[CLI Proxy ${cliType}] 📨 Incoming request`)
  console.log(`[CLI Proxy ${cliType}]   - Request ID: ${requestId}`)
  console.log(`[CLI Proxy ${cliType}]   - URL: ${request.url}`)

  try {
    // 1. 获取 CLI 配置（从缓存）
    const cached = getCliCodeSwitchCache(cliType)
    if (!cached || !cached.enabled) {
      return reply.status(503).send(
        createErrorResponse(
          ProxyErrorCode.CONFIGURATION_ERROR,
          `${cliDef.displayName} Code Switch 未启用`
        )
      )
    }

    if (!cached.providerId || !cached.providerApiKey) {
      return reply.status(503).send(
        createErrorResponse(
          ProxyErrorCode.CONFIGURATION_ERROR,
          '未配置供应商或 API key'
        )
      )
    }

    console.log(`[CLI Proxy ${cliType}]   - Provider: ${cached.providerName} (${cached.providerAdapterType})`)

    // 2. 解析请求体
    const body = (request.body as ChatRequestBody) || {}
    const originalModel = body.model || 'unknown'
    const isStreaming = body.stream === true

    console.log(`[CLI Proxy ${cliType}]   - Original Model: ${originalModel}`)
    console.log(`[CLI Proxy ${cliType}]   - Streaming: ${isStreaming}`)

    // 3. 应用模型映射
    const targetModel = resolveTargetModel(originalModel, body, cached)
    if (targetModel !== originalModel) {
      console.log(`[CLI Proxy ${cliType}]   - Mapped Model: ${originalModel} → ${targetModel}`)
    }

    // 4. 获取 inbound 和 outbound adapter
    const inboundAdapter = getInboundAdapter(cliType)
    const outboundAdapter = getAdapter(cached.providerAdapterType || 'openai')

    // 5. 创建 Bridge（带 hooks 捕获 token usage）
    const bridge = new Bridge({
      inbound: inboundAdapter,
      outbound: outboundAdapter,
      config: {
        apiKey: cached.providerApiKey || '',
        baseURL: cached.providerBaseUrl || undefined,
      },
      hooks: {
        onResponse: async (ir) => {
          if (ir.usage) {
            setBridgeUsage(bridge, ir.usage)
          }
        },
        onStreamEvent: async (event) => {
          if (event.type === 'end' && event.usage) {
            setBridgeUsage(bridge, event.usage)
          }
        },
      },
    })

    // 6. 修改请求体的模型
    const modifiedBody = {
      ...body,
      model: targetModel,
    }

    // 7. 处理请求
    if (isStreaming) {
      await handleStreamRequest(
        bridge,
        modifiedBody,
        reply,
        requestId,
        cliType,
        cached,
        originalModel,
        targetModel,
        startTime
      )
    } else {
      await handleNonStreamRequest(
        bridge,
        modifiedBody,
        reply,
        requestId,
        cliType,
        cached,
        originalModel,
        targetModel,
        startTime
      )
    }
  } catch (error) {
    const latency = Date.now() - startTime
    console.error(`[CLI Proxy ${cliType}] ❌ Error:`, error)

    // 记录错误日志
    logRequest({
      proxyPath: cliDef.proxyEndpoint,
      sourceModel: 'unknown',
      targetModel: 'unknown',
      statusCode: 500,
      latencyMs: latency,
      error: error instanceof Error ? error.message : String(error),
      source: 'local',
    })

    return reply.status(500).send(
      createErrorResponse(
        ProxyErrorCode.INTERNAL_ERROR,
        error instanceof Error ? error.message : '未知错误'
      )
    )
  }
}

/**
 * 处理流式请求
 */
async function handleStreamRequest(
  bridge: Bridge,
  body: ChatRequestBody,
  reply: FastifyReply,
  _requestId: string,
  cliType: CliType,
  cached: CachedCliConfig,
  originalModel: string,
  targetModel: string,
  startTime: number
): Promise<void> {
  console.log(`[CLI Proxy ${cliType}] 🌊 Handling stream request`)

  reply.raw.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no',
  })

  let streamError: string | undefined

  try {
    const stream = await bridge.chatStream(body)

    for await (const event of stream) {
      // SSEEvent 结构：{ event: string, data: unknown }
      const sseEvent = event as { event?: string; data?: unknown; type?: string }
      
      // 根据 CLI 类型格式化 SSE 事件
      if (cliType === CliType.ClaudeCode) {
        // Claude Code 格式：event: xxx\ndata: {...}\n\n
        const eventType = sseEvent.event || sseEvent.type || 'message'
        const eventData = sseEvent.data || sseEvent
        reply.raw.write(`event: ${eventType}\ndata: ${JSON.stringify(eventData)}\n\n`)
      } else {
        // OpenAI 格式（Codex）：data: {...}\n\n
        const eventData = sseEvent.data || sseEvent
        reply.raw.write(`data: ${JSON.stringify(eventData)}\n\n`)
      }
    }

    reply.raw.end()
    streamError = undefined
  } catch (error) {
    streamError = error instanceof Error ? error.message : String(error)
    console.error(`[CLI Proxy ${cliType}] ❌ Stream error:`, error)

    if (!reply.raw.headersSent) {
      reply.status(500).send(
        createErrorResponse(
          ProxyErrorCode.INTERNAL_ERROR,
          error instanceof Error ? error.message : '流式请求失败'
        )
      )
    } else {
      reply.raw.end()
    }
  } finally {
    const latency = Date.now() - startTime
    const usage = getBridgeUsage(bridge)

    console.log(`[CLI Proxy ${cliType}] Stream finished`)
    console.log(`[CLI Proxy ${cliType}]   - Latency: ${latency}ms`)
    console.log(`[CLI Proxy ${cliType}]   - Tokens: ${usage?.promptTokens || 0} + ${usage?.completionTokens || 0}`)
    console.log(`[CLI Proxy ${cliType}]   - Error: ${streamError || 'none'}`)

    // 记录日志
    logRequest({
      proxyPath: getCliDefinition(cliType).proxyEndpoint,
      sourceModel: originalModel,
      targetModel,
      statusCode: streamError ? 500 : 200,
      inputTokens: usage?.promptTokens || 0,
      outputTokens: usage?.completionTokens || 0,
      latencyMs: latency,
      error: streamError,
      source: 'local',
    })

    // 记录指标
    if (!streamError) {
      recordMetrics(
        cached.providerId!,
        cached.providerId!,
        true,
        latency,
        usage?.promptTokens || 0,
        usage?.completionTokens || 0
      )
    }
  }
}

/**
 * 处理非流式请求
 */
async function handleNonStreamRequest(
  bridge: Bridge,
  body: ChatRequestBody,
  reply: FastifyReply,
  _requestId: string,
  cliType: CliType,
  cached: CachedCliConfig,
  originalModel: string,
  targetModel: string,
  startTime: number
): Promise<void> {
  console.log(`[CLI Proxy ${cliType}] 📝 Handling non-stream request`)

  let response: unknown
  let requestError: string | undefined

  try {
    response = await bridge.chat(body)
    return reply.status(200).send(response)
  } catch (error) {
    requestError = error instanceof Error ? error.message : String(error)
    console.error(`[CLI Proxy ${cliType}] ❌ Request error:`, error)

    reply.status(500).send(
      createErrorResponse(
        ProxyErrorCode.INTERNAL_ERROR,
        error instanceof Error ? error.message : '请求失败'
      )
    )
  } finally {
    const latency = Date.now() - startTime
    const usage = getBridgeUsage(bridge)

    console.log(`[CLI Proxy ${cliType}] Request finished`)
    console.log(`[CLI Proxy ${cliType}]   - Latency: ${latency}ms`)
    console.log(`[CLI Proxy ${cliType}]   - Tokens: ${usage?.promptTokens || 0} + ${usage?.completionTokens || 0}`)
    console.log(`[CLI Proxy ${cliType}]   - Error: ${requestError || 'none'}`)

    // 记录日志
    logRequest({
      proxyPath: getCliDefinition(cliType).proxyEndpoint,
      sourceModel: originalModel,
      targetModel,
      statusCode: requestError ? 500 : 200,
      inputTokens: usage?.promptTokens || 0,
      outputTokens: usage?.completionTokens || 0,
      latencyMs: latency,
      error: requestError,
      source: 'local',
    })

    // 记录指标
    if (!requestError) {
      recordMetrics(
        cached.providerId!,
        cached.providerId!,
        true,
        latency,
        usage?.promptTokens || 0,
        usage?.completionTokens || 0
      )
    }
  }
}

/**
 * 获取 inbound adapter（根据 CLI 类型）
 */
function getInboundAdapter(cliType: CliType) {
  if (cliType === CliType.ClaudeCode) {
    return getAdapter('anthropic')
  } else if (cliType === CliType.Codex) {
    // Codex 使用 OpenAI 兼容格式
    return getAdapter('openai')
  }
  throw new Error(`不支持的 CLI 类型: ${cliType}`)
}
