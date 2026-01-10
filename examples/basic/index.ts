import { createBridge } from '@amux/llm-bridge'
import { openaiAdapter } from '@amux/adapter-openai'
import { anthropicAdapter } from '@amux/adapter-anthropic'

/**
 * Example 1: OpenAI format → Anthropic API
 *
 * User sends OpenAI-format request
 * Bridge converts to Anthropic format
 * Calls Claude API
 * Converts response back to OpenAI format
 */
async function example1() {
  console.log('\n=== Example 1: OpenAI → Anthropic ===\n')

  const bridge = createBridge({
    inbound: openaiAdapter,
    outbound: anthropicAdapter,
    config: {
      apiKey: process.env.ANTHROPIC_API_KEY || 'test-key',
      baseURL: 'https://api.anthropic.com',
    },
  })

  // Check compatibility
  const compat = bridge.checkCompatibility()
  console.log('Compatibility:', compat)

  // Get adapter info
  const adapters = bridge.getAdapters()
  console.log('Adapters:', adapters)

  // Send OpenAI-format request
  const request = {
    model: 'gpt-4',
    messages: [
      {
        role: 'user',
        content: 'Say "Hello from Amux!" in a friendly way.',
      },
    ],
    temperature: 0.7,
    max_tokens: 100,
  }

  console.log('\nRequest (OpenAI format):')
  console.log(JSON.stringify(request, null, 2))

  try {
    // This would call Claude API but return OpenAI-format response
    // const response = await bridge.chat(request)
    // console.log('\nResponse (OpenAI format):')
    // console.log(JSON.stringify(response, null, 2))

    console.log('\n✅ Bridge created successfully!')
    console.log('Note: Actual API call commented out to avoid using API credits')
  } catch (error) {
    console.error('Error:', error)
  }
}

/**
 * Example 2: Anthropic format → OpenAI API
 *
 * User sends Anthropic-format request
 * Bridge converts to OpenAI format
 * Calls OpenAI API
 * Converts response back to Anthropic format
 */
async function example2() {
  console.log('\n=== Example 2: Anthropic → OpenAI ===\n')

  const bridge = createBridge({
    inbound: anthropicAdapter,
    outbound: openaiAdapter,
    config: {
      apiKey: process.env.OPENAI_API_KEY || 'test-key',
      baseURL: 'https://api.openai.com',
    },
  })

  // Get adapter info
  const adapters = bridge.getAdapters()
  console.log('Adapters:', adapters)

  // Send Anthropic-format request
  const request = {
    model: 'claude-3-5-sonnet-20241022',
    messages: [
      {
        role: 'user',
        content: 'Say "Hello from Amux!" in a friendly way.',
      },
    ],
    max_tokens: 100,
    temperature: 0.7,
  }

  console.log('\nRequest (Anthropic format):')
  console.log(JSON.stringify(request, null, 2))

  try {
    // This would call OpenAI API but return Anthropic-format response
    // const response = await bridge.chat(request)
    // console.log('\nResponse (Anthropic format):')
    // console.log(JSON.stringify(response, null, 2))

    console.log('\n✅ Bridge created successfully!')
    console.log('Note: Actual API call commented out to avoid using API credits')
  } catch (error) {
    console.error('Error:', error)
  }
}

/**
 * Example 3: Test adapter conversion without API calls
 */
async function example3() {
  console.log('\n=== Example 3: Test Adapter Conversion ===\n')

  // Test OpenAI adapter
  console.log('Testing OpenAI adapter...')
  const openaiRequest = {
    model: 'gpt-4',
    messages: [{ role: 'user', content: 'Hello!' }],
    temperature: 0.7,
  }

  const ir1 = openaiAdapter.inbound.parseRequest(openaiRequest)
  console.log('\nOpenAI Request → IR:')
  console.log(JSON.stringify(ir1, null, 2))

  const anthropicRequest = anthropicAdapter.outbound.buildRequest(ir1)
  console.log('\nIR → Anthropic Request:')
  console.log(JSON.stringify(anthropicRequest, null, 2))

  // Test Anthropic adapter
  console.log('\n---\n')
  console.log('Testing Anthropic adapter...')
  const anthropicReq = {
    model: 'claude-3-5-sonnet-20241022',
    messages: [{ role: 'user', content: 'Hello!' }],
    max_tokens: 100,
  }

  const ir2 = anthropicAdapter.inbound.parseRequest(anthropicReq)
  console.log('\nAnthropic Request → IR:')
  console.log(JSON.stringify(ir2, null, 2))

  const openaiReq = openaiAdapter.outbound.buildRequest(ir2)
  console.log('\nIR → OpenAI Request:')
  console.log(JSON.stringify(openaiReq, null, 2))

  console.log('\n✅ Bidirectional conversion works!')
}

/**
 * Example 4: Adapter capabilities
 */
async function example4() {
  console.log('\n=== Example 4: Adapter Capabilities ===\n')

  console.log('OpenAI Adapter Capabilities:')
  console.log(JSON.stringify(openaiAdapter.capabilities, null, 2))

  console.log('\nAnthropic Adapter Capabilities:')
  console.log(JSON.stringify(anthropicAdapter.capabilities, null, 2))

  console.log('\nOpenAI Adapter Info:')
  console.log(JSON.stringify(openaiAdapter.getInfo(), null, 2))

  console.log('\nAnthropic Adapter Info:')
  console.log(JSON.stringify(anthropicAdapter.getInfo(), null, 2))

  console.log('\n✅ Adapter capabilities retrieved!')
}

/**
 * Example 5: Advanced features - Thinking/Reasoning, JSON Mode
 */
async function example5() {
  console.log('\n=== Example 5: Advanced Features ===\n')

  // Test thinking/reasoning configuration
  console.log('Testing thinking/reasoning configuration...')
  const thinkingRequest = {
    model: 'gpt-4',
    messages: [
      {
        role: 'user',
        content: 'Solve this step by step: What is 15% of 240?',
      },
    ],
    temperature: 0.7,
  }

  const ir = openaiAdapter.inbound.parseRequest(thinkingRequest)

  // Add thinking configuration to IR
  ir.generation = {
    ...ir.generation,
    thinking: {
      enabled: true,
      budgetTokens: 1000,
    },
  }

  console.log('\nIR with thinking configuration:')
  console.log(JSON.stringify(ir, null, 2))

  // Test JSON mode configuration
  console.log('\n---\n')
  console.log('Testing JSON mode configuration...')
  const jsonRequest = {
    model: 'gpt-4',
    messages: [
      {
        role: 'user',
        content: 'Return a JSON object with name and age fields.',
      },
    ],
    response_format: { type: 'json_object' },
  }

  const ir2 = openaiAdapter.inbound.parseRequest(jsonRequest)
  console.log('\nIR with JSON mode:')
  console.log(JSON.stringify(ir2, null, 2))

  console.log('\n✅ Advanced features work!')
}

// Run examples
async function main() {
  console.log('🚀 Amux - Basic Example\n')
  console.log('This example demonstrates bidirectional API conversion')
  console.log('between OpenAI and Anthropic formats.\n')

  await example1()
  await example2()
  await example3()
  await example4()
  await example5()

  console.log('\n✨ All examples completed!\n')
}

main().catch(console.error)
