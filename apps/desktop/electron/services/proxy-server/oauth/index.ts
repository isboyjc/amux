import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { CodexTranslator } from './codex/translator'
import { AntigravityTranslator } from './antigravity/translator'
import { getOAuthKeyManager } from './key-manager'

/**
 * OAuth 服务 API Key 验证中间件
 */
async function verifyOAuthKey(
  request: FastifyRequest,
  reply: FastifyReply,
  providerType: string
): Promise<boolean> {
  const authHeader = request.headers['authorization']
  
  if (!authHeader) {
    reply.status(401).send({
      error: {
        message: 'Missing Authorization header',
        type: 'authentication_error'
      }
    })
    return false
  }
  
  const apiKey = authHeader.replace(/^Bearer\s+/i, '')
  const keyManager = getOAuthKeyManager()
  const isValid = await keyManager.validateKey(apiKey, providerType as any)
  
  if (!isValid) {
    reply.status(401).send({
      error: {
        message: 'Invalid OAuth service API key',
        type: 'authentication_error'
      }
    })
    return false
  }
  
  return true
}

// 🔒 防止重复注册的标志
let routesRegistered = false

/**
 * 注册所有 OAuth 转换服务路由
 * 
 * 每个 OAuth 厂商注册为一个中转服务，对外暴露标准适配器格式
 * 账号池策略在此层实现（round-robin, least-used 等）
 */
export function registerOAuthRoutes(server: FastifyInstance) {
  // 🔒 防止重复注册（开发环境热重载问题）
  if (routesRegistered) {
    return
  }
  
  const codexTranslator = new CodexTranslator()
  const antigravityTranslator = new AntigravityTranslator()
  
  let registeredCount = 0
  
  // ✅ Codex OAuth 转换服务
  try {
    server.post('/oauth/codex/v1/chat/completions', async (request, reply) => {
      if (!(await verifyOAuthKey(request, reply, 'codex'))) return
      await codexTranslator.handle(request, reply)
    })
    registeredCount++
  } catch (err: any) {
    if (err.code !== 'FST_ERR_DUPLICATED_ROUTE') throw err
  }
  
  try {
    server.get('/oauth/codex/v1/models', async (request, reply) => {
      if (!(await verifyOAuthKey(request, reply, 'codex'))) return
      reply.send({
        object: 'list',
        data: [
          { id: 'gpt-5', object: 'model', created: 1754524800, owned_by: 'openai' },
          { id: 'gpt-5-codex', object: 'model', created: 1757894400, owned_by: 'openai' },
          { id: 'gpt-5-codex-mini', object: 'model', created: 1760572800, owned_by: 'openai' },
          { id: 'gpt-5.1', object: 'model', created: 1763251200, owned_by: 'openai' },
          { id: 'gpt-5.1-codex', object: 'model', created: 1765929600, owned_by: 'openai' },
          { id: 'gpt-5.1-codex-mini', object: 'model', created: 1768521600, owned_by: 'openai' },
          { id: 'gpt-5.1-codex-max', object: 'model', created: 1771200000, owned_by: 'openai' },
          { id: 'gpt-5.2', object: 'model', created: 1773878400, owned_by: 'openai' },
          { id: 'gpt-5.2-codex', object: 'model', created: 1776470400, owned_by: 'openai' }
        ]
      })
    })
    registeredCount++
  } catch (err: any) {
    if (err.code !== 'FST_ERR_DUPLICATED_ROUTE') throw err
  }
  
  // ✅ Antigravity OAuth 转换服务 (标准 Google API 格式)
  // 对外暴露标准 Google Gemini API，内部转换为 v1internal
  // 支持 Google API 的冒号分隔格式: /v1beta/models/{model}:action
  // 例如：/oauth/antigravity/v1beta/models/gemini-3-flash:streamGenerateContent
  try {
    server.post('/oauth/antigravity/v1beta/models/*', async (request, reply) => {
      console.log(`\n[OAuth/Antigravity] 🔄 Received request`)
      console.log(`[OAuth/Antigravity]   - Request URL: ${request.url}`)
      console.log(`[OAuth/Antigravity]   - Wildcard param: ${(request.params as any)['*']}`)
      
      if (!(await verifyOAuthKey(request, reply, 'antigravity'))) return
      
      // 解析路径：/v1beta/models/{model}:action
      const urlPath = (request.params as any)['*']
      const match = urlPath.match(/^([^:]+):(.+)$/)
      
      console.log(`[OAuth/Antigravity]   - URL path: ${urlPath}`)
      console.log(`[OAuth/Antigravity]   - Match result:`, match)
      
      if (!match) {
        console.log(`[OAuth/Antigravity]   ❌ Invalid URL format`)
        return reply.status(400).send({
          error: {
            message: 'Invalid path format. Expected: /v1beta/models/{model}:action',
            type: 'invalid_request'
          }
        })
      }
      
      const [, modelName, action] = match
      
      // 🔧 将模型名注入到请求体中（如果请求体中没有的话）
      const body = request.body as any
      if (!body.model) {
        body.model = modelName
      }
      
      if (action === 'streamGenerateContent' || action === 'generateContent') {
        await antigravityTranslator.handle(request, reply)
      } else {
        reply.status(404).send({
          error: {
            message: `Unknown action: ${action}`,
            type: 'not_found'
          }
        })
      }
    })
    registeredCount++
  } catch (err: any) {
    if (err.code !== 'FST_ERR_DUPLICATED_ROUTE') throw err
  }
  
  // 🔧 保留 v1internal 路由（用于直接调用和模型列表获取）
  try {
    server.route({
      method: 'POST',
      url: '/oauth/antigravity/v1internal:streamGenerateContent',
      handler: async (request, reply) => {
        if (!(await verifyOAuthKey(request, reply, 'antigravity'))) return
        await antigravityTranslator.handle(request, reply)
      }
    })
    registeredCount++
  } catch (err: any) {
    if (err.code !== 'FST_ERR_DUPLICATED_ROUTE') throw err
  }
  
  try {
    server.route({
      method: 'POST',
      url: '/oauth/antigravity/v1internal:generateContent',
      handler: async (request, reply) => {
        if (!(await verifyOAuthKey(request, reply, 'antigravity'))) return
        await antigravityTranslator.handle(request, reply)
      }
    })
    registeredCount++
  } catch (err: any) {
    if (err.code !== 'FST_ERR_DUPLICATED_ROUTE') throw err
  }
  
  try {
    server.route({
      method: 'GET',
      url: '/oauth/antigravity/v1internal:fetchAvailableModels',
      handler: async (request, reply) => {
        if (!(await verifyOAuthKey(request, reply, 'antigravity'))) return
        await antigravityTranslator.handleModels(request, reply)
      }
    })
    registeredCount++
  } catch (err: any) {
    if (err.code !== 'FST_ERR_DUPLICATED_ROUTE') throw err
  }
  
  try {
    server.route({
      method: 'POST',
      url: '/oauth/antigravity/v1internal:fetchAvailableModels',
      handler: async (request, reply) => {
        if (!(await verifyOAuthKey(request, reply, 'antigravity'))) return
        await antigravityTranslator.handleModels(request, reply)
      }
    })
    registeredCount++
  } catch (err: any) {
    if (err.code !== 'FST_ERR_DUPLICATED_ROUTE') throw err
  }
  
  // 🔒 标记路由已注册
  routesRegistered = true
  
  console.log('[OAuth] ========================================')
  console.log(`[OAuth] ✅ OAuth routes ready (${registeredCount} new, ${7 - registeredCount} existing)`)
  console.log('[OAuth]   POST /oauth/codex/v1/chat/completions')
  console.log('[OAuth]   GET  /oauth/codex/v1/models')
  console.log('[OAuth]   POST /oauth/antigravity/v1beta/models/* ⭐️ (Google API format with colon)')
  console.log('[OAuth]   POST /oauth/antigravity/v1internal:streamGenerateContent')
  console.log('[OAuth]   POST /oauth/antigravity/v1internal:generateContent')
  console.log('[OAuth]   GET  /oauth/antigravity/v1internal:fetchAvailableModels')
  console.log('[OAuth]   POST /oauth/antigravity/v1internal:fetchAvailableModels')
  console.log('[OAuth] ========================================')
}

/**
 * 重置路由注册标志（用于服务器重启）
 */
export function resetOAuthRoutes() {
  routesRegistered = false
}
