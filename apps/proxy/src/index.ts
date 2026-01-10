/**
 * Amux Proxy Server
 *
 * This proxy server provides bidirectional API conversion between different LLM providers.
 * It allows you to use any supported provider as a backend while using another provider's API format.
 *
 * Routes:
 *   /{inbound}-{outbound}/...  - Convert from inbound format to outbound provider
 *
 * Available routes:
 *   /openai-anthropic/v1/chat/completions        - OpenAI API → Anthropic
 *   /openai-deepseek/v1/chat/completions         - OpenAI API → DeepSeek
 *   /openai-moonshot/v1/chat/completions         - OpenAI API → Moonshot
 *   /openai-zhipu/v1/chat/completions            - OpenAI API → Zhipu
 *   /openai-responses-anthropic/v1/responses    - OpenAI Responses API → Anthropic
 *   /openai-responses-deepseek/v1/responses     - OpenAI Responses API → DeepSeek
 *   /anthropic-openai/v1/messages                - Anthropic API → OpenAI
 *   /anthropic-deepseek/v1/messages              - Anthropic API → DeepSeek
 *   /deepseek-anthropic/v1/chat/completions      - DeepSeek API → Anthropic
 *   /deepseek-openai/v1/chat/completions         - DeepSeek API → OpenAI
 *   /moonshot-openai/v1/chat/completions         - Moonshot API → OpenAI
 *   ... and more
 *
 * Environment variables:
 *   - PORT: Server port (default: 8000)
 *   - OPENAI_API_KEY: OpenAI API key (optional, can use request header)
 *   - OPENAI_BASE_URL: Custom OpenAI API base URL (optional)
 *   - DEEPSEEK_API_KEY: DeepSeek API key (optional, can use request header)
 *   - DEEPSEEK_BASE_URL: Custom DeepSeek API base URL (optional)
 *   - ANTHROPIC_API_KEY: Anthropic API key (optional, can use request header)
 *   - ANTHROPIC_BASE_URL: Custom Anthropic API base URL (optional)
 *   - MOONSHOT_API_KEY: Moonshot API key (optional, can use request header)
 *   - MOONSHOT_BASE_URL: Custom Moonshot API base URL (optional)
 *   - ZHIPU_API_KEY: Zhipu API key (optional, can use request header)
 *   - ZHIPU_BASE_URL: Custom Zhipu API base URL (optional)
 */

import express from 'express'
import { adapters } from './adapters'
import { routes, createBridgeRouter } from './routes'

const app = express()
const PORT = process.env.PORT ? parseInt(process.env.PORT) : 8000

// ============================================================================
// Middleware
// ============================================================================

app.use(express.json({ limit: '10mb' }))

// CORS
app.use((_req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*')
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-api-key, anthropic-version')
  next()
})

// Handle CORS preflight
app.options('/{*path}', (_req, res) => {
  res.sendStatus(204)
})

// ============================================================================
// Health Check
// ============================================================================

app.get(['/', '/health'], (_req, res) => {
  const availableRoutes = routes.map(r => ({
    path: `/${r.inbound}-${r.outbound}${r.endpoint}`,
    inbound: r.inbound,
    outbound: r.outbound,
    modelMapping: r.modelMapping,
  }))

  res.json({
    status: 'ok',
    service: 'amux-proxy',
    version: '0.0.1',
    routes: availableRoutes,
    adapters: Object.keys(adapters),
  })
})

// ============================================================================
// Register Routes
// ============================================================================

for (const config of routes) {
  const routePath = `/${config.inbound}-${config.outbound}`
  const router = createBridgeRouter(config)
  app.use(routePath, router)
}

// ============================================================================
// Start Server
// ============================================================================

app.listen(PORT, () => {
  const routeList = routes
    .map(r => `║    ${`/${r.inbound}-${r.outbound}${r.endpoint}`.padEnd(50)}║`)
    .join('\n')

  const envVars = [
    ['OPENAI_API_KEY', process.env.OPENAI_API_KEY ? 'Set' : 'Not set'],
    ['OPENAI_BASE_URL', process.env.OPENAI_BASE_URL || 'Default'],
    ['DEEPSEEK_API_KEY', process.env.DEEPSEEK_API_KEY ? 'Set' : 'Not set'],
    ['DEEPSEEK_BASE_URL', process.env.DEEPSEEK_BASE_URL || 'Default'],
    ['ANTHROPIC_API_KEY', process.env.ANTHROPIC_API_KEY ? 'Set' : 'Not set'],
    ['ANTHROPIC_BASE_URL', process.env.ANTHROPIC_BASE_URL || 'https://52ai.org'],
    ['MOONSHOT_API_KEY', process.env.MOONSHOT_API_KEY ? 'Set' : 'Not set'],
    ['MOONSHOT_BASE_URL', process.env.MOONSHOT_BASE_URL || 'Default'],
    ['ZHIPU_API_KEY', process.env.ZHIPU_API_KEY ? 'Set' : 'Not set'],
    ['ZHIPU_BASE_URL', process.env.ZHIPU_BASE_URL || 'Default'],
  ]
    .map(([name, value]) => `║    ${name?.padEnd(20)}${value?.padEnd(32)}║`)
    .join('\n')

  console.log(`
╔═══════════════════════════════════════════════════════════════╗
║                     Amux Proxy Server                         ║
╠═══════════════════════════════════════════════════════════════╣
║  Status:    Running                                           ║
║  Port:      ${String(PORT).padEnd(50)}║
║  Health:    http://localhost:${PORT}/${' '.repeat(Math.max(0, 32 - String(PORT).length))}║
╠═══════════════════════════════════════════════════════════════╣
║  Available Routes:                                            ║
${routeList}
╠═══════════════════════════════════════════════════════════════╣
║  Environment Variables:                                       ║
${envVars}
╠═══════════════════════════════════════════════════════════════╣
║  Usage Examples:                                              ║
║                                                               ║
║  OpenAI -> DeepSeek:                                          ║
║    BASE_URL=http://localhost:${PORT}/openai-deepseek${' '.repeat(Math.max(0, 11 - String(PORT).length))}║
║    API_KEY=<your-deepseek-api-key>                            ║
║                                                               ║
║  OpenAI -> Anthropic:                                         ║
║    BASE_URL=http://localhost:${PORT}/openai-anthropic${' '.repeat(Math.max(0, 9 - String(PORT).length))}║
║    API_KEY=<your-anthropic-api-key>                           ║
║                                                               ║
║  OpenAI Responses -> DeepSeek:                                ║
║    BASE_URL=http://localhost:${PORT}/openai-responses-deepseek${' '.repeat(Math.max(0, 1 - String(PORT).length))}║
║    API_KEY=<your-deepseek-api-key>                            ║
║                                                               ║
║  Anthropic -> OpenAI:                                         ║
║    BASE_URL=http://localhost:${PORT}/anthropic-openai${' '.repeat(Math.max(0, 9 - String(PORT).length))}║
║    API_KEY=<your-openai-api-key>                              ║
╚═══════════════════════════════════════════════════════════════╝
  `)
})

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\nShutting down...')
  process.exit(0)
})
