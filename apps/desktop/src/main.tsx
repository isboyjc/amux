import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { initLocale } from './locales'
import './styles/globals.css'

// Initialize locale
initLocale()

// Set dark mode by default
document.documentElement.classList.add('dark')

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
