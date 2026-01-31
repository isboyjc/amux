import { useEffect } from 'react'
import { HashRouter, Routes, Route, useNavigate } from 'react-router-dom'
import { ErrorBoundary } from '@/components/common/ErrorBoundary'
import { Layout } from '@/components/layout'
import { Chat, Dashboard, Providers, Proxies, Tunnel, Logs, Settings, Tokens, OAuth, CodeSwitch } from '@/pages'

/**
 * 🆕 路由监听组件 - 处理来自主进程的导航事件
 */
function NavigationListener() {
  const navigate = useNavigate()
  
  useEffect(() => {
    // 监听来自主进程的导航事件，on 方法返回清理函数
    const unsubscribe = window.api.on('navigate-to', (route: string, state?: any) => {
      console.log('[App] Navigating to:', route, state)
      navigate(route, { state })
    })
    
    // 组件卸载时调用清理函数
    return unsubscribe
  }, [navigate])
  
  return null
}

export default function App() {
  return (
    <ErrorBoundary>
      <HashRouter>
        <NavigationListener />
        <Routes>
          <Route path="/" element={<Layout />}>
            <Route index element={<Chat />} />
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="providers" element={<Providers />} />
            <Route path="proxies" element={<Proxies />} />
            <Route path="code-switch" element={<CodeSwitch />} />
            <Route path="tunnel" element={<Tunnel />} />
            <Route path="oauth" element={<OAuth />} />
            <Route path="logs" element={<Logs />} />
            <Route path="tokens" element={<Tokens />} />
            <Route path="settings" element={<Settings />} />
          </Route>
        </Routes>
      </HashRouter>
    </ErrorBoundary>
  )
}
