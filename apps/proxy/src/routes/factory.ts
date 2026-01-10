/**
 * Route factory - creates Express routers for bridge routes
 */
import { Bridge } from '@amux/llm-bridge'
import { Router, Request, Response } from 'express'
import { adapters } from '../adapters'
import type { RouteConfig } from '../types'
import { extractApiKey, sendError } from '../utils/helpers'

export function createBridgeRouter(config: RouteConfig): Router {
  const router = Router()
  const inboundConfig = adapters[config.inbound]
  const outboundConfig = adapters[config.outbound]

  if (!inboundConfig || !outboundConfig) {
    throw new Error(`Invalid adapter configuration: ${config.inbound} -> ${config.outbound}`)
  }

  const errorFormat = config.inbound === 'anthropic' ? 'anthropic' : 'openai'

  router.post(config.endpoint, async (req: Request, res: Response) => {
    // Extract API key from request header or environment
    let apiKey = extractApiKey(req, inboundConfig.apiKeyHeader)

    // Fallback to environment variable for outbound API key
    if (!apiKey) {
      apiKey = process.env[outboundConfig.apiKeyEnv] || null
    }

    console.log(`[${config.inbound}->${config.outbound}] API Key: ${apiKey ? '***' + apiKey.slice(-4) : 'missing'}`)
    console.log(`[${config.inbound}->${config.outbound}] Request:`, JSON.stringify(req.body, null, 2))

    if (!apiKey) {
      return sendError(res, 401, 'authentication_error', 'Missing API key', errorFormat)
    }

    const body = req.body as { stream?: boolean; model?: string }

    // Log model mapping
    const inboundModel = body.model || ''
    const targetModel = config.modelMapping[inboundModel] || config.defaultModel
    console.log(`[${config.inbound}->${config.outbound}] Model: ${inboundModel} -> ${targetModel}`)

    const bridge = new Bridge({
      inbound: inboundConfig.adapter,
      outbound: outboundConfig.adapter,
      config: {
        apiKey,
        ...(outboundConfig.baseURL && { baseURL: outboundConfig.baseURL }),
        authHeaderName: outboundConfig.authHeaderName,
        authHeaderPrefix: outboundConfig.authHeaderPrefix,
      },
      modelMapping: config.modelMapping,
    })

    try {
      if (body.stream) {
        // Streaming response
        res.setHeader('Content-Type', 'text/event-stream')
        res.setHeader('Cache-Control', 'no-cache')
        res.setHeader('Connection', 'keep-alive')

        let eventCount = 0
        for await (const sse of bridge.chatStream(body)) {
          eventCount++
          console.log(`[${config.inbound}->${config.outbound}] SSE Event #${eventCount}:`, JSON.stringify(sse, null, 2))
          // Format SSE based on inbound adapter format
          if (config.inbound === 'anthropic' || config.inbound === 'openai-responses') {
            // Anthropic and OpenAI Responses API format: event: xxx\ndata: {...}\n\n
            res.write(`event: ${sse.event}\ndata: ${JSON.stringify(sse.data)}\n\n`)
          } else {
            // OpenAI Chat Completions format: data: {...}\n\n
            res.write(`data: ${JSON.stringify(sse.data)}\n\n`)
          }
        }
        console.log(`[${config.inbound}->${config.outbound}] Total SSE events: ${eventCount}`)

        // Add protocol-level end marker for OpenAI Chat Completions format only
        // Anthropic and OpenAI Responses API don't use [DONE] marker
        if (config.inbound !== 'anthropic' && config.inbound !== 'openai-responses') {
          res.write('data: [DONE]\n\n')
        }

        res.end()
      } else {
        // Non-streaming response
        const response = await bridge.chat(body)
        res.json(response)
      }
    } catch (error) {
      console.error(`[${config.inbound}->${config.outbound}] Error:`, error)
      sendError(res, 500, 'api_error', error instanceof Error ? error.message : 'Unknown error', errorFormat)
    }
  })

  return router
}
