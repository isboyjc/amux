import { HashRouter, Routes, Route } from 'react-router-dom'
import { Layout } from '@/components/layout'
import { Dashboard, Providers, Proxies, Tunnel, Logs, Settings } from '@/pages'

export default function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="providers" element={<Providers />} />
          <Route path="proxies" element={<Proxies />} />
          <Route path="tunnel" element={<Tunnel />} />
          <Route path="logs" element={<Logs />} />
          <Route path="settings" element={<Settings />} />
        </Route>
      </Routes>
    </HashRouter>
  )
}
