import { HashRouter, Routes, Route } from 'react-router-dom'
import { Layout } from '@/components/layout'
import { Dashboard } from '@/pages/Dashboard'
import { Providers } from '@/pages/Providers'
import { Proxies } from '@/pages/Proxies'
import { Logs } from '@/pages/Logs'
import { Settings } from '@/pages/Settings'

export default function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="providers" element={<Providers />} />
          <Route path="proxies" element={<Proxies />} />
          <Route path="logs" element={<Logs />} />
          <Route path="settings" element={<Settings />} />
        </Route>
      </Routes>
    </HashRouter>
  )
}
