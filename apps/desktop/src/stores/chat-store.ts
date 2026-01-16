/**
 * Chat state management
 */

import { create } from 'zustand'
import { ipc } from '@/lib/ipc'
import type { Conversation, ChatMessage } from '@/types'
import type { CreateConversationDTO, UpdateConversationDTO } from '@/types/ipc'

interface ChatState {
  // Conversations
  conversations: Conversation[]
  currentConversation: Conversation | null
  conversationsLoading: boolean

  // Messages
  messages: ChatMessage[]
  messagesLoading: boolean

  // Streaming state
  isStreaming: boolean
  streamingContent: string
  streamingReasoning: string

  // Selected proxy/provider
  selectedProxy: { type: 'provider' | 'proxy'; id: string } | null
  selectedModel: string | null

  // Error
  error: string | null
}

interface ChatActions {
  // Conversation actions
  fetchConversations: () => Promise<void>
  createConversation: (data: CreateConversationDTO) => Promise<Conversation>
  updateConversation: (id: string, data: UpdateConversationDTO) => Promise<Conversation | null>
  deleteConversation: (id: string) => Promise<boolean>
  selectConversation: (id: string | null) => Promise<void>

  // Message actions
  fetchMessages: (conversationId: string) => Promise<void>
  sendMessage: (content: string) => Promise<void>
  stopStreaming: () => Promise<void>
  deleteMessage: (messageId: string) => Promise<boolean>
  deleteMessagePair: (userMessageId: string) => Promise<boolean>
  regenerate: (assistantMessageId: string) => Promise<void>

  // Streaming handlers
  handleStreamStart: () => void
  handleStreamContent: (content: string) => void
  handleStreamReasoning: (reasoning: string) => void
  handleStreamEnd: (message: ChatMessage) => void
  handleStreamError: (error: string) => void

  // Selection actions
  setSelectedProxy: (proxy: { type: 'provider' | 'proxy'; id: string } | null) => void
  setSelectedModel: (model: string | null) => void

  // Reset
  reset: () => void
}

const initialState: ChatState = {
  conversations: [],
  currentConversation: null,
  conversationsLoading: false,
  messages: [],
  messagesLoading: false,
  isStreaming: false,
  streamingContent: '',
  streamingReasoning: '',
  selectedProxy: null,
  selectedModel: null,
  error: null
}

export const useChatStore = create<ChatState & ChatActions>((set, get) => ({
  ...initialState,

  // Fetch all conversations
  fetchConversations: async () => {
    set({ conversationsLoading: true, error: null })
    try {
      const conversations = await ipc.invoke('chat:list-conversations')
      set({ conversations, conversationsLoading: false })
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to fetch conversations',
        conversationsLoading: false
      })
    }
  },

  // Create a new conversation
  createConversation: async (data) => {
    const conversation = await ipc.invoke('chat:create-conversation', data)
    set({
      conversations: [conversation, ...get().conversations],
      currentConversation: conversation,
      messages: []
    })
    return conversation
  },

  // Update a conversation
  updateConversation: async (id, data) => {
    const updated = await ipc.invoke('chat:update-conversation', id, data)
    if (updated) {
      set({
        conversations: get().conversations.map(c => c.id === id ? updated : c),
        currentConversation: get().currentConversation?.id === id ? updated : get().currentConversation
      })
    }
    return updated
  },

  // Delete a conversation
  deleteConversation: async (id) => {
    const success = await ipc.invoke('chat:delete-conversation', id)
    if (success) {
      const { currentConversation, conversations } = get()
      set({
        conversations: conversations.filter(c => c.id !== id),
        currentConversation: currentConversation?.id === id ? null : currentConversation,
        messages: currentConversation?.id === id ? [] : get().messages
      })
    }
    return success
  },

  // Select a conversation
  selectConversation: async (id) => {
    if (!id) {
      set({ currentConversation: null, messages: [] })
      return
    }

    const conversation = await ipc.invoke('chat:get-conversation', id)
    if (conversation) {
      set({ currentConversation: conversation, messagesLoading: true })
      const messages = await ipc.invoke('chat:get-messages', id)
      set({ messages, messagesLoading: false })
    }
  },

  // Fetch messages for a conversation
  fetchMessages: async (conversationId) => {
    set({ messagesLoading: true })
    try {
      const messages = await ipc.invoke('chat:get-messages', conversationId)
      set({ messages, messagesLoading: false })
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to fetch messages',
        messagesLoading: false
      })
    }
  },

  // Send a message
  sendMessage: async (content) => {
    const { currentConversation, selectedProxy, selectedModel } = get()

    // Create conversation if not exists
    let conversationId = currentConversation?.id
    if (!conversationId) {
      if (!selectedProxy || !selectedModel) {
        set({ error: 'Please select a proxy and model first' })
        return
      }

      const newConversation = await get().createConversation({
        providerId: selectedProxy.type === 'provider' ? selectedProxy.id : undefined,
        proxyId: selectedProxy.type === 'proxy' ? selectedProxy.id : undefined,
        model: selectedModel
      })
      conversationId = newConversation.id
    }

    // Add user message to local state immediately
    const tempUserMessage: ChatMessage = {
      id: `temp-${Date.now()}`,
      conversationId,
      role: 'user',
      content,
      reasoning: null,
      toolCalls: null,
      usage: null,
      createdAt: Date.now()
    }
    set({ messages: [...get().messages, tempUserMessage] })

    // Send message via IPC
    try {
      await ipc.invoke('chat:send-message', conversationId, content)
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to send message' })
    }
  },

  // Stop streaming
  stopStreaming: async () => {
    const { currentConversation } = get()
    if (currentConversation) {
      await ipc.invoke('chat:stop-streaming', currentConversation.id)
    }
    set({ isStreaming: false })
  },

  // Delete a single message (assistant only)
  deleteMessage: async (messageId) => {
    const success = await ipc.invoke('chat:delete-message', messageId)
    if (success) {
      set({ messages: get().messages.filter(m => m.id !== messageId) })
    }
    return success
  },

  // Delete a message pair (user message and its following assistant response)
  deleteMessagePair: async (userMessageId) => {
    const { messages } = get()
    const userIndex = messages.findIndex(m => m.id === userMessageId)

    const success = await ipc.invoke('chat:delete-message-pair', userMessageId)
    if (success) {
      // Remove user message and the following assistant message
      const newMessages = messages.filter((m, index) => {
        if (m.id === userMessageId) return false
        if (index === userIndex + 1 && m.role === 'assistant') return false
        return true
      })
      set({ messages: newMessages })
    }
    return success
  },

  // Regenerate response
  regenerate: async (assistantMessageId) => {
    const { currentConversation } = get()
    if (!currentConversation) return

    // Remove the assistant message from local state
    set({ messages: get().messages.filter(m => m.id !== assistantMessageId) })

    // Call regenerate IPC
    try {
      await ipc.invoke('chat:regenerate', currentConversation.id, assistantMessageId)
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to regenerate' })
    }
  },

  // Stream handlers
  handleStreamStart: () => {
    set({
      isStreaming: true,
      streamingContent: '',
      streamingReasoning: '',
      error: null
    })
  },

  handleStreamContent: (content) => {
    set({ streamingContent: get().streamingContent + content })
  },

  handleStreamReasoning: (reasoning) => {
    set({ streamingReasoning: get().streamingReasoning + reasoning })
  },

  handleStreamEnd: (_message) => {
    const { messages, currentConversation, conversations } = get()

    // Fetch fresh messages to get the real user message
    if (currentConversation) {
      ipc.invoke('chat:get-messages', currentConversation.id).then(freshMessages => {
        set({ messages: freshMessages })
      })
    }

    // Update conversation title if it was just created
    if (currentConversation && !currentConversation.title) {
      const firstUserMessage = messages.find(m => m.role === 'user')
      if (firstUserMessage?.content) {
        const title = firstUserMessage.content.slice(0, 20) + (firstUserMessage.content.length > 20 ? '...' : '')
        set({
          currentConversation: { ...currentConversation, title },
          conversations: conversations.map(c =>
            c.id === currentConversation.id ? { ...c, title } : c
          )
        })
      }
    }

    set({
      isStreaming: false,
      streamingContent: '',
      streamingReasoning: ''
    })
  },

  handleStreamError: (error) => {
    set({
      isStreaming: false,
      streamingContent: '',
      streamingReasoning: '',
      error
    })
  },

  // Selection actions
  setSelectedProxy: (proxy) => {
    set({ selectedProxy: proxy })
  },

  setSelectedModel: (model) => {
    set({ selectedModel: model })
  },

  // Reset store
  reset: () => {
    set(initialState)
  }
}))
