/**
 * Chat IPC handlers
 * Handles chat conversations and messages with streaming support via local proxy service
 */

import { ipcMain, type IpcMainInvokeEvent } from 'electron'

import {
  trackConversationCreated,
  trackConversationDeleted,
  trackMessageSent
} from '../services/analytics'
import {
  getConversationRepository,
  getMessageRepository,
  getProviderRepository,
  getBridgeProxyRepository,
  type Conversation,
  type Message,
  type CreateConversationDTO,
  type UpdateConversationDTO
} from '../services/database/repositories'
import { getServerState } from '../services/proxy-server'
import { getAdapter } from '../services/proxy-server/bridge-manager'
import { getEndpointForAdapter } from '../services/proxy-server/utils'

/**
 * Register chat IPC handlers
 */
export function registerChatHandlers(): void {
  const conversationRepo = getConversationRepository()
  const messageRepo = getMessageRepository()
  const providerRepo = getProviderRepository()

  // List all conversations
  ipcMain.handle('chat:list-conversations', async (): Promise<Conversation[]> => {
    return conversationRepo.findAll()
  })

  // Get a conversation by ID
  ipcMain.handle('chat:get-conversation', async (_event, id: string): Promise<Conversation | null> => {
    return conversationRepo.findById(id)
  })

  // Create a new conversation
  ipcMain.handle('chat:create-conversation', async (_event, data: CreateConversationDTO): Promise<Conversation> => {
    const conversation = conversationRepo.create(data)
    
    // 追踪对话创建（异步，不阻塞）
    setImmediate(() => {
      try {
        trackConversationCreated(data.model, data.providerId, data.proxyId)
      } catch (e) {
        // 静默失败
      }
    })
    
    return conversation
  })

  // Update a conversation
  ipcMain.handle('chat:update-conversation', async (_event, id: string, data: UpdateConversationDTO): Promise<Conversation | null> => {
    return conversationRepo.update(id, data)
  })

  // Delete a conversation
  ipcMain.handle('chat:delete-conversation', async (_event, id: string): Promise<boolean> => {
    // Messages will be deleted by CASCADE
    const result = conversationRepo.delete(id)
    
    // 追踪对话删除（异步，不阻塞）
    if (result) {
      setImmediate(() => {
        try {
          trackConversationDeleted()
        } catch (e) {
          // 静默失败
        }
      })
    }
    
    return result
  })

  // Get messages for a conversation
  ipcMain.handle('chat:get-messages', async (_event, conversationId: string): Promise<Message[]> => {
    return messageRepo.findByConversationId(conversationId)
  })

  // Send a message and stream the response
  ipcMain.handle('chat:send-message', async (
    event: IpcMainInvokeEvent,
    conversationId: string,
    content: string,
    selectedModel?: string,
    selectedProxy?: { type: 'provider' | 'proxy'; id: string }
  ): Promise<void> => {
    const sender = event.sender

    try {
      // Check if proxy service is running
      const serverState = getServerState()
      if (!serverState.running) {
        sender.send('chat:stream-error', 'Proxy service is not running. Please start the service first.')
        return
      }

      // Get conversation
      const conversation = conversationRepo.findById(conversationId)
      if (!conversation) {
        sender.send('chat:stream-error', 'Conversation not found')
        return
      }

      // Use selectedModel if provided, otherwise use conversation's model
      const model = selectedModel || conversation.model

      // Update conversation if model or proxy changed
      const updates: UpdateConversationDTO = {}
      if (selectedModel && selectedModel !== conversation.model) {
        updates.model = selectedModel
      }
      if (selectedProxy) {
        const newProviderId = selectedProxy.type === 'provider' ? selectedProxy.id : undefined
        const newProxyId = selectedProxy.type === 'proxy' ? selectedProxy.id : undefined
        if (newProviderId !== conversation.providerId || newProxyId !== conversation.proxyId) {
          updates.providerId = newProviderId
          updates.proxyId = newProxyId
        }
      }
      if (Object.keys(updates).length > 0) {
        conversationRepo.update(conversationId, updates)
        // Refresh conversation object
        const updatedConversation = conversationRepo.findById(conversationId)
        if (updatedConversation) {
          Object.assign(conversation, updatedConversation)
        }
      }

      // Save user message
      messageRepo.create({
        conversationId,
        role: 'user',
        content
      })

      // Get all messages for context
      const messages = messageRepo.findByConversationId(conversationId)

      // Build messages array for LLM
      // IMPORTANT: Do NOT include reasoning field in message history
      // According to provider docs (e.g., DeepSeek), including reasoning_content
      // in subsequent requests will cause 400 errors
      const llmMessages = messages.map(msg => ({
        role: msg.role,
        content: msg.content || ''
      }))

      // Determine proxy URL and adapter type
      let proxyUrl: string
      let adapterType: string

      if (conversation.proxyId) {
        // Use bridge proxy: /proxies/{proxy_path}/v1/chat/completions
        const proxy = getBridgeProxyRepository().findById(conversation.proxyId)
        if (!proxy) {
          sender.send('chat:stream-error', 'Proxy not found')
          return
        }
        if (!proxy.enabled) {
          sender.send('chat:stream-error', 'Proxy is disabled')
          return
        }

        adapterType = proxy.inbound_adapter
        const endpoint = getEndpointForAdapter(adapterType)
        proxyUrl = `http://${serverState.host}:${serverState.port}/proxies/${proxy.proxy_path}${endpoint}`
      } else if (conversation.providerId) {
        // Use provider passthrough: /providers/{proxy_path}/v1/chat/completions
        const provider = providerRepo.findById(conversation.providerId)
        if (!provider) {
          sender.send('chat:stream-error', 'Provider not found')
          return
        }
        if (!provider.enabled) {
          sender.send('chat:stream-error', 'Provider is disabled')
          return
        }

        adapterType = provider.adapter_type
        // 使用 Provider 自己的 chat_path，如果没有则使用 adapter 默认端点
        let endpoint = provider.chat_path || getEndpointForAdapter(adapterType)
        
        console.log(`\n[Chat] 📨 Building request URL for provider`)
        console.log(`[Chat]   - Provider name: ${provider.name}`)
        console.log(`[Chat]   - Provider proxy_path: ${provider.proxy_path}`)
        console.log(`[Chat]   - Provider chat_path: ${provider.chat_path}`)
        console.log(`[Chat]   - Adapter type: ${adapterType}`)
        console.log(`[Chat]   - Endpoint (before replace): ${endpoint}`)
        console.log(`[Chat]   - Model: ${model}`)
        
        // 替换 {model} 占位符为实际的模型名
        if (endpoint.includes('{model}')) {
          endpoint = endpoint.replace('{model}', model)
          console.log(`[Chat]   - Endpoint (after replace): ${endpoint}`)
        }
        
        proxyUrl = `http://${serverState.host}:${serverState.port}/providers/${provider.proxy_path}${endpoint}`
        console.log(`[Chat]   - Final proxy URL: ${proxyUrl}`)
      } else {
        sender.send('chat:stream-error', 'No proxy or provider configured')
        return
      }

      console.log(`[Chat] Sending request to: ${proxyUrl}`)

      // Get adapter for parsing stream events
      const adapter = getAdapter(adapterType)
      if (!adapter?.inbound?.parseStream) {
        sender.send('chat:stream-error', `Adapter ${adapterType} does not support streaming`)
        return
      }

      // Send stream start event
      sender.send('chat:stream-start')

      // Stream the response via HTTP
      let fullContent = ''
      let fullReasoning = ''
      let usage: { promptTokens?: number; completionTokens?: number} | undefined
      let hasError = false
      const streamStartTime = Date.now()

      try {
        const response = await fetch(proxyUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
            // No Authorization header - let proxy service use configured keys
          },
          body: JSON.stringify({
            model: model,
            messages: llmMessages,
            stream: true
          })
        })

        if (!response.ok) {
          const errorText = await response.text()
          throw new Error(`HTTP ${response.status}: ${errorText}`)
        }

        if (!response.body) {
          throw new Error('No response body')
        }

        // Parse SSE stream
        const reader = response.body.getReader()
        const decoder = new TextDecoder()
        let buffer = ''

        // eslint-disable-next-line no-constant-condition
        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split('\n')
          buffer = lines.pop() || ''

          for (const line of lines) {
            if (!line.trim() || line.startsWith(':')) continue

            // Parse SSE line
            if (line.startsWith('data: ')) {
              const data = line.slice(6).trim()

              // Skip [DONE] marker
              if (data === '[DONE]') continue

              try {
                const rawChunk = JSON.parse(data)

                // Check for error in response
                if (rawChunk.error) {
                  console.error('[Chat] API error in stream:', rawChunk.error)
                  
                  // ✅ 只提取关键信息：错误码 + 错误描述
                  let errorMsg = 'API Error'
                  const errorObj = rawChunk.error.error || rawChunk.error
                  
                  if (errorObj.message) {
                    errorMsg = errorObj.message
                    if (errorObj.code) {
                      errorMsg = `[${errorObj.code}] ${errorMsg}`
                    }
                  } else if (errorObj.code) {
                    errorMsg = `Error ${errorObj.code}`
                  }
                  sender.send('chat:stream-error', errorMsg)
                  hasError = true
                  break
                }

                // Use adapter to parse the chunk into IR format
                const events = adapter.inbound.parseStream?.(rawChunk)
                if (!events) continue

                // Handle single event or array of events
                const eventArray = Array.isArray(events) ? events : [events]

                for (const event of eventArray) {
                  // Unified IR event handling - works for all adapters
                  switch (event.type) {
                    case 'reasoning':
                      if (event.reasoning?.delta) {
                        fullReasoning += event.reasoning.delta
                        sender.send('chat:stream-reasoning', event.reasoning.delta)
                      }
                      break

                    case 'content':
                      if (event.content?.delta) {
                        fullContent += event.content.delta
                        sender.send('chat:stream-content', event.content.delta)
                      }
                      break

                    case 'end':
                      if (event.usage) {
                        usage = {
                          promptTokens: event.usage.promptTokens,
                          completionTokens: event.usage.completionTokens
                        }
                      }
                      break

                    case 'error': {
                      // ✅ 提取错误详情
                      const errorMsg = event.error?.message || event.message || 'Stream error'
                      console.error('[Chat] Stream error event:', event)
                      sender.send('chat:stream-error', errorMsg)
                      hasError = true
                      break
                    }

                    // Ignore other event types (start, tool_call, etc.)
                  }
                }
              } catch (parseError) {
                console.warn('[Chat] Failed to parse SSE data:', data, parseError)
              }
            }
          }

          // If error detected, stop reading stream
          if (hasError) break
        }

        // Only save message if no error occurred and we have content or reasoning
        if (!hasError && (fullContent || fullReasoning)) {
          // Save assistant message
          const assistantMessage = messageRepo.create({
            conversationId,
            role: 'assistant',
            content: fullContent || undefined,
            reasoning: fullReasoning || undefined,
            usage: usage ? JSON.stringify(usage) : undefined
          })

          // Update conversation timestamp
          conversationRepo.touch(conversationId)

          // Update conversation title if it's the first message
          if (messages.length === 1) {
            // First user message, generate title
            const title = content.slice(0, 20) + (content.length > 20 ? '...' : '')
            conversationRepo.update(conversationId, { title })
          }

          // Send stream end event
          sender.send('chat:stream-end', assistantMessage)
          
          // 追踪消息发送成功（异步，不阻塞）
          setImmediate(() => {
            try {
              const latency = Date.now() - streamStartTime
              const proxyType = conversation.proxyId ? 'proxy' : 'provider'
              trackMessageSent(model, proxyType, adapterType, true, latency)
            } catch (e) {
              // 静默失败
            }
          })
        } else if (hasError) {
          // Error already sent via chat:stream-error
          console.log('[Chat] Stream ended with error, not saving message')
          
          // 追踪消息发送失败（异步，不阻塞）
          setImmediate(() => {
            try {
              const proxyType = conversation.proxyId ? 'proxy' : 'provider'
              trackMessageSent(model, proxyType, adapterType, false, undefined, 'Stream error')
            } catch (e) {
              // 静默失败
            }
          })
        } else {
          // No content and no reasoning - empty response
          console.log('[Chat] Empty response from API (no content or reasoning)')
          sender.send('chat:stream-error', 'Empty response from API')
          
          // 追踪消息发送失败（异步，不阻塞）
          setImmediate(() => {
            try {
              const proxyType = conversation.proxyId ? 'proxy' : 'provider'
              trackMessageSent(model, proxyType, adapterType, false, undefined, 'Empty response')
            } catch (e) {
              // 静默失败
            }
          })
        }

      } catch (streamError) {
        console.error('[Chat] Stream error:', streamError)
        // ✅ 提取详细的错误信息
        let errorMsg = 'Stream error'
        if (streamError instanceof Error) {
          errorMsg = streamError.message
        } else if (typeof streamError === 'string') {
          errorMsg = streamError
        }
        sender.send('chat:stream-error', errorMsg)
        
        // 追踪消息发送失败（异步，不阻塞）
        setImmediate(() => {
          try {
            const proxyType = conversation.proxyId ? 'proxy' : 'provider'
            trackMessageSent(model, proxyType, adapterType, false, undefined, errorMsg)
          } catch (e) {
            // 静默失败
          }
        })
      }

    } catch (error) {
      console.error('[Chat] Error:', error)
      sender.send('chat:stream-error', error instanceof Error ? error.message : 'Unknown error')
      
      // 追踪消息发送失败（异步，不阻塞）
      setImmediate(() => {
        try {
          trackMessageSent('unknown', 'provider', 'unknown', false, undefined, error instanceof Error ? error.message : 'Unknown error')
        } catch (e) {
          // 静默失败
        }
      })
    }
  })

  // Stop streaming (for future use)
  ipcMain.handle('chat:stop-streaming', async (_event, conversationId: string): Promise<void> => {
    // TODO: Implement streaming cancellation
    console.log('[Chat] Stop streaming requested for:', conversationId)
  })

  // Delete a single message (assistant only)
  ipcMain.handle('chat:delete-message', async (_event, messageId: string): Promise<boolean> => {
    return messageRepo.delete(messageId)
  })

  // Delete a message pair (user message and its following assistant response)
  ipcMain.handle('chat:delete-message-pair', async (_event, userMessageId: string): Promise<boolean> => {
    const userMessage = messageRepo.findById(userMessageId)
    if (!userMessage || userMessage.role !== 'user') {
      return false
    }

    // Get all messages in the conversation
    const messages = messageRepo.findByConversationId(userMessage.conversationId)
    const userIndex = messages.findIndex(m => m.id === userMessageId)

    // Delete user message
    messageRepo.delete(userMessageId)

    // Delete the following assistant message if exists
    if (userIndex >= 0 && userIndex < messages.length - 1) {
      const nextMessage = messages[userIndex + 1]
      if (nextMessage && nextMessage.role === 'assistant') {
        messageRepo.delete(nextMessage.id)
      }
    }

    return true
  })

  // Regenerate response for a conversation
  ipcMain.handle('chat:regenerate', async (
    event: IpcMainInvokeEvent,
    conversationId: string,
    assistantMessageId: string,
    selectedModel?: string,
    selectedProxy?: { type: 'provider' | 'proxy'; id: string }
  ): Promise<void> => {
    const sender = event.sender

    try {
      // Check if proxy service is running
      const serverState = getServerState()
      if (!serverState.running) {
        sender.send('chat:stream-error', 'Proxy service is not running. Please start the service first.')
        return
      }

      // Get conversation
      const conversation = conversationRepo.findById(conversationId)
      if (!conversation) {
        sender.send('chat:stream-error', 'Conversation not found')
        return
      }

      // Use selectedModel if provided, otherwise use conversation's model
      const model = selectedModel || conversation.model

      // Update conversation if model or proxy changed
      const updates: UpdateConversationDTO = {}
      if (selectedModel && selectedModel !== conversation.model) {
        updates.model = selectedModel
      }
      if (selectedProxy) {
        const newProviderId = selectedProxy.type === 'provider' ? selectedProxy.id : undefined
        const newProxyId = selectedProxy.type === 'proxy' ? selectedProxy.id : undefined
        if (newProviderId !== conversation.providerId || newProxyId !== conversation.proxyId) {
          updates.providerId = newProviderId
          updates.proxyId = newProxyId
        }
      }
      if (Object.keys(updates).length > 0) {
        conversationRepo.update(conversationId, updates)
        // Refresh conversation object
        const updatedConversation = conversationRepo.findById(conversationId)
        if (updatedConversation) {
          Object.assign(conversation, updatedConversation)
        }
      }

      // Delete the assistant message to regenerate
      messageRepo.delete(assistantMessageId)

      // Get all messages for context (excluding the deleted one)
      const messages = messageRepo.findByConversationId(conversationId)

      // Build messages array for LLM
      // IMPORTANT: Do NOT include reasoning field in message history
      // According to provider docs (e.g., DeepSeek), including reasoning_content
      // in subsequent requests will cause 400 errors
      const llmMessages = messages.map(msg => ({
        role: msg.role,
        content: msg.content || ''
      }))

      // Determine proxy URL and adapter type
      let proxyUrl: string
      let adapterType: string

      if (conversation.proxyId) {
        // Use bridge proxy
        const proxy = getBridgeProxyRepository().findById(conversation.proxyId)
        if (!proxy) {
          sender.send('chat:stream-error', 'Proxy not found')
          return
        }
        if (!proxy.enabled) {
          sender.send('chat:stream-error', 'Proxy is disabled')
          return
        }

        adapterType = proxy.inbound_adapter
        const endpoint = getEndpointForAdapter(adapterType)
        proxyUrl = `http://${serverState.host}:${serverState.port}/proxies/${proxy.proxy_path}${endpoint}`
      } else if (conversation.providerId) {
        // Use provider passthrough
        const provider = providerRepo.findById(conversation.providerId)
        if (!provider) {
          sender.send('chat:stream-error', 'Provider not found')
          return
        }
        if (!provider.enabled) {
          sender.send('chat:stream-error', 'Provider is disabled')
          return
        }

        adapterType = provider.adapter_type
        const endpoint = getEndpointForAdapter(adapterType)
        proxyUrl = `http://${serverState.host}:${serverState.port}/providers/${provider.proxy_path}${endpoint}`
      } else {
        sender.send('chat:stream-error', 'No proxy or provider configured')
        return
      }

      console.log(`[Chat] Regenerating request to: ${proxyUrl}`)

      // Get adapter for parsing stream events
      const adapter = getAdapter(adapterType)
      if (!adapter?.inbound?.parseStream) {
        sender.send('chat:stream-error', `Adapter ${adapterType} does not support streaming`)
        return
      }

      // Send stream start event
      sender.send('chat:stream-start')

      // Stream the response via HTTP
      let fullContent = ''
      let fullReasoning = ''
      let usage: { promptTokens?: number; completionTokens?: number} | undefined
      let hasError = false

      try {
        const response = await fetch(proxyUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
            // No Authorization header - let proxy service use configured keys
          },
          body: JSON.stringify({
            model: model,
            messages: llmMessages,
            stream: true
          })
        })

        if (!response.ok) {
          const errorText = await response.text()
          throw new Error(`HTTP ${response.status}: ${errorText}`)
        }

        if (!response.body) {
          throw new Error('No response body')
        }

        // Parse SSE stream
        const reader = response.body.getReader()
        const decoder = new TextDecoder()
        let buffer = ''

        // eslint-disable-next-line no-constant-condition
        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split('\n')
          buffer = lines.pop() || ''

          for (const line of lines) {
            if (!line.trim() || line.startsWith(':')) continue

            // Parse SSE line
            if (line.startsWith('data: ')) {
              const data = line.slice(6).trim()

              // Skip [DONE] marker
              if (data === '[DONE]') continue

              try {
                const rawChunk = JSON.parse(data)

                // Check for error in response
                if (rawChunk.error) {
                  console.error('[Chat] API error in stream:', rawChunk.error)
                  
                  // ✅ 只提取关键信息：错误码 + 错误描述
                  let errorMsg = 'API Error'
                  const errorObj = rawChunk.error.error || rawChunk.error
                  
                  if (errorObj.message) {
                    errorMsg = errorObj.message
                    if (errorObj.code) {
                      errorMsg = `[${errorObj.code}] ${errorMsg}`
                    }
                  } else if (errorObj.code) {
                    errorMsg = `Error ${errorObj.code}`
                  }
                  sender.send('chat:stream-error', errorMsg)
                  hasError = true
                  break
                }

                // Use adapter to parse the chunk into IR format
                const events = adapter.inbound.parseStream?.(rawChunk)
                if (!events) continue

                // Handle single event or array of events
                const eventArray = Array.isArray(events) ? events : [events]

                for (const event of eventArray) {
                  // Unified IR event handling - works for all adapters
                  switch (event.type) {
                    case 'reasoning':
                      if (event.reasoning?.delta) {
                        fullReasoning += event.reasoning.delta
                        sender.send('chat:stream-reasoning', event.reasoning.delta)
                      }
                      break

                    case 'content':
                      if (event.content?.delta) {
                        fullContent += event.content.delta
                        sender.send('chat:stream-content', event.content.delta)
                      }
                      break

                    case 'end':
                      if (event.usage) {
                        usage = {
                          promptTokens: event.usage.promptTokens,
                          completionTokens: event.usage.completionTokens
                        }
                      }
                      break

                    case 'error': {
                      // ✅ 提取错误详情
                      const errorMsg = event.error?.message || event.message || 'Stream error'
                      console.error('[Chat] Stream error event:', event)
                      sender.send('chat:stream-error', errorMsg)
                      hasError = true
                      break
                    }

                    // Ignore other event types (start, tool_call, etc.)
                  }
                }
              } catch (parseError) {
                console.warn('[Chat] Failed to parse SSE data:', data, parseError)
              }
            }
          }

          // If error detected, stop reading stream
          if (hasError) break
        }

        // Only save message if no error occurred and we have content
        if (!hasError && fullContent) {
          // Save assistant message
          const assistantMessage = messageRepo.create({
            conversationId,
            role: 'assistant',
            content: fullContent || undefined,
            reasoning: fullReasoning || undefined,
            usage: usage ? JSON.stringify(usage) : undefined
          })

          // Update conversation timestamp
          conversationRepo.touch(conversationId)

          // Send stream end event
          sender.send('chat:stream-end', assistantMessage)
        } else if (hasError) {
          // Error already sent via chat:stream-error
          console.log('[Chat] Regenerate stream ended with error, not saving message')
        } else {
          // No content and no error - empty response
          console.log('[Chat] Regenerate empty response from API')
          sender.send('chat:stream-error', 'Empty response from API')
        }

      } catch (streamError) {
        console.error('[Chat] Regenerate stream error:', streamError)
        sender.send('chat:stream-error', streamError instanceof Error ? streamError.message : 'Stream error')
      }

    } catch (error) {
      console.error('[Chat] Regenerate error:', error)
      sender.send('chat:stream-error', error instanceof Error ? error.message : 'Unknown error')
    }
  })

  console.log('[IPC] Chat handlers registered')
}
