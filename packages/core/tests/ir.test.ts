import { describe, it, expect } from 'vitest'
import type { LLMRequestIR } from '../src/ir/request'
import type { LLMResponseIR } from '../src/ir/response'
import type { LLMStreamEvent } from '../src/ir/stream'
import type { Message } from '../src/types/message'

describe('IR Types', () => {
  it('should create a valid LLMRequestIR', () => {
    const messages: Message[] = [
      {
        role: 'user',
        content: 'Hello, world!',
      },
    ]

    const request: LLMRequestIR = {
      messages,
      model: 'gpt-4',
      stream: false,
      generation: {
        temperature: 0.7,
        maxTokens: 100,
      },
    }

    expect(request.messages).toHaveLength(1)
    expect(request.messages[0]?.role).toBe('user')
    expect(request.model).toBe('gpt-4')
    expect(request.generation?.temperature).toBe(0.7)
  })

  it('should support multimodal content', () => {
    const request: LLMRequestIR = {
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: 'What is in this image?' },
            {
              type: 'image',
              source: {
                type: 'url',
                url: 'https://example.com/image.jpg',
              },
            },
          ],
        },
      ],
    }

    expect(request.messages[0]?.content).toBeInstanceOf(Array)
    const content = request.messages[0]?.content as Array<{ type: string }>
    expect(content).toHaveLength(2)
    expect(content[0]?.type).toBe('text')
    expect(content[1]?.type).toBe('image')
  })

  it('should support tool calls', () => {
    const request: LLMRequestIR = {
      messages: [
        {
          role: 'user',
          content: 'What is the weather?',
        },
      ],
      tools: [
        {
          type: 'function',
          function: {
            name: 'get_weather',
            description: 'Get the current weather',
            parameters: {
              type: 'object',
              properties: {
                location: { type: 'string' },
              },
              required: ['location'],
            },
          },
        },
      ],
      toolChoice: 'auto',
    }

    expect(request.tools).toHaveLength(1)
    expect(request.tools?.[0]?.function.name).toBe('get_weather')
    expect(request.toolChoice).toBe('auto')
  })

  it('should support thinking/reasoning configuration', () => {
    const request: LLMRequestIR = {
      messages: [
        {
          role: 'user',
          content: 'Solve this complex math problem step by step.',
        },
      ],
      model: 'deepseek-reasoner',
      generation: {
        temperature: 0.7,
        maxTokens: 4000,
        thinking: {
          enabled: true,
          budgetTokens: 2000,
        },
      },
    }

    expect(request.generation?.thinking?.enabled).toBe(true)
    expect(request.generation?.thinking?.budgetTokens).toBe(2000)
  })

  it('should support response format configuration', () => {
    const request: LLMRequestIR = {
      messages: [
        {
          role: 'user',
          content: 'Return a JSON object with name and age.',
        },
      ],
      generation: {
        responseFormat: {
          type: 'json_schema',
          jsonSchema: {
            name: 'person',
            description: 'A person object',
            schema: {
              type: 'object',
              properties: {
                name: { type: 'string' },
                age: { type: 'number' },
              },
              required: ['name', 'age'],
            },
            strict: true,
          },
        },
      },
    }

    expect(request.generation?.responseFormat?.type).toBe('json_schema')
    expect(request.generation?.responseFormat?.jsonSchema?.name).toBe('person')
    expect(request.generation?.responseFormat?.jsonSchema?.strict).toBe(true)
  })

  it('should support logprobs configuration', () => {
    const request: LLMRequestIR = {
      messages: [
        {
          role: 'user',
          content: 'Hello!',
        },
      ],
      generation: {
        logprobs: true,
        topLogprobs: 5,
      },
    }

    expect(request.generation?.logprobs).toBe(true)
    expect(request.generation?.topLogprobs).toBe(5)
  })

  it('should support web search configuration', () => {
    const request: LLMRequestIR = {
      messages: [
        {
          role: 'user',
          content: 'What are the latest news about AI?',
        },
      ],
      model: 'qwen-plus',
      generation: {
        enableSearch: true,
      },
    }

    expect(request.generation?.enableSearch).toBe(true)
  })

  it('should support reasoning content in messages', () => {
    const message: Message = {
      role: 'assistant',
      content: 'The answer is 42.',
      reasoningContent: 'Let me think about this step by step...',
    }

    expect(message.reasoningContent).toBe(
      'Let me think about this step by step...'
    )
  })

  it('should support detailed usage statistics in response', () => {
    const response: LLMResponseIR = {
      id: 'resp_123',
      model: 'deepseek-reasoner',
      choices: [
        {
          index: 0,
          message: {
            role: 'assistant',
            content: 'The answer is 42.',
            reasoningContent: 'Thinking process...',
          },
          finishReason: 'stop',
        },
      ],
      usage: {
        promptTokens: 100,
        completionTokens: 200,
        totalTokens: 300,
        details: {
          reasoningTokens: 150,
          cachedTokens: 50,
        },
      },
    }

    expect(response.usage?.details?.reasoningTokens).toBe(150)
    expect(response.usage?.details?.cachedTokens).toBe(50)
  })

  it('should support reasoning stream events', () => {
    const event: LLMStreamEvent = {
      type: 'reasoning',
      reasoning: {
        type: 'reasoning',
        delta: 'Let me think...',
        index: 0,
      },
    }

    expect(event.type).toBe('reasoning')
    expect(event.reasoning?.delta).toBe('Let me think...')
  })

  it('should support logprobs in response choices', () => {
    const response: LLMResponseIR = {
      id: 'resp_456',
      model: 'gpt-4',
      choices: [
        {
          index: 0,
          message: {
            role: 'assistant',
            content: 'Hello!',
          },
          finishReason: 'stop',
          logprobs: {
            content: [
              {
                token: 'Hello',
                logprob: -0.5,
                topLogprobs: [
                  { token: 'Hello', logprob: -0.5 },
                  { token: 'Hi', logprob: -1.2 },
                ],
              },
            ],
          },
        },
      ],
    }

    expect(response.choices[0]?.logprobs?.content?.[0]?.token).toBe('Hello')
    expect(response.choices[0]?.logprobs?.content?.[0]?.topLogprobs).toHaveLength(2)
  })
})
