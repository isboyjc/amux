import { randomUUID } from 'node:crypto'

import type { FastifyRequest, FastifyReply } from 'fastify'

import type { OAuthTranslator } from '../types'
import { getOAuthLogger } from '../logger'
import { getOAuthPoolManager } from '../pool-manager'

import { CodexRequestTransformer } from './request-transformer'
import { CodexResponseTransformer } from './response-transformer'

/**
 * Codex API 错误（保留原始状态码和错误详情）
 */
class CodexAPIError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public errorBody: any
  ) {
    super(message)
    this.name = 'CodexAPIError'
  }
}

/**
 * Codex OAuth 转换服务
 * 标准 OpenAI 格式 ↔ Codex 特殊格式
 */
export class CodexTranslator implements OAuthTranslator {
  standardAdapterType = 'openai'
  
  private requestTransformer = new CodexRequestTransformer()
  private responseTransformer = new CodexResponseTransformer()
  private poolManager = getOAuthPoolManager()
  private logger = getOAuthLogger()
  
  private readonly CODEX_API_URL = 'https://chatgpt.com/backend-api/codex/responses'
  
  async handle(
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<void> {
    const openaiRequest = request.body as any
    
    // 1. 验证请求
    if (!openaiRequest || !openaiRequest.messages) {
      reply.status(400).send({
        error: {
          message: 'Invalid request: messages are required',
          type: 'invalid_request_error'
        }
      })
      return
    }
    
    // 2. 转换为 Codex 格式
    const codexRequest = this.requestTransformer.transform(openaiRequest)
    const isStream = codexRequest.stream !== false
    
    // 3. 使用 Pool Manager 的通用重试机制执行请求
    try {
      await this.poolManager.executeWithRetry('codex', async (selection) => {
        const startTime = Date.now()
        const accountId = selection.account.id
        const model = openaiRequest.model
        
        // ⚠️ 检查 reply 状态：如果已经开始响应，无法重试
        const wasHeadersSent = reply.raw.headersSent
        if (wasHeadersSent) {
          console.error(`[CodexTranslator] ❌ Cannot retry: HTTP response already started`)
          throw new Error('Cannot retry: HTTP response already started')
        }
        
        try {
          // 执行请求（流式或非流式）
          if (isStream) {
            await this.handleStreamRequest(
              codexRequest,
              selection.accessToken,
              selection.metadata,
              reply,
              accountId,
              model,
              startTime
            )
          } else {
            await this.handleNonStreamRequest(
              codexRequest,
              selection.accessToken,
              selection.metadata,
              reply,
              accountId,
              model,
              startTime
            )
          }
          
          // 返回 void 表示成功（Pool Manager 会记录成功账号）
        } catch (error) {
          const latency = Date.now() - startTime
          
          // 记录失败统计
          await this.logRequest({
            accountId,
            success: false,
            errorMessage: (error as Error).message,
            latencyMs: latency,
            model
          })
          
          // ⚠️ 检查是否真正开始了流式传输（不只是关闭连接）
          const isHeadersSentAfterError = reply.raw.headersSent
          const wasStreamStarted = wasHeadersSent !== isHeadersSentAfterError
          
          // 如果流式传输真正开始了（headers 从 false 变成 true），不要重试
          if (wasStreamStarted && isHeadersSentAfterError) {
            // 不重新抛出错误，让响应正常完成
            return
          }
          
          // 重新抛出错误，让 Pool Manager 处理重试
          throw error
        }
      })
    } catch (error) {
      // ⚠️ 只在 headers 未发送时才能设置状态码
      if (!reply.raw.headersSent) {
        // 🔄 透传原始错误码和错误详情
        if (error instanceof CodexAPIError) {
          reply.status(error.statusCode).send({
            error: error.errorBody?.error || {
              message: error.message,
              type: 'codex_api_error'
            }
          })
        } else {
          // 非 API 错误（如网络错误、所有账号都失败等）
          reply.status(502).send({
            error: {
              message: (error as Error).message || 'All retry attempts failed',
              type: 'oauth_pool_exhausted'
            }
          })
        }
      }
    }
  }
  
  /**
   * 处理流式请求
   * 
   * 注意：流式响应一旦开始传输（设置 SSE headers），就无法重试。
   * 重试只适用于请求前的错误（429、401、网络错误等）。
   * 空响应虽然不理想，但会正常完成传输并记录为失败。
   */
  private async handleStreamRequest(
    codexRequest: any,
    accessToken: string,
    metadata: Record<string, unknown>,
    reply: FastifyReply,
    accountId: string,
    model: string,
    startTime: number
  ): Promise<void> {
    // ✅ 标志：是否真正开始了流式传输
    let streamStarted = false
    
    try {
      // 构建 Codex 请求 headers
      const headers = this.buildCodexHeaders(accessToken, metadata)
      
      // 调用 Codex API
      const response = await fetch(this.CODEX_API_URL, {
        method: 'POST',
        headers,
        body: JSON.stringify(codexRequest)
      })
      
      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unable to read error body')
        let errorBody: any
        try {
          errorBody = JSON.parse(errorText)
        } catch {
          errorBody = { error: { message: errorText, type: 'unknown' } }
        }
        
        // 🔄 抛出包含原始状态码的错误
        throw new CodexAPIError(
          `Codex API error: ${response.status} ${response.statusText}`,
          response.status,
          errorBody
        )
      }
      
      // ✅ 只有在请求成功后才设置 SSE headers
      reply.raw.setHeader('Content-Type', 'text/event-stream')
      reply.raw.setHeader('Cache-Control', 'no-cache')
      reply.raw.setHeader('Connection', 'keep-alive')
      
      // ✅ 标记：流式传输已开始
      streamStarted = true
      
      if (!response.body) {
        throw new Error('Codex API returned no body')
      }
      
      // 处理 SSE 流
      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      let totalInputTokens = 0
      let totalOutputTokens = 0
      
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const { done, value } = await reader.read()
        
        if (done) {
          break
        }
        
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6).trim()
            
            if (data === '[DONE]') {
              continue
            }
            
            try {
              const codexEvent = JSON.parse(data)
              const openaiChunk = this.responseTransformer.transformStreamChunk(codexEvent)
              
              if (openaiChunk) {
                // 收集 usage 信息
                if (openaiChunk.usage) {
                  totalInputTokens = openaiChunk.usage.prompt_tokens || 0
                  totalOutputTokens = openaiChunk.usage.completion_tokens || 0
                }
                
                // 发送 OpenAI 格式的 chunk
                reply.raw.write(`data: ${JSON.stringify(openaiChunk)}\n\n`)
              }
            } catch (parseError) {
              // Skip invalid JSON
            }
          }
        }
      }
      
      // 发送结束标记
      reply.raw.write('data: [DONE]\n\n')
      reply.raw.end()
      
      // 记录日志
      const latency = Date.now() - startTime
      const success = totalOutputTokens > 0
      
      await this.logRequest({
        accountId,
        success,
        inputTokens: totalInputTokens,
        outputTokens: totalOutputTokens,
        latencyMs: latency,
        model,
        errorMessage: success ? undefined : 'Empty response from API'
      })
      
    } catch (error) {
      // ✅ 只有在真正开始流式传输后才关闭连接
      if (streamStarted && !reply.raw.writableEnded) {
        reply.raw.end()
      }
      
      throw error
    }
  }
  
  /**
   * 处理非流式请求
   */
  private async handleNonStreamRequest(
    codexRequest: any,
    accessToken: string,
    metadata: Record<string, unknown>,
    reply: FastifyReply,
    accountId: string,
    model: string,
    startTime: number
  ): Promise<void> {
    // 构建 Codex 请求 headers
    const headers = this.buildCodexHeaders(accessToken, metadata)
    
    // 调用 Codex API
    const response = await fetch(this.CODEX_API_URL, {
      method: 'POST',
      headers,
      body: JSON.stringify(codexRequest)
    })
    
    if (!response.ok) {
      const errorText = await response.text()
      let errorBody: any
      try {
        errorBody = JSON.parse(errorText)
      } catch {
        errorBody = { error: { message: errorText, type: 'unknown' } }
      }
      
      // 🔄 抛出包含原始状态码的错误
      throw new CodexAPIError(
        `Codex API error: ${response.status} ${response.statusText}`,
        response.status,
        errorBody
      )
    }
    
    const codexResponse = await response.json()
    
    // 转换为 OpenAI 格式
    const openaiResponse = this.responseTransformer.transformNonStream(codexResponse)
    
    // ✅ 检测空响应
    const outputTokens = openaiResponse.usage?.completion_tokens || 0
    
    if (outputTokens === 0) {
      throw new Error('Empty response from API')
    }
    
    // 记录日志
    const latency = Date.now() - startTime
    await this.logRequest({
      accountId,
      success: true,
      inputTokens: openaiResponse.usage?.prompt_tokens,
      outputTokens,
      latencyMs: latency,
      model
    })
    
    reply.send(openaiResponse)
  }
  
  /**
   * 构建 Codex 请求 Headers
   */
  private buildCodexHeaders(
    accessToken: string,
    metadata: Record<string, unknown>
  ): Record<string, string> {
    // 生成 session ID
    const sessionId = randomUUID()
    
    const headers: Record<string, string> = {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'Version': '0.21.0',
      'Openai-Beta': 'responses=experimental',
      'User-Agent': 'codex_cli_rs/0.50.0 (Mac OS 26.0.1; arm64) Apple_Terminal/464',
      'Accept': 'text/event-stream',
      'Connection': 'Keep-Alive',
      'Originator': 'codex_cli_rs',
      'Session_id': sessionId,
      'Conversation_id': sessionId // Must be the same as Session_id
    }
    
    // 添加可选的 account_id header
    if (metadata.account_id) {
      headers['Chatgpt-Account-Id'] = String(metadata.account_id)
    }
    
    return headers
  }
  
  /**
   * 记录请求日志
   */
  private async logRequest(params: {
    accountId: string
    success: boolean
    inputTokens?: number
    outputTokens?: number
    latencyMs?: number
    model?: string
    errorMessage?: string
  }): Promise<void> {
    // 聚合统计
    await this.logger.logRequest({
      accountId: params.accountId,
      providerType: 'codex',
      success: params.success,
      inputTokens: params.inputTokens,
      outputTokens: params.outputTokens
    })
    
    // 详细日志（用于调试和分析）
    if (params.latencyMs || params.errorMessage) {
      await this.logger.logDetailedRequest({
        accountId: params.accountId,
        providerType: 'codex',
        model: params.model,
        success: params.success,
        inputTokens: params.inputTokens,
        outputTokens: params.outputTokens,
        latencyMs: params.latencyMs,
        errorMessage: params.errorMessage
      })
    }
  }
}
