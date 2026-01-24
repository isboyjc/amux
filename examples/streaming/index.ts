import { createBridge } from '@amux.ai/llm-bridge'
import { anthropicAdapter } from '@amux.ai/adapter-anthropic'
import { openaiAdapter } from '@amux.ai/adapter-openai'

/**
 * Example: Streaming with OpenAI → Anthropic
 */
async function streamingExample() {
  console.log('\n=== Streaming Example: OpenAI → Anthropic ===\n')

  const bridge = createBridge({
    inbound: openaiAdapter,
    outbound: anthropicAdapter,
    config: {
      apiKey: process.env.ANTHROPIC_API_KEY || 'test-key',
    },
  })

  console.log('Request: Tell me a short story about AI\n')
  console.log('Response (streaming):')
  console.log('---')

  try {
    // Note: Actual streaming requires real API key
    // This is a demonstration of the API

    // for await (const chunk of bridge.chatStream({
    //   model: 'gpt-4',
    //   messages: [
    //     { role: 'user', content: 'Tell me a short story about AI in 3 sentences.' }
    //   ],
    //   stream: true
    // })) {
    //   if (chunk.type === 'content' && chunk.content?.delta) {
    //     process.stdout.write(chunk.content.delta)
    //   }
    // }

    console.log('(Streaming demonstration - uncomment code to test with real API)')
    console.log('\n✅ Streaming API is ready to use!')
  } catch (error) {
    console.error('Error:', error)
  }

  console.log('\n---\n')
}

/**
 * Example: Demonstrate stream event types
 */
async function streamEventTypesExample() {
  console.log('\n=== Stream Event Types ===\n')

  console.log('Amux supports the following stream event types:')
  console.log('1. start - Stream started')
  console.log('2. content - Content delta (text chunks)')
  console.log('3. reasoning - Reasoning/thinking content delta (DeepSeek, Qwen, Anthropic)')
  console.log('4. tool_call - Tool call delta')
  console.log('5. end - Stream ended')
  console.log('6. error - Error occurred')

  console.log('\nExample content event structure:')
  console.log(JSON.stringify({
    type: 'content',
    id: 'msg_123',
    model: 'claude-3-5-sonnet-20241022',
    content: {
      type: 'content',
      delta: 'Hello',
      index: 0,
    },
  }, null, 2))

  console.log('\nExample reasoning event structure:')
  console.log(JSON.stringify({
    type: 'reasoning',
    id: 'msg_123',
    model: 'deepseek-reasoner',
    reasoning: {
      type: 'reasoning',
      delta: 'Let me think about this step by step...',
      index: 0,
    },
  }, null, 2))

  console.log('\n✅ All adapters support these event types!')
}

/**
 * Example: Streaming with reasoning/thinking support
 */
async function streamingWithReasoningExample() {
  console.log('\n=== Streaming with Reasoning Support ===\n')

  console.log('When using models that support reasoning (DeepSeek, Qwen QwQ, Anthropic),')
  console.log('you can receive both reasoning and content events in the stream.\n')

  console.log('Example stream flow with reasoning:')
  console.log('---')

  const exampleEvents = [
    { type: 'start', id: 'stream_123', model: 'deepseek-reasoner' },
    { type: 'reasoning', reasoning: { type: 'reasoning', delta: 'Let me analyze this problem...' } },
    { type: 'reasoning', reasoning: { type: 'reasoning', delta: ' First, I need to consider...' } },
    { type: 'content', content: { type: 'content', delta: 'Based on my analysis, ' } },
    { type: 'content', content: { type: 'content', delta: 'the answer is 42.' } },
    { type: 'end', finishReason: 'stop', message: { role: 'assistant', content: 'Based on my analysis, the answer is 42.', reasoningContent: 'Let me analyze this problem... First, I need to consider...' } },
  ]

  for (const event of exampleEvents) {
    console.log(JSON.stringify(event))
  }

  console.log('---')

  console.log('\nHandling reasoning events in your code:')
  console.log(`
for await (const event of bridge.chatStream(request)) {
  switch (event.type) {
    case 'start':
      console.log('Stream started:', event.id)
      break
    case 'reasoning':
      // Handle reasoning/thinking content
      process.stdout.write('[Thinking] ' + event.reasoning?.delta)
      break
    case 'content':
      // Handle regular content
      process.stdout.write(event.content?.delta)
      break
    case 'end':
      console.log('\\nStream ended:', event.finishReason)
      // Access full reasoning content from final message
      if (event.message?.reasoningContent) {
        console.log('Full reasoning:', event.message.reasoningContent)
      }
      break
    case 'error':
      console.error('Error:', event.error?.message)
      break
  }
}
`)

  console.log('\n✅ Reasoning stream events are fully supported!')
}

/**
 * Example: Adapter capabilities for streaming
 */
async function adapterCapabilitiesExample() {
  console.log('\n=== Adapter Streaming Capabilities ===\n')

  console.log('OpenAI Adapter:')
  console.log('  - streaming:', openaiAdapter.capabilities.streaming)
  console.log('  - reasoning:', openaiAdapter.capabilities.reasoning)

  console.log('\nAnthropic Adapter:')
  console.log('  - streaming:', anthropicAdapter.capabilities.streaming)
  console.log('  - reasoning:', anthropicAdapter.capabilities.reasoning)

  console.log('\nNote: Reasoning capability indicates support for extended thinking/chain-of-thought.')
  console.log('Providers with reasoning support: DeepSeek, Qwen (QwQ), Anthropic (extended thinking)')

  console.log('\n✅ Check adapter capabilities before using advanced features!')
}

/**
 * Main function
 */
async function main() {
  console.log('🚀 Amux - Streaming Example\n')
  console.log('This example demonstrates streaming capabilities.\n')

  await streamingExample()
  await streamEventTypesExample()
  await streamingWithReasoningExample()
  await adapterCapabilitiesExample()

  console.log('\n✨ Streaming examples completed!\n')
  console.log('💡 Tip: Set ANTHROPIC_API_KEY to test with real API\n')
}

main().catch(console.error)
