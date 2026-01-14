import { HashRouter, Routes, Route } from 'react-router-dom'
import { ErrorBoundary } from '@/components/common/ErrorBoundary'
import { Layout } from '@/components/layout'
import { Dashboard, Providers, Proxies, Tunnel, Logs, Settings, Tokens } from '@/pages'

export default function App() {
  return (
    <ErrorBoundary>
      <HashRouter>
        <Routes>
          <Route path="/" element={<Layout />}>
            <Route index element={<Dashboard />} />
            <Route path="providers" element={<Providers />} />
            <Route path="proxies" element={<Proxies />} />
            <Route path="tunnel" element={<Tunnel />} />
            <Route path="logs" element={<Logs />} />
            <Route path="tokens" element={<Tokens />} />
            <Route path="settings" element={<Settings />} />
          </Route>
        </Routes>
      </HashRouter>
    </ErrorBoundary>
  )
}
