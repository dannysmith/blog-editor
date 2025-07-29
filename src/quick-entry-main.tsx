import React from 'react'
import ReactDOM from 'react-dom/client'
import { QuickEntryWindow } from './components/quick-entry/QuickEntryWindow'
import { ThemeProvider } from './lib/theme-provider'
import { Toaster } from './components/ui/sonner'

import './App.css'

ReactDOM.createRoot(document.getElementById('quick-entry-root')!).render(
  <React.StrictMode>
    <ThemeProvider defaultTheme="system" storageKey="vite-ui-theme">
      <QuickEntryWindow />
      <Toaster />
    </ThemeProvider>
  </React.StrictMode>,
)