/**
 * Chat IPC handlers
 * Handles chat conversations and messages with streaming support
 */

import { ipcMain, type IpcMainInvokeEvent } from 'electron'
import { Bridge } from '@amux/llm-bridge'

import { decryptApiKey } from '../services/crypto'
import {
  getConversationRepository,
  getMessageRepository,
  getProviderRepository,
  type Conversation,
  type Message,
  type CreateConversationDTO,
  type UpdateConversationDTO
} from '../services/database/repositories'
import { getAdapter, getBridge } from '../services/proxy-server/bridge-manager'

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
    return conversationRepo.create(data)
  })

  // Update a conversation
  ipcMain.handle('chat:update-conversation', async (_event, id: string, data: UpdateConversationDTO): Promise<Conversation | null> => {
    return conversationRepo.update(id, data)
  })

  // Delete a conversation
  ipcMain.handle('chat:delete-conversation', async (_event, id: string): Promise<boolean> => {
    // Messages will be deleted by CASCADE
    return conversationRepo.delete(id)
  })

  // Get messages for a conversation
  ipcMain.handle('chat:get-messages', async (_event, conversationId: string): Promise<Message[]> => {
    return messageRepo.findByConversationId(conversationId)
  })

  // Send a message and stream the response
  ipcMain.handle('chat:send-message', async (
    event: IpcMainInvokeEvent,
    conversationId: string,
    content: string
  ): Promise<void> => {
    const sender = event.sender

    try {
      // Get conversation
      const conversation = conversationRepo.findById(conversationId)
      if (!conversation) {
        sender.send('chat:stream-error', 'Conversation not found')
        return
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
      const llmMessages = messages.map(msg => ({
        role: msg.role,
        content: msg.content || ''
      }))

      // Determine which proxy/provider to use
      let bridge: Bridge
      const model = conversation.model

      if (conversation.proxyId) {
        // Use bridge proxy
        const result = getBridge(conversation.proxyId)
        bridge = result.bridge
      } else if (conversation.providerId) {
        // Use provider directly (passthrough)
        const provider = providerRepo.findById(conversation.providerId)
        if (!provider) {
          sender.send('chat:stream-error', 'Provider not found')
          return
        }
        if (!provider.enabled) {
          sender.send('chat:stream-error', 'Provider is disabled')
          return
        }

        const adapter = getAdapter(provider.adapter_type)
        const apiKey = provider.api_key ? decryptApiKey(provider.api_key) : ''

        bridge = new Bridge({
          inbound: adapter,
          outbound: adapter,
          config: {
            apiKey: apiKey || '',
            baseURL: provider.base_url || undefined
          }
        })
      } else {
        sender.send('chat:stream-error', 'No proxy or provider configured')
        return
      }

      // Send stream start event
      sender.send('chat:stream-start')

      // Stream the response
      let fullContent = ''
      let fullReasoning = ''
      let usage: { promptTokens?: number; completionTokens?: number } | undefined

      try {
        const stream = bridge.chatStream({
          model,
          messages: llmMessages,
          stream: true
        })

        for await (const event of stream) {
          const sseEvent = event as { event?: string; data?: any; type?: string }
          const eventData = sseEvent.data || sseEvent

          // Handle different event types
          if (eventData.type === 'content' || eventData.delta?.content) {
            const contentDelta = eventData.delta?.content || eventData.content || ''
            fullContent += contentDelta
            sender.send('chat:stream-content', contentDelta)
          } else if (eventData.type === 'reasoning' || eventData.delta?.reasoning) {
            const reasoningDelta = eventData.delta?.reasoning || eventData.reasoning || ''
            fullReasoning += reasoningDelta
            sender.send('chat:stream-reasoning', reasoningDelta)
          } else if (eventData.type === 'end' || eventData.usage) {
            if (eventData.usage) {
              usage = eventData.usage
            }
          }

          // Handle OpenAI format
          if (eventData.choices?.[0]?.delta?.content) {
            const contentDelta = eventData.choices[0].delta.content
            fullContent += contentDelta
            sender.send('chat:stream-content', contentDelta)
          }
          if (eventData.choices?.[0]?.delta?.reasoning_content) {
            const reasoningDelta = eventData.choices[0].delta.reasoning_content
            fullReasoning += reasoningDelta
            sender.send('chat:stream-reasoning', reasoningDelta)
          }
        }

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

      } catch (streamError) {
        console.error('[Chat] Stream error:', streamError)
        sender.send('chat:stream-error', streamError instanceof Error ? streamError.message : 'Stream error')
      }

    } catch (error) {
      console.error('[Chat] Error:', error)
      sender.send('chat:stream-error', error instanceof Error ? error.message : 'Unknown error')
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
    assistantMessageId: string
  ): Promise<void> => {
    const sender = event.sender

    try {
      // Get conversation
      const conversation = conversationRepo.findById(conversationId)
      if (!conversation) {
        sender.send('chat:stream-error', 'Conversation not found')
        return
      }

      // Delete the assistant message to regenerate
      messageRepo.delete(assistantMessageId)

      // Get all messages for context (excluding the deleted one)
      const messages = messageRepo.findByConversationId(conversationId)

      // Build messages array for LLM
      const llmMessages = messages.map(msg => ({
        role: msg.role,
        content: msg.content || ''
      }))

      // Determine which proxy/provider to use
      let bridge: Bridge
      const model = conversation.model

      if (conversation.proxyId) {
        const result = getBridge(conversation.proxyId)
        bridge = result.bridge
      } else if (conversation.providerId) {
        const provider = providerRepo.findById(conversation.providerId)
        if (!provider) {
          sender.send('chat:stream-error', 'Provider not found')
          return
        }
        if (!provider.enabled) {
          sender.send('chat:stream-error', 'Provider is disabled')
          return
        }

        const adapter = getAdapter(provider.adapter_type)
        const apiKey = provider.api_key ? decryptApiKey(provider.api_key) : ''

        bridge = new Bridge({
          inbound: adapter,
          outbound: adapter,
          config: {
            apiKey: apiKey || '',
            baseURL: provider.base_url || undefined
          }
        })
      } else {
        sender.send('chat:stream-error', 'No proxy or provider configured')
        return
      }

      // Send stream start event
      sender.send('chat:stream-start')

      // Stream the response
      let fullContent = ''
      let fullReasoning = ''
      let usage: { promptTokens?: number; completionTokens?: number } | undefined

      try {
        const stream = bridge.chatStream({
          model,
          messages: llmMessages,
          stream: true
        })

        for await (const streamEvent of stream) {
          const sseEvent = streamEvent as { event?: string; data?: any; type?: string }
          const eventData = sseEvent.data || sseEvent

          // Handle different event types
          if (eventData.type === 'content' || eventData.delta?.content) {
            const contentDelta = eventData.delta?.content || eventData.content || ''
            fullContent += contentDelta
            sender.send('chat:stream-content', contentDelta)
          } else if (eventData.type === 'reasoning' || eventData.delta?.reasoning) {
            const reasoningDelta = eventData.delta?.reasoning || eventData.reasoning || ''
            fullReasoning += reasoningDelta
            sender.send('chat:stream-reasoning', reasoningDelta)
          } else if (eventData.type === 'end' || eventData.usage) {
            if (eventData.usage) {
              usage = eventData.usage
            }
          }

          // Handle OpenAI format
          if (eventData.choices?.[0]?.delta?.content) {
            const contentDelta = eventData.choices[0].delta.content
            fullContent += contentDelta
            sender.send('chat:stream-content', contentDelta)
          }
          if (eventData.choices?.[0]?.delta?.reasoning_content) {
            const reasoningDelta = eventData.choices[0].delta.reasoning_content
            fullReasoning += reasoningDelta
            sender.send('chat:stream-reasoning', reasoningDelta)
          }
        }

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
