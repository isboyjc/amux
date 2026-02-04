/**
 * Antigravity OAuth 转换器
 * 
 * 负责将标准 Google Gemini API 格式的请求转换为 Antigravity 的 v1internal 格式
 * 并将 Antigravity 的响应转回标准格式
 * 
 * 完整请求链路（架构分离）：
 * 1. Provider 配置：
 *    - baseUrl: http://localhost:9527/oauth/antigravity
 *    - chatPath: undefined (使用 Google adapter 默认)
 *    - 实际请求：http://localhost:9527/oauth/antigravity/v1beta/models/gemini-3-flash:streamGenerateContent
 * 
 * 2. OAuth 路由层（oauth/index.ts）：
 *    - 接收标准 Google API 格式：/v1beta/models/{model}:action
 *    - 从 URL 提取模型名和 action
 *    - 将模型名注入请求体
 * 
 * 3. 转换器（本文件）：
 *    - 接收标准 Google Gemini 请求体（带 model 字段）
 *    - 包装为 v1internal 格式
 *    - 使用账号池管理器获取可用 OAuth 账号（支持自动重试）
 *    - 转发到 daily-cloudcode-pa.googleapis.com 或 cloudcode-pa.googleapis.com
 *    - 解包 v1internal 响应，返回标准格式
 */

import type { FastifyRequest, FastifyReply } from 'fastify'
import { getOAuthPoolManager } from '../pool-manager'
import { getOAuthLogger } from '../logger'

interface AntigravityMetadata {
  project_id: string
  subscription_tier?: string
  metadata?: {
    ideType: string
    platform: string
    pluginType: string
  }
}

/**
 * Antigravity转换器
 */
export class AntigravityTranslator {
  private poolManager = getOAuthPoolManager()
  private logger = getOAuthLogger()

  // Antigravity 支持的baseURL (按优先级排序)
  private baseUrls = [
    'https://daily-cloudcode-pa.googleapis.com',
    'https://cloudcode-pa.googleapis.com'
  ]

  /**
   * 处理请求（使用账号池自动重试）
   * 
   * 支持两种格式的请求：
   * 1. 标准 Google API 格式（推荐）：
   *    - URL: /oauth/antigravity/v1beta/models/gemini-3-flash:streamGenerateContent
   *    - 由路由层解析并注入模型名到请求体
   * 
   * 2. 直接 v1internal 格式（兼容）：
   *    - URL: /oauth/antigravity/v1internal:streamGenerateContent
   *    - 请求体需包含 model 字段
   */
  async handle(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      // 1. 解析路径和方法
      const url = new URL(request.url, `http://${request.headers.host}`)
      const pathname = url.pathname
      
      // 支持的端点:
      // 标准格式: /oauth/antigravity/v1beta/models/{model}:streamGenerateContent (由路由层处理)
      // 兼容格式: /oauth/antigravity/v1internal:streamGenerateContent
      const method = pathname.split(':')[1] || 'streamGenerateContent'
      const isStream = method.includes('stream') || method === 'streamGenerateContent'
      
      // 2. 读取请求体
      const requestBody = request.body || {}
      
      // 3. 提取模型名称（从 body 中，已由路由层注入）
      const model = (requestBody as any).model || 'gemini-2.5-flash'

      // 4. 使用账号池执行请求（自动重试和账号轮换）
      await this.poolManager.executeWithRetry('antigravity', async (selection) => {
        const { account, accessToken, metadata } = selection
        const antigravityMeta = metadata as unknown as AntigravityMetadata
        const projectId = antigravityMeta?.project_id || ''
        const startTime = Date.now()

        // 包装请求体
        const wrappedBody = this.wrapRequestBody(requestBody, projectId, antigravityMeta)

        // 尝试不同的baseURL
        let lastError: any = null
        
        console.log(`[AntigravityTranslator] Starting request with ${this.baseUrls.length} base URLs`)
        console.log(`[AntigravityTranslator] Request body model: ${model}`)
        console.log(`[AntigravityTranslator] Method: ${method}`)
        console.log(`[AntigravityTranslator] Access token length: ${accessToken.length}`)
        
        for (const baseUrl of this.baseUrls) {
          try {
            const upstreamUrl = `${baseUrl}/v1internal:${method}`
            console.log(`[AntigravityTranslator] Trying baseURL: ${baseUrl}`)
            console.log(`[AntigravityTranslator] Full upstream URL: ${upstreamUrl}`)
            
            // 构建请求头
            const headers: Record<string, string> = {
              'Authorization': `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
              'User-Agent': 'antigravity/1.104.0 darwin/arm64',
              'X-Goog-Api-Client': 'google-cloud-sdk vscode_cloudshelleditor/0.1'
            }

            // 添加Client-Metadata
            if (antigravityMeta?.metadata) {
              headers['Client-Metadata'] = JSON.stringify(antigravityMeta.metadata)
            }

            // 如果是stream请求，添加alt=sse参数
            const queryParams = isStream ? '?alt=sse' : ''
            const finalUrl = `${upstreamUrl}${queryParams}`
            
            console.log(`[AntigravityTranslator] 🚀 Sending request to: ${finalUrl}`)
            console.log(`[AntigravityTranslator] 📦 Wrapped body keys: ${Object.keys(wrappedBody).join(', ')}`)

            // 发送请求
            const response = await fetch(finalUrl, {
              method: 'POST',
              headers,
              body: JSON.stringify(wrappedBody)
            })
            
            console.log(`[AntigravityTranslator] ✅ Received response: ${response.status}`)

            // 检查响应状态
            if (!response.ok) {
              const errorBody = await response.text()
              
              // 如果是429或5xx错误，尝试下一个baseURL
              if (response.status === 429 || response.status >= 500) {
                lastError = {
                  status: response.status,
                  body: errorBody
                }
                console.warn(`[AntigravityTranslator] Request failed with ${response.status} on ${baseUrl}, trying fallback...`)
                continue
              }

              // 其他错误（如400, 401, 403）抛出异常，触发账号轮换
              const error: any = new Error(`Antigravity API error: ${response.status}`)
              error.status = response.status
              error.body = errorBody
              throw error
            }

            // 处理响应
            if (isStream) {
              // 流式响应：解包并转发SSE流
              reply.raw.writeHead(response.status, {
                'Content-Type': 'text/event-stream',
                'Cache-Control': 'no-cache',
                'Connection': 'keep-alive'
              })

              // 收集 token 统计信息
              let promptTokens = 0
              let candidatesTokens = 0
              let _totalTokens = 0

              // 读取并转发流（需要解包 v1internal 的 response 字段）
              if (response.body) {
                const reader = response.body.getReader()
                const decoder = new TextDecoder()
                let buffer = ''

                try {
                  while (true) {
                    const { done, value } = await reader.read()
                    if (done) break

                    buffer += decoder.decode(value, { stream: true })
                    const lines = buffer.split('\n')
                    buffer = lines.pop() || ''

                    for (const line of lines) {
                      if (line.startsWith('data: ')) {
                        const data = line.slice(6)
                        if (data.trim() === '[DONE]') {
                          reply.raw.write('data: [DONE]\n\n')
                          continue
                        }

                        try {
                          const parsed = JSON.parse(data)
                          
                          // 🔧 解包 v1internal 的 response 字段
                          const unwrapped = this.unwrapResponseBody(parsed)
                          
                          // 收集 token 统计（从最后一个包含 usageMetadata 的 chunk）
                          if (unwrapped.usageMetadata) {
                            promptTokens = unwrapped.usageMetadata.promptTokenCount || 0
                            candidatesTokens = unwrapped.usageMetadata.candidatesTokenCount || 0
                            _totalTokens = unwrapped.usageMetadata.totalTokenCount || 0
                          }
                          
                          reply.raw.write(`data: ${JSON.stringify(unwrapped)}\n\n`)
                        } catch (e) {
                          // 如果解析失败，直接转发原始数据
                          reply.raw.write(`data: ${data}\n\n`)
                        }
                      } else if (line.trim()) {
                        // 转发其他非空行（如 event: 等）
                        reply.raw.write(`${line}\n`)
                      }
                    }
                  }

                  // 处理剩余的buffer
                  if (buffer.trim()) {
                    reply.raw.write(buffer)
                  }
                } finally {
                  reader.releaseLock()
                }
              }
              
              reply.raw.end()
              
              // 记录统计（包含 token 信息）
              const latency = Date.now() - startTime
              const success = candidatesTokens > 0
              
              // 聚合统计
              await this.logger.logRequest({
                accountId: account.id,
                providerType: 'antigravity',
                success: success,
                inputTokens: promptTokens,
                outputTokens: candidatesTokens
              })
              
              // 详细日志（用于时间范围查询）
              await this.logger.logDetailedRequest({
                accountId: account.id,
                providerType: 'antigravity',
                model: model,
                success: success,
                inputTokens: promptTokens,
                outputTokens: candidatesTokens,
                latencyMs: latency,
                errorMessage: success ? undefined : 'Empty response from API'
              })
            } else {
              // 非流式响应
              const responseBody = await response.json()
              
              // 解包v1internal响应
              const unwrappedBody = this.unwrapResponseBody(responseBody)
              
              // 提取 token 统计
              const promptTokens = unwrappedBody.usageMetadata?.promptTokenCount || 0
              const candidatesTokens = unwrappedBody.usageMetadata?.candidatesTokenCount || 0
              
              reply.send(unwrappedBody)
              
              // 记录统计（包含 token 信息）
              const latency = Date.now() - startTime
              const success = candidatesTokens > 0
              
              // 聚合统计
              await this.logger.logRequest({
                accountId: account.id,
                providerType: 'antigravity',
                success: success,
                inputTokens: promptTokens,
                outputTokens: candidatesTokens
              })
              
              // 详细日志（用于时间范围查询）
              await this.logger.logDetailedRequest({
                accountId: account.id,
                providerType: 'antigravity',
                model: model,
                success: success,
                inputTokens: promptTokens,
                outputTokens: candidatesTokens,
                latencyMs: latency,
                errorMessage: success ? undefined : 'Empty response from API'
              })
            }

            return // 请求成功，返回
          } catch (error: any) {
            lastError = error
            console.error(`[AntigravityTranslator] ❌ Request error on ${baseUrl}:`)
            console.error(`[AntigravityTranslator] Error type: ${error.constructor.name}`)
            console.error(`[AntigravityTranslator] Error message: ${error.message}`)
            console.error(`[AntigravityTranslator] Error status: ${error.status}`)
            console.error(`[AntigravityTranslator] Full error:`, error)
            
            // 记录失败统计
            const latency = Date.now() - startTime
            await this.logger.logRequest({
              accountId: account.id,
              providerType: 'antigravity',
              success: false,
              inputTokens: 0,
              outputTokens: 0
            })
            
            await this.logger.logDetailedRequest({
              accountId: account.id,
              providerType: 'antigravity',
              model: model,
              success: false,
              inputTokens: 0,
              outputTokens: 0,
              latencyMs: latency,
              errorMessage: error.message || 'Request failed'
            })
            
            // 如果不是网络错误，直接抛出（不继续尝试其他baseURL）
            if (error.status) {
              throw error
            }
            continue
          }
        }

        // 所有baseURL都失败了
        const latency = Date.now() - startTime
        
        // ⚠️ 记录失败到账号统计（重要！）
        await this.logger.logRequest({
          accountId: account.id,
          providerType: 'antigravity',
          success: false,
          inputTokens: 0,
          outputTokens: 0
        })
        
        await this.logger.logDetailedRequest({
          accountId: account.id,
          providerType: 'antigravity',
          model: model,
          success: false,
          inputTokens: 0,
          outputTokens: 0,
          latencyMs: latency,
          errorMessage: `All base URLs failed: ${lastError?.status || 'Unknown'} - ${typeof lastError?.body === 'string' ? lastError.body.substring(0, 200) : lastError?.message}`
        })
        
        const error: any = new Error('All Antigravity base URLs failed')
        error.status = lastError?.status || 502
        error.body = lastError?.body || lastError?.message
        throw error
      })

    } catch (error: any) {
      console.error('[AntigravityTranslator] Handle error:', error)
      
      // 返回错误响应
      const status = error.status || 500
      const errorBody = error.body || error.message || 'Internal server error'
      
      // 尝试解析错误body为JSON
      try {
        const parsedError = JSON.parse(errorBody)
        reply.status(status).send(parsedError)
      } catch {
        // 如果不是JSON，包装为标准错误格式
        reply.status(status).send({
          error: {
            message: errorBody,
            type: 'api_error'
          }
        })
      }
    }
  }

  /**
   * 包装请求体为v1internal格式
   * 
   * v1internal API 格式：
   * {
   *   "project": "project-id",
   *   "requestId": "agent-uuid",
   *   "request": { ...标准 Gemini 请求体... },
   *   "model": "model-name",
   *   "userAgent": "antigravity",
   *   "requestType": "code"
   * }
   */
  private wrapRequestBody(body: any, projectId: string, _metadata?: AntigravityMetadata): any {
    // 1. 生成唯一的 requestId
    const requestId = `agent-${this.generateUUID()}`
    
    // 2. 提取模型名称
    const model = body.model || 'gemini-2.5-flash'
    
    // 3. 确定请求类型（默认为 'code'）
    const requestType = 'code'
    
    // 4. 移除 body 中的 model 字段（会被提升到外层）
    const requestBody = { ...body }
    delete requestBody.model
    
    // 5. 包装为 v1internal 格式
    const wrapped = {
      project: projectId,
      requestId: requestId,
      request: requestBody,  // 标准 Gemini 格式的请求体
      model: model,
      userAgent: 'antigravity',
      requestType: requestType
    }

    return wrapped
  }
  
  /**
   * 生成简单的 UUID
   */
  private generateUUID(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0
      const v = c === 'x' ? r : (r & 0x3 | 0x8)
      return v.toString(16)
    })
  }

  /**
   * 解包v1internal响应
   * 
   * v1internal 响应格式：{ response: { candidates: [...] } }
   * 需要提取 response 字段中的内容
   */
  private unwrapResponseBody(body: any): any {
    // v1internal响应格式通常有一层response包装
    // 例如: { response: { candidates: [...] } }
    
    if (body && typeof body === 'object' && body.response) {
      return body.response
    }

    // 如果没有包装，直接返回
    return body
  }

  /**
   * 处理模型列表请求（使用账号池自动重试）
   */
  async handleModels(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      // 使用账号池执行请求（自动重试和账号轮换）
      const result = await this.poolManager.executeWithRetry('antigravity', async (selection) => {
        const { accessToken, metadata } = selection
        const antigravityMeta = metadata as AntigravityMetadata

        // 尝试不同的baseURL
        let lastError: any = null
        
        for (const baseUrl of this.baseUrls) {
          try {
            const upstreamUrl = `${baseUrl}/v1internal:fetchAvailableModels`
            
            const headers: Record<string, string> = {
              'Authorization': `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
              'User-Agent': 'antigravity/1.104.0 darwin/arm64',
              'X-Goog-Api-Client': 'google-cloud-sdk vscode_cloudshelleditor/0.1'
            }

            if (antigravityMeta?.metadata) {
              headers['Client-Metadata'] = JSON.stringify(antigravityMeta.metadata)
            }

            const response = await fetch(upstreamUrl, {
              method: 'POST',
              headers,
              body: JSON.stringify({})  // ✅ 发送空 JSON 对象（参考 Antigravity-Manager）
            })

            if (response.ok) {
              const data = await response.json()
              return data
            }

            // 如果是429或5xx错误，尝试下一个baseURL
            if (response.status === 429 || response.status >= 500) {
              const errorBody = await response.text()
              lastError = {
                status: response.status,
                body: errorBody
              }
              continue
            }

            // 其他错误抛出异常，触发账号轮换
            const errorBody = await response.text()
            const error: any = new Error(`Antigravity API error: ${response.status}`)
            error.status = response.status
            error.body = errorBody
            throw error

          } catch (error: any) {
            lastError = error
            console.error(`[AntigravityTranslator] Models request error on ${baseUrl}:`, error)
            
            // 如果不是网络错误，直接抛出
            if (error.status) {
              throw error
            }
            continue
          }
        }

        // 所有baseURL都失败了
        const error: any = new Error('All Antigravity base URLs failed')
        error.status = lastError?.status || 503
        error.body = lastError?.body || lastError?.message
        throw error
      })

      // 返回结果
      reply.send(result)

    } catch (error: any) {
      console.error('[AntigravityTranslator] Handle models error:', error)
      
      const status = error.status || 500
      const errorBody = error.body || error.message || 'Internal server error'
      
      try {
        const parsedError = JSON.parse(errorBody)
        reply.status(status).send(parsedError)
      } catch {
        reply.status(status).send({
          error: {
            message: errorBody,
            type: 'service_unavailable'
          }
        })
      }
    }
  }
}
