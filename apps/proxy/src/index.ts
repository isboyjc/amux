/**
 * Amux Proxy Server
 *
 * This proxy server provides bidirectional API conversion between different LLM providers.
 * It allows you to use any supported provider as a backend while using another provider's API format.
 *
 * Routes:
 *   /proxies/{inbound}-{outbound}/...  - Convert from inbound format to outbound provider
 *
 * Available routes:
 *   /proxies/openai-anthropic/v1/chat/completions        - OpenAI API → Anthropic
 *   /proxies/openai-deepseek/v1/chat/completions         - OpenAI API → DeepSeek
 *   /proxies/openai-moonshot/v1/chat/completions         - OpenAI API → Moonshot
 *   /proxies/openai-zhipu/v1/chat/completions            - OpenAI API → Zhipu
 *   /proxies/openai-responses-anthropic/v1/responses    - OpenAI Responses API → Anthropic
 *   /proxies/openai-responses-deepseek/v1/responses     - OpenAI Responses API → DeepSeek
 *   /proxies/anthropic-openai/v1/messages                - Anthropic API → OpenAI
 *   /proxies/anthropic-deepseek/v1/messages              - Anthropic API → DeepSeek
 *   /proxies/deepseek-anthropic/v1/chat/completions      - DeepSeek API → Anthropic
 *   /proxies/deepseek-openai/v1/chat/completions         - DeepSeek API → OpenAI
 *   /proxies/moonshot-openai/v1/chat/completions         - Moonshot API → OpenAI
 *   ... and more
 *
 * Legacy routes (without /proxies/ prefix) are still supported for backward compatibility.
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
    path: `/proxies/${r.inbound}-${r.outbound}${r.endpoint}`,
    legacyPath: `/${r.inbound}-${r.outbound}${r.endpoint}`,
    inbound: r.inbound,
    outbound: r.outbound,
    modelMapping: r.modelMapping,
  }))

  res.json({
    status: 'ok',
    service: 'amux-proxy',
    version: '0.0.2',
    routes: availableRoutes,
    adapters: Object.keys(adapters),
  })
})

// ============================================================================
// Register Routes
// ============================================================================

// Register dynamic proxy routes with /proxies/ prefix
for (const config of routes) {
  const proxyName = `${config.inbound}-${config.outbound}`
  const router = createBridgeRouter(config)
  
  // New path format: /proxies/{proxyName}
  app.use(`/proxies/${proxyName}`, router)
  
  // Also support old path format for backward compatibility (temporary)
  app.use(`/${proxyName}`, router)
}

// ============================================================================
// Start Server
// ============================================================================

app.listen(PORT, () => {
  const routeList = routes
    .map(r => `║    ${`/proxies/${r.inbound}-${r.outbound}${r.endpoint}`.padEnd(50)}║`)
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
║    BASE_URL=http://localhost:${PORT}/proxies/openai-deepseek${' '.repeat(Math.max(0, 2 - String(PORT).length))}║
║    API_KEY=<your-deepseek-api-key>                            ║
║                                                               ║
║  OpenAI -> Anthropic:                                         ║
║    BASE_URL=http://localhost:${PORT}/proxies/openai-anthropic${' '.repeat(Math.max(0, 0 - String(PORT).length))}║
║    API_KEY=<your-anthropic-api-key>                           ║
║                                                               ║
║  Anthropic -> Moonshot:                                       ║
║    BASE_URL=http://localhost:${PORT}/proxies/anthropic-moonshot${' '.repeat(Math.max(0, 0 - String(PORT).length))}║
║    API_KEY=<your-moonshot-api-key>                            ║
║                                                               ║
║  Note: Old paths (/{name}) still supported for compatibility ║
╚═══════════════════════════════════════════════════════════════╝
  `)
})

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\nShutting down...')
  process.exit(0)
})
