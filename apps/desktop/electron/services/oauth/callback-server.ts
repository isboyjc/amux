// electron/services/oauth/callback-server.ts

import Fastify, { FastifyInstance } from 'fastify'

interface CallbackData {
  code: string
  state: string
}

interface CallbackHandler {
  expectedState: string
  resolve: (data: CallbackData) => void
  reject: (error: Error) => void
  timeout: NodeJS.Timeout
}

/**
 * OAuth回调服务器管理器
 *
 * 为不同的OAuth服务提供本地回调端点
 */
export class OAuthCallbackServer {
  private servers: Map<number, FastifyInstance> = new Map()
  private handlers: Map<string, CallbackHandler> = new Map()

  /**
   * 启动回调服务器
   */
  async startServer(port: number): Promise<void> {
    if (this.servers.has(port)) {
      return // 服务器已存在
    }

    const app = Fastify({
      logger: false
    })

    // 创建回调处理函数
    const handleCallback = async (serviceName: string, request: any, reply: any) => {
      const { code, state, error, error_description } = request.query as {
        code?: string
        state?: string
        error?: string
        error_description?: string
      }


      // 查找对应的处理器
      const handlerKey = `${serviceName}-${state}`
      const handler = this.handlers.get(handlerKey)

      if (!handler) {
        reply.code(400).type('text/html').send(this.errorPage('Invalid callback state'))
        return
      }

      // 清除超时
      clearTimeout(handler.timeout)
      this.handlers.delete(handlerKey)

      // 错误处理
      if (error) {
        handler.reject(new Error((error_description as string) || (error as string)))
        reply.code(400).type('text/html').send(this.errorPage((error_description as string) || (error as string)))
        return
      }

      // 验证state
      if (state !== handler.expectedState) {
        handler.reject(new Error('State mismatch'))
        reply.code(400).type('text/html').send(this.errorPage('Security validation failed'))
        return
      }

      // 成功
      handler.resolve({
        code: code as string,
        state: state as string
      })

      reply.type('text/html').send(this.successPage(serviceName))
    }

    // 通用回调处理器
    app.get('/oauth/:service/callback', async (request, reply) => {
      const { service } = request.params as { service: string }
      await handleCallback(service, request, reply)
    })

    // Codex 回调（兼容 CLIProxyAPIPlus 路径）
    app.get('/auth/callback', async (request, reply) => {
      await handleCallback('codex', request, reply)
    })

    // Antigravity 回调（兼容 CLIProxyAPIPlus 路径）
    app.get('/google/callback', async (request, reply) => {
      await handleCallback('antigravity', request, reply)
    })

    // 健康检查
    app.get('/health', async (_request, reply) => {
      reply.send({ status: 'ok' })
    })

    // 启动服务器
    try {
      await app.listen({ port, host: '127.0.0.1' })
      this.servers.set(port, app)
    } catch (error) {
      console.error(`[OAuth] Failed to start callback server on port ${port}:`, error)
      throw error
    }
  }

  /**
   * 停止回调服务器
   */
  async stopServer(port: number): Promise<void> {
    const server = this.servers.get(port)
    if (!server) return

    try {
      await server.close()
      this.servers.delete(port)
    } catch (error) {
      console.error(`[OAuth] Failed to stop callback server on port ${port}:`, error)
    }
  }

  /**
   * 等待OAuth回调
   */
  waitForCallback(
    path: string,
    expectedState: string,
    timeoutMs: number = 10 * 60 * 1000
  ): Promise<CallbackData> {
    // 从path提取service名称
    let service: string
    
    // 支持多种路径格式
    if (path.includes('/oauth/')) {
      const match = path.match(/\/oauth\/([^/]+)\/callback/)
      if (!match || !match[1]) {
        throw new Error('Invalid callback path')
      }
      service = match[1]
    } else if (path.includes('/auth/callback')) {
      service = 'codex'
    } else if (path.includes('/google/callback')) {
      service = 'antigravity'
    } else {
      throw new Error('Invalid callback path')
    }

    return new Promise((resolve, reject) => {
      const handlerKey = `${service}-${expectedState}`

      // 设置超时
      const timeout = setTimeout(() => {
        this.handlers.delete(handlerKey)
        reject(new Error('OAuth callback timeout'))
      }, timeoutMs)

      // 注册处理器
      this.handlers.set(handlerKey, {
        expectedState,
        resolve,
        reject,
        timeout
      })
    })
  }

  /**
   * 取消等待回调
   */
  cancelCallback(path: string, state: string): void {
    // 从path提取service名称
    let service: string
    
    if (path.includes('/oauth/')) {
      const match = path.match(/\/oauth\/([^/]+)\/callback/)
      if (!match || !match[1]) return
      service = match[1]
    } else if (path.includes('/auth/callback')) {
      service = 'codex'
    } else if (path.includes('/google/callback')) {
      service = 'antigravity'
    } else {
      return
    }

    const handlerKey = `${service}-${state}`
    const handler = this.handlers.get(handlerKey)
    
    if (handler) {
      clearTimeout(handler.timeout)
      handler.reject(new Error('OAuth authorization cancelled by user'))
      this.handlers.delete(handlerKey)
    }
  }

  /**
   * 成功页面HTML
   */
  private successPage(service: string): string {
    const serviceName = service === 'codex' ? 'OpenAI' : 'Google'

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Authorization Successful - Amux</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Ubuntu:wght@400;500;700&display=swap" rel="stylesheet">
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    /* Light theme */
    :root {
      --background: hsl(220, 14%, 96%);
      --foreground: hsl(222.2, 84%, 4.9%);
      --card: hsl(0, 0%, 100%);
      --card-foreground: hsl(222.2, 84%, 4.9%);
      --primary: hsl(222.2, 47.4%, 11.2%);
      --primary-foreground: hsl(210, 40%, 98%);
      --muted: hsl(210, 40%, 96.1%);
      --muted-foreground: hsl(215.4, 16.3%, 46.9%);
      --success: hsl(142.1, 76.2%, 36.3%);
      --success-light: hsl(142.1, 70%, 45%);
      --border: hsl(214.3, 31.8%, 91.4%);
    }
    
    /* Dark theme */
    @media (prefers-color-scheme: dark) {
      :root {
        --background: hsl(224, 28%, 8%);
        --foreground: hsl(210, 40%, 98%);
        --card: hsl(224, 28%, 12%);
        --card-foreground: hsl(210, 40%, 98%);
        --primary: hsl(210, 40%, 98%);
        --primary-foreground: hsl(222.2, 47.4%, 11.2%);
        --muted: hsl(223, 30%, 20%);
        --muted-foreground: hsl(215, 20.2%, 65.1%);
        --success: hsl(142.1, 70%, 45%);
        --success-light: hsl(142.1, 76.2%, 50%);
        --border: hsl(217.2, 32.6%, 17.5%);
      }
    }
    
    body {
      font-family: 'Ubuntu', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      background: var(--background);
      color: var(--foreground);
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
      transition: background-color 0.2s ease, color 0.2s ease;
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
    }
    
    .container {
      background: var(--card);
      border: 1px solid var(--border);
      border-radius: 16px;
      padding: 48px;
      text-align: center;
      max-width: 480px;
      width: 100%;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
      transition: background-color 0.2s ease, border-color 0.2s ease;
    }
    
    .logo-container {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 20px;
      margin-bottom: 32px;
    }
    
    .logo {
      width: 64px;
      height: 64px;
    }
    
    .logo-path {
      fill: var(--primary);
      transition: fill 0.2s ease;
    }
    
    .success-icon {
      width: 80px;
      height: 80px;
      background: var(--success);
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0 auto 24px;
      position: relative;
      animation: scaleIn 0.3s ease-out;
    }
    
    @keyframes scaleIn {
      from {
        transform: scale(0);
        opacity: 0;
      }
      to {
        transform: scale(1);
        opacity: 1;
      }
    }
    
    .checkmark {
      width: 40px;
      height: 40px;
      position: relative;
    }
    
    .checkmark::after {
      content: '';
      position: absolute;
      left: 12px;
      top: 5px;
      width: 12px;
      height: 24px;
      border: solid white;
      border-width: 0 4px 4px 0;
      transform: rotate(45deg);
      animation: checkmarkDraw 0.3s ease-out 0.1s both;
    }
    
    @keyframes checkmarkDraw {
      from {
        height: 0;
      }
      to {
        height: 24px;
      }
    }
    
    h1 {
      font-size: 32px;
      font-weight: 700;
      letter-spacing: -0.02em;
      color: var(--foreground);
      margin-bottom: 12px;
      transition: color 0.2s ease;
    }
    
    .subtitle {
      font-size: 18px;
      color: var(--muted-foreground);
      line-height: 1.6;
      margin-bottom: 8px;
      transition: color 0.2s ease;
    }
    
    .service-name {
      font-weight: 600;
      color: var(--success-light);
      transition: color 0.2s ease;
    }
    
    .divider {
      height: 1px;
      background: var(--border);
      margin: 24px 0;
      transition: background-color 0.2s ease;
    }
    
    .info-text {
      font-size: 15px;
      color: var(--muted-foreground);
      line-height: 1.6;
      margin-bottom: 8px;
      transition: color 0.2s ease;
    }
    
    .note {
      font-size: 13px;
      color: var(--muted-foreground);
      margin-top: 24px;
      opacity: 0.7;
      transition: color 0.2s ease;
    }
    
    .countdown {
      display: inline-block;
      font-weight: 500;
      color: var(--success-light);
      transition: color 0.2s ease;
    }
  </style>
  <script>
    let timeLeft = 5;
    
    function updateCountdown() {
      const countdownEl = document.getElementById('countdown');
      if (countdownEl) {
        countdownEl.textContent = timeLeft;
      }
      
      if (timeLeft <= 0) {
        window.close();
      } else {
        timeLeft--;
        setTimeout(updateCountdown, 1000);
      }
    }
    
    window.addEventListener('DOMContentLoaded', () => {
      updateCountdown();
    });
  </script>
</head>
<body>
  <div class="container">
    <div class="logo-container">
      <svg class="logo" viewBox="0 0 128 128" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path
          class="logo-path"
          d="M4 96 
             C4 96, 24 12, 64 12
             C104 12, 124 96, 124 96
             Q124 102, 118 102
             C94 102, 92 64, 64 64
             C36 64, 34 102, 10 102
             Q4 102, 4 96
             Z"
        />
      </svg>
      <div class="success-icon">
        <div class="checkmark"></div>
      </div>
    </div>
    
    <h1>Authorization Successful!</h1>
    
    <p class="subtitle">
      You have successfully authorized <span class="service-name">${serviceName}</span> account.
    </p>
    
    <div class="divider"></div>
    
    <p class="info-text">You can now close this window and return to Amux.</p>
    <p class="note">This window will automatically close in <span class="countdown" id="countdown">5</span> seconds.</p>
  </div>
</body>
</html>`
  }

  /**
   * 错误页面HTML
   */
  private errorPage(message: string): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Authorization Failed - Amux</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Ubuntu:wght@400;500;700&display=swap" rel="stylesheet">
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    /* Light theme */
    :root {
      --background: hsl(220, 14%, 96%);
      --foreground: hsl(222.2, 84%, 4.9%);
      --card: hsl(0, 0%, 100%);
      --card-foreground: hsl(222.2, 84%, 4.9%);
      --primary: hsl(222.2, 47.4%, 11.2%);
      --primary-foreground: hsl(210, 40%, 98%);
      --muted: hsl(210, 40%, 96.1%);
      --muted-foreground: hsl(215.4, 16.3%, 46.9%);
      --destructive: hsl(0, 84.2%, 60.2%);
      --destructive-light: hsl(0, 72%, 51%);
      --destructive-bg: hsl(0, 86%, 97%);
      --destructive-border: hsl(0, 93%, 94%);
      --border: hsl(214.3, 31.8%, 91.4%);
    }
    
    /* Dark theme */
    @media (prefers-color-scheme: dark) {
      :root {
        --background: hsl(224, 28%, 8%);
        --foreground: hsl(210, 40%, 98%);
        --card: hsl(224, 28%, 12%);
        --card-foreground: hsl(210, 40%, 98%);
        --primary: hsl(210, 40%, 98%);
        --primary-foreground: hsl(222.2, 47.4%, 11.2%);
        --muted: hsl(223, 30%, 20%);
        --muted-foreground: hsl(215, 20.2%, 65.1%);
        --destructive: hsl(0, 62.8%, 50.6%);
        --destructive-light: hsl(0, 72%, 51%);
        --destructive-bg: hsl(0, 43%, 15%);
        --destructive-border: hsl(0, 43%, 20%);
        --border: hsl(217.2, 32.6%, 17.5%);
      }
    }
    
    body {
      font-family: 'Ubuntu', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      background: var(--background);
      color: var(--foreground);
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
      transition: background-color 0.2s ease, color 0.2s ease;
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
    }
    
    .container {
      background: var(--card);
      border: 1px solid var(--border);
      border-radius: 16px;
      padding: 48px;
      text-align: center;
      max-width: 480px;
      width: 100%;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
      transition: background-color 0.2s ease, border-color 0.2s ease;
    }
    
    .logo-container {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 20px;
      margin-bottom: 32px;
    }
    
    .logo {
      width: 64px;
      height: 64px;
    }
    
    .logo-path {
      fill: var(--primary);
      transition: fill 0.2s ease;
    }
    
    .error-icon {
      width: 80px;
      height: 80px;
      background: var(--destructive);
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0 auto 24px;
      position: relative;
      animation: scaleIn 0.3s ease-out;
    }
    
    @keyframes scaleIn {
      from {
        transform: scale(0);
        opacity: 0;
      }
      to {
        transform: scale(1);
        opacity: 1;
      }
    }
    
    .error-icon::before,
    .error-icon::after {
      content: '';
      position: absolute;
      width: 40px;
      height: 4px;
      background: white;
      border-radius: 2px;
    }
    
    .error-icon::before {
      transform: rotate(45deg);
      animation: rotateLine1 0.3s ease-out 0.1s both;
    }
    
    .error-icon::after {
      transform: rotate(-45deg);
      animation: rotateLine2 0.3s ease-out 0.1s both;
    }
    
    @keyframes rotateLine1 {
      from {
        transform: rotate(0deg);
        width: 0;
      }
      to {
        transform: rotate(45deg);
        width: 40px;
      }
    }
    
    @keyframes rotateLine2 {
      from {
        transform: rotate(0deg);
        width: 0;
      }
      to {
        transform: rotate(-45deg);
        width: 40px;
      }
    }
    
    h1 {
      font-size: 32px;
      font-weight: 700;
      letter-spacing: -0.02em;
      color: var(--foreground);
      margin-bottom: 12px;
      transition: color 0.2s ease;
    }
    
    .subtitle {
      font-size: 18px;
      color: var(--muted-foreground);
      line-height: 1.6;
      margin-bottom: 8px;
      transition: color 0.2s ease;
    }
    
    .divider {
      height: 1px;
      background: var(--border);
      margin: 24px 0;
      transition: background-color 0.2s ease;
    }
    
    .error-box {
      background: var(--destructive-bg);
      border: 1px solid var(--destructive-border);
      border-radius: 12px;
      padding: 16px;
      margin-top: 20px;
      transition: background-color 0.2s ease, border-color 0.2s ease;
    }
    
    .error-title {
      font-size: 14px;
      font-weight: 600;
      color: var(--destructive-light);
      margin-bottom: 8px;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      transition: color 0.2s ease;
    }
    
    .error-message {
      font-size: 15px;
      color: var(--card-foreground);
      line-height: 1.5;
      word-break: break-word;
      transition: color 0.2s ease;
    }
    
    .info-text {
      font-size: 15px;
      color: var(--muted-foreground);
      line-height: 1.6;
      transition: color 0.2s ease;
    }
    
    .actions {
      margin-top: 24px;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    
    .help-text {
      font-size: 13px;
      color: var(--muted-foreground);
      opacity: 0.7;
      transition: color 0.2s ease;
    }
    
    .link {
      color: var(--primary);
      text-decoration: none;
      font-weight: 500;
      transition: opacity 0.2s ease;
    }
    
    .link:hover {
      opacity: 0.8;
      text-decoration: underline;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="logo-container">
      <svg class="logo" viewBox="0 0 128 128" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path
          class="logo-path"
          d="M4 96 
             C4 96, 24 12, 64 12
             C104 12, 124 96, 124 96
             Q124 102, 118 102
             C94 102, 92 64, 64 64
             C36 64, 34 102, 10 102
             Q4 102, 4 96
             Z"
        />
      </svg>
      <div class="error-icon"></div>
    </div>
    
    <h1>Authorization Failed</h1>
    
    <p class="subtitle">
      There was a problem authorizing your account.
    </p>
    
    <div class="divider"></div>
    
    <p class="info-text">Please try again or contact support if the issue persists.</p>
    
    <div class="error-box">
      <div class="error-title">Error Details</div>
      <div class="error-message">${message}</div>
    </div>
    
    <div class="actions">
      <p class="help-text">
        Need help? Visit <a href="https://github.com/isboyjc/amux" target="_blank" rel="noopener noreferrer" class="link">Amux Support</a>
      </p>
    </div>
  </div>
</body>
</html>`
  }

  /**
   * 清理所有服务器
   */
  async cleanup(): Promise<void> {
    const ports = Array.from(this.servers.keys())
    await Promise.all(ports.map(port => this.stopServer(port)))

    // 清理所有未完成的处理器
    this.handlers.forEach(handler => {
      clearTimeout(handler.timeout)
      handler.reject(new Error('Server cleanup'))
    })
    this.handlers.clear()
  }
}

// Export singleton instance
let callbackServerInstance: OAuthCallbackServer | null = null

export function getCallbackServer(): OAuthCallbackServer {
  if (!callbackServerInstance) {
    callbackServerInstance = new OAuthCallbackServer()
  }
  return callbackServerInstance
}
