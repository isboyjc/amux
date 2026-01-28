import { describe, expect, it } from 'vitest'

import { minimaxAdapter } from '../src/adapter'

describe('MiniMax Adapter', () => {
  describe('Inbound - parseRequest', () => {
    it('should parse basic MiniMax request to IR', () => {
      const request = {
        model: 'MiniMax-M2.1',
        messages: [
          { role: 'user', content: 'Hello!' },
        ],
        temperature: 0.7,
        max_tokens: 100,
      }

      const ir = minimaxAdapter.inbound.parseRequest(request)

      expect(ir.model).toBe('MiniMax-M2.1')
      expect(ir.messages).toHaveLength(1)
      expect(ir.messages[0]?.role).toBe('user')
      expect(ir.messages[0]?.content).toBe('Hello!')
      expect(ir.generation?.temperature).toBe(0.7)
      expect(ir.generation?.maxTokens).toBe(100)
    })

    it('should parse request with system message to IR.system', () => {
      const request = {
        model: 'MiniMax-M2.1',
        messages: [
          { role: 'system', content: 'You are a helpful assistant.' },
          { role: 'user', content: 'Hello!' },
        ],
      }

      const ir = minimaxAdapter.inbound.parseRequest(request)

      expect(ir.system).toBe('You are a helpful assistant.')
      expect(ir.messages).toHaveLength(1)
      expect(ir.messages[0]?.role).toBe('user')
    })

    it('should parse request with tools', () => {
      const request = {
        model: 'MiniMax-M2.1',
        messages: [{ role: 'user', content: 'What is the weather?' }],
        tools: [
          {
            type: 'function',
            function: {
              name: 'get_weather',
              description: 'Get weather',
              parameters: {
                type: 'object',
                properties: {
                  location: { type: 'string' },
                },
              },
            },
          },
        ],
        tool_choice: 'auto',
      }

      const ir = minimaxAdapter.inbound.parseRequest(request)

      expect(ir.tools).toHaveLength(1)
      expect(ir.tools?.[0]?.function.name).toBe('get_weather')
      expect(ir.toolChoice).toBe('auto')
    })

    it('should parse request with reasoning_split parameter', () => {
      const request = {
        model: 'MiniMax-M2.1',
        messages: [{ role: 'user', content: 'Solve this problem' }],
        reasoning_split: true,
      }

      const ir = minimaxAdapter.inbound.parseRequest(request)

      expect(ir.extensions?.minimax).toBeDefined()
      expect((ir.extensions?.minimax as { reasoning_split: boolean }).reasoning_split).toBe(true)
    })

    it('should parse message with reasoning_details', () => {
      const request = {
        model: 'MiniMax-M2.1',
        messages: [
          {
            role: 'assistant',
            content: 'The answer is 42.',
            reasoning_details: [
              {
                type: 'thinking',
                text: 'Let me think step by step...',
              },
            ],
          },
        ],
      }

      const ir = minimaxAdapter.inbound.parseRequest(request)

      expect(ir.messages[0]?.reasoningContent).toBe('Let me think step by step...')
    })

    it('should parse message with multiple reasoning_details', () => {
      const request = {
        model: 'MiniMax-M2.1',
        messages: [
          {
            role: 'assistant',
            content: 'The answer is 42.',
            reasoning_details: [
              { type: 'thinking', text: 'First, I consider...' },
              { type: 'thinking', text: 'Then, I realize...' },
            ],
          },
        ],
      }

      const ir = minimaxAdapter.inbound.parseRequest(request)

      expect(ir.messages[0]?.reasoningContent).toBe('First, I consider...\nThen, I realize...')
    })
  })

  describe('Outbound - buildRequest', () => {
    it('should build MiniMax request from IR', () => {
      const ir = {
        messages: [
          { role: 'user' as const, content: 'Hello!' },
        ],
        model: 'MiniMax-M2.1',
        generation: {
          temperature: 0.7,
          maxTokens: 100,
        },
      }

      const request = minimaxAdapter.outbound.buildRequest(ir) as Record<string, unknown>

      expect(request).toMatchObject({
        model: 'MiniMax-M2.1',
        temperature: 0.7,
        max_tokens: 100,
      })
    })

    it('should build request with system message from IR.system', () => {
      const ir = {
        messages: [
          { role: 'user' as const, content: 'Hello!' },
        ],
        model: 'MiniMax-M2.1',
        system: 'You are a helpful assistant.',
      }

      const request = minimaxAdapter.outbound.buildRequest(ir) as { messages: Array<{ role: string; content: string }> }

      expect(request.messages).toHaveLength(2)
      expect(request.messages[0]?.role).toBe('system')
      expect(request.messages[0]?.content).toBe('You are a helpful assistant.')
    })

    it('should build request with reasoning_split from extensions', () => {
      const ir = {
        messages: [{ role: 'user' as const, content: 'Solve this' }],
        model: 'MiniMax-M2.1',
        extensions: {
          minimax: {
            reasoning_split: true,
          },
        },
      }

      const request = minimaxAdapter.outbound.buildRequest(ir) as { reasoning_split: boolean }

      expect(request.reasoning_split).toBe(true)
    })

    it('should convert reasoningContent to reasoning_details', () => {
      const ir = {
        messages: [
          {
            role: 'assistant' as const,
            content: 'The answer is 42.',
            reasoningContent: 'Let me think step by step...',
          },
        ],
        model: 'MiniMax-M2.1',
      }

      const request = minimaxAdapter.outbound.buildRequest(ir) as {
        messages: Array<{
          reasoning_details?: Array<{ type: string; text: string }>
        }>
      }

      expect(request.messages[0]?.reasoning_details).toHaveLength(1)
      expect(request.messages[0]?.reasoning_details?.[0]?.type).toBe('thinking')
      expect(request.messages[0]?.reasoning_details?.[0]?.text).toBe('Let me think step by step...')
    })

    it('should clamp temperature to valid range', () => {
      const ir1 = {
        messages: [{ role: 'user' as const, content: 'Hello' }],
        model: 'MiniMax-M2.1',
        generation: { temperature: 0 },
      }

      const request1 = minimaxAdapter.outbound.buildRequest(ir1) as { temperature: number }
      expect(request1.temperature).toBe(0.01)

      const ir2 = {
        messages: [{ role: 'user' as const, content: 'Hello' }],
        model: 'MiniMax-M2.1',
        generation: { temperature: 1.5 },
      }

      const request2 = minimaxAdapter.outbound.buildRequest(ir2) as { temperature: number }
      expect(request2.temperature).toBe(1.0)
    })

    it('should add stream_options when streaming is enabled', () => {
      const ir = {
        messages: [{ role: 'user' as const, content: 'Hello' }],
        model: 'MiniMax-M2.1',
        stream: true,
      }

      const request = minimaxAdapter.outbound.buildRequest(ir) as {
        stream_options?: { include_usage: boolean }
      }

      expect(request.stream_options?.include_usage).toBe(true)
    })
  })

  describe('Inbound - parseResponse', () => {
    it('should parse MiniMax response to IR', () => {
      const response = {
        id: 'chatcmpl-123',
        object: 'chat.completion',
        created: 1234567890,
        model: 'MiniMax-M2.1',
        choices: [
          {
            index: 0,
            message: {
              role: 'assistant',
              content: 'Hello! How can I help you?',
            },
            finish_reason: 'stop',
          },
        ],
        usage: {
          prompt_tokens: 10,
          completion_tokens: 20,
          total_tokens: 30,
        },
      }

      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      const ir = minimaxAdapter.inbound.parseResponse!(response)

      expect(ir.id).toBe('chatcmpl-123')
      expect(ir.model).toBe('MiniMax-M2.1')
      expect(ir.choices).toHaveLength(1)
      expect(ir.choices[0]?.message.content).toBe('Hello! How can I help you?')
      expect(ir.usage?.promptTokens).toBe(10)
      expect(ir.usage?.completionTokens).toBe(20)
    })

    it('should parse response with reasoning_details', () => {
      const response = {
        id: 'chatcmpl-123',
        object: 'chat.completion',
        created: 1234567890,
        model: 'MiniMax-M2.1',
        choices: [
          {
            index: 0,
            message: {
              role: 'assistant',
              content: 'The answer is 42.',
              reasoning_details: [
                {
                  type: 'thinking',
                  text: 'Let me think about this...',
                },
              ],
            },
            finish_reason: 'stop',
          },
        ],
        usage: {
          prompt_tokens: 10,
          completion_tokens: 20,
          total_tokens: 30,
          completion_tokens_details: {
            reasoning_tokens: 15,
          },
        },
      }

      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      const ir = minimaxAdapter.inbound.parseResponse!(response)

      expect(ir.choices[0]?.message.reasoningContent).toBe('Let me think about this...')
      expect(ir.usage?.details?.reasoningTokens).toBe(15)
    })

    it('should parse response with tool calls', () => {
      const response = {
        id: 'chatcmpl-123',
        object: 'chat.completion',
        created: 1234567890,
        model: 'MiniMax-M2.1',
        choices: [
          {
            index: 0,
            message: {
              role: 'assistant',
              content: null,
              tool_calls: [
                {
                  id: 'call_123',
                  type: 'function',
                  function: {
                    name: 'get_weather',
                    arguments: '{"location":"Beijing"}',
                  },
                },
              ],
            },
            finish_reason: 'tool_calls',
          },
        ],
      }

      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      const ir = minimaxAdapter.inbound.parseResponse!(response)

      expect(ir.choices[0]?.message.toolCalls).toHaveLength(1)
      expect(ir.choices[0]?.message.toolCalls?.[0]?.function.name).toBe('get_weather')
      expect(ir.choices[0]?.finishReason).toBe('tool_calls')
    })
  })

  describe('Inbound - parseStream', () => {
    it('should parse start chunk', () => {
      const chunk = {
        id: 'chatcmpl-123',
        object: 'chat.completion.chunk',
        created: 1234567890,
        model: 'MiniMax-M2.1',
        choices: [
          {
            index: 0,
            delta: {
              role: 'assistant',
            },
            finish_reason: null,
          },
        ],
      }

      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      const event = minimaxAdapter.inbound.parseStream!(chunk)

      expect(event).not.toBeNull()
      expect(event).toMatchObject({
        type: 'start',
        id: 'chatcmpl-123',
        model: 'MiniMax-M2.1',
      })
    })

    it('should parse content chunk', () => {
      const chunk = {
        id: 'chatcmpl-123',
        object: 'chat.completion.chunk',
        created: 1234567890,
        model: 'MiniMax-M2.1',
        choices: [
          {
            index: 0,
            delta: {
              content: 'Hello',
            },
            finish_reason: null,
          },
        ],
      }

      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      const event = minimaxAdapter.inbound.parseStream!(chunk)

      expect(event).not.toBeNull()
      expect(event).toMatchObject({
        type: 'content',
        content: {
          type: 'content',
          delta: 'Hello',
        },
      })
    })

    it('should parse reasoning chunk', () => {
      const chunk = {
        id: 'chatcmpl-123',
        object: 'chat.completion.chunk',
        created: 1234567890,
        model: 'MiniMax-M2.1',
        choices: [
          {
            index: 0,
            delta: {
              reasoning_details: [
                {
                  type: 'thinking',
                  text: 'Let me think...',
                },
              ],
            },
            finish_reason: null,
          },
        ],
      }

      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      const event = minimaxAdapter.inbound.parseStream!(chunk)

      expect(event).not.toBeNull()
      expect(event).toMatchObject({
        type: 'reasoning',
        reasoning: {
          type: 'reasoning',
          delta: 'Let me think...',
        },
      })
    })

    it('should parse end chunk with usage', () => {
      const chunk = {
        id: 'chatcmpl-123',
        object: 'chat.completion.chunk',
        created: 1234567890,
        model: 'MiniMax-M2.1',
        choices: [
          {
            index: 0,
            delta: {},
            finish_reason: 'stop',
          },
        ],
        usage: {
          prompt_tokens: 10,
          completion_tokens: 20,
          total_tokens: 30,
          completion_tokens_details: {
            reasoning_tokens: 15,
          },
        },
      }

      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      const event = minimaxAdapter.inbound.parseStream!(chunk)

      expect(event).not.toBeNull()
      expect(event).toMatchObject({
        type: 'end',
        finishReason: 'stop',
        usage: {
          promptTokens: 10,
          completionTokens: 20,
          totalTokens: 30,
          details: {
            reasoningTokens: 15,
          },
        },
      })
    })
  })

  describe('Special Scenarios', () => {
    it('should preserve <think> tags in content (native OpenAI format)', () => {
      const response = {
        id: 'chatcmpl-123',
        object: 'chat.completion',
        created: 1234567890,
        model: 'MiniMax-M2.1',
        choices: [
          {
            index: 0,
            message: {
              role: 'assistant',
              content: '<think>让我思考一下这个问题...</think>答案是42。',
            },
            finish_reason: 'stop',
          },
        ],
      }

      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      const ir = minimaxAdapter.inbound.parseResponse!(response)
      expect(ir.choices[0]?.message.content).toBe('<think>让我思考一下这个问题...</think>答案是42。')

      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      const rebuilt = minimaxAdapter.outbound.buildResponse!(ir) as typeof response
      expect(rebuilt.choices[0]?.message.content).toBe('<think>让我思考一下这个问题...</think>答案是42。')
    })

    it('should preserve assistant messages with tool_calls in multi-turn conversation', () => {
      const ir = {
        messages: [
          { role: 'user' as const, content: 'What is the weather in Beijing?' },
          {
            role: 'assistant' as const,
            content: '',
            toolCalls: [
              {
                id: 'call_123',
                type: 'function' as const,
                function: { name: 'get_weather', arguments: '{"city":"Beijing"}' },
              },
            ],
          },
          { role: 'tool' as const, content: '{"temperature": 20}', toolCallId: 'call_123' },
          { role: 'assistant' as const, content: 'The temperature is 20°C.' },
        ],
        model: 'MiniMax-M2.1',
      }

      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      const request = minimaxAdapter.outbound.buildRequest!(ir) as Record<string, unknown>

      expect(request.messages).toHaveLength(4)
      const messages = request.messages as Array<Record<string, unknown>>
      expect(messages[1]?.role).toBe('assistant')
      expect(messages[1]?.tool_calls).toBeDefined()
      const toolCalls = messages[1]?.tool_calls as Array<Record<string, unknown>>
      expect(toolCalls?.[0]?.id).toBe('call_123')
      expect(messages[2]?.role).toBe('tool')
      expect(messages[2]?.tool_call_id).toBe('call_123')
    })

    it('should preserve reasoning_details with reasoning_split parameter', () => {
      const ir = {
        messages: [
          { role: 'user' as const, content: 'Calculate 2 + 2' },
          {
            role: 'assistant' as const,
            content: 'The answer is 4.',
            reasoningContent: 'Step 1: Add numbers\nStep 2: Result is 4',
          },
        ],
        model: 'MiniMax-M2.1',
        extensions: { minimax: { reasoning_split: true } },
      }

      const request = minimaxAdapter.outbound.buildRequest(ir) as {
        reasoning_split?: boolean
        messages: Array<{ reasoning_details?: Array<{ type: string; text: string }> }>
      }

      expect(request.reasoning_split).toBe(true)
      expect(request.messages[1]?.reasoning_details).toBeDefined()
      expect(request.messages[1]?.reasoning_details?.[0]?.type).toBe('thinking')
      expect(request.messages[1]?.reasoning_details?.[0]?.text).toContain('Step 1')
    })
  })

  describe('Adapter Info', () => {
    it('should provide correct adapter info', () => {
      const info = minimaxAdapter.getInfo()

      expect(info.name).toBe('minimax')
      expect(info.version).toBe('1.0.0')
      expect(info.capabilities.streaming).toBe(true)
      expect(info.capabilities.tools).toBe(true)
      expect(info.capabilities.reasoning).toBe(true)
      expect(info.endpoint?.baseUrl).toBe('https://api.minimaxi.com/v1/')
      expect(info.endpoint?.chatPath).toBe('/chat/completions')
    })

    it('should have correct capability flags', () => {
      const { capabilities } = minimaxAdapter

      expect(capabilities.streaming).toBe(true)
      expect(capabilities.tools).toBe(true)
      expect(capabilities.systemPrompt).toBe(true)
      expect(capabilities.toolChoice).toBe(true)
      expect(capabilities.reasoning).toBe(true)
      expect(capabilities.jsonMode).toBe(true)
      expect(capabilities.vision).toBe(false)
      expect(capabilities.multimodal).toBe(false)
      expect(capabilities.webSearch).toBe(false)
      expect(capabilities.logprobs).toBe(false)
      expect(capabilities.seed).toBe(false)
    })
  })
})
