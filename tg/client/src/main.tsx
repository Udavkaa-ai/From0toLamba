import React, { useState } from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AnimatePresence } from 'framer-motion'
import { HomePage } from './pages/HomePage'
import { InboxPage } from './pages/InboxPage'
import { AmaPage } from './pages/AmaPage'
import { CharterPage } from './pages/CharterPage'
import { PortfolioPage } from './pages/PortfolioPage'
import { StatsPage } from './pages/StatsPage'
import { LeaderboardPage } from './pages/LeaderboardPage'
import { RegistryPage } from './pages/RegistryPage'
import { BottomNav } from './components/BottomNav'
import { ChatPanel } from './components/ChatPanel'
import { TourOverlay } from './components/TourOverlay'
import { LanguagePicker } from './components/LanguagePicker'
import { useLangStore } from './stores/langStore'
import { useTelegramBackButton } from './hooks/useTelegramBackButton'
import './styles.css'

const LS_LANG_PICKED = 'lang-picked-v1'

function AppShell() {
  useTelegramBackButton()
  const { lang } = useLangStore()
  const [langPicked, setLangPicked] = useState(() => !!localStorage.getItem(LS_LANG_PICKED))

  const handleLangPicked = () => {
    localStorage.setItem(LS_LANG_PICKED, '1')
    setLangPicked(true)
  }

  return (
    <>
      <AnimatePresence>
        {!langPicked && (
          <LanguagePicker key="lang-picker" onPicked={handleLangPicked} />
        )}
      </AnimatePresence>
      {langPicked && (
        <>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/inbox" element={<InboxPage />} />
            <Route path="/charter/:projectId" element={<CharterPage />} />
            <Route path="/ama/:projectId" element={<AmaPage />} />
            <Route path="/portfolio" element={<PortfolioPage />} />
            <Route path="/stats" element={<StatsPage />} />
            <Route path="/leaderboard" element={<LeaderboardPage />} />
            <Route path="/registry" element={<RegistryPage />} />
          </Routes>
          <BottomNav />
          <ChatPanel />
          <TourOverlay />
        </>
      )}
    </>
  )
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 2, staleTime: 10_000 },
  },
})

// Инициализируем Telegram WebApp
if (typeof window !== 'undefined' && window.Telegram?.WebApp) {
  window.Telegram.WebApp.ready()
  window.Telegram.WebApp.expand()
  window.Telegram.WebApp.setHeaderColor('#060412')
  window.Telegram.WebApp.setBackgroundColor('#060412')
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AppShell />
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>,
)

// Типы Telegram WebApp для TypeScript
declare global {
  interface Window {
    Telegram?: {
      WebApp: {
        initData: string
        ready(): void
        expand(): void
        setHeaderColor(color: string): void
        setBackgroundColor(color: string): void
        openTelegramLink(url: string): void
        BackButton?: {
          show(): void
          hide(): void
          onClick(cb: () => void): void
          offClick(cb: () => void): void
        }
      }
    }
  }
}
