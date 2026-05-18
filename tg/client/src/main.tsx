import React, { useState } from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AnimatePresence } from 'framer-motion'
import { ErrorBoundary } from './components/ErrorBoundary'
import { HomePage } from './pages/HomePage'
import { InboxPage } from './pages/InboxPage'
import { AmaPage } from './pages/AmaPage'
import { CharterPage } from './pages/CharterPage'
import { PortfolioPage } from './pages/PortfolioPage'
import { StatsPage } from './pages/StatsPage'
import { LeaderboardPage } from './pages/LeaderboardPage'
import { HallOfFamePage } from './pages/HallOfFamePage'
import { TodayPage } from './pages/TodayPage'
import { RelationshipsPage } from './pages/RelationshipsPage'
import { RegistryPage } from './pages/RegistryPage'
import { BottomNav } from './components/BottomNav'
import { ChatPanel } from './components/ChatPanel'
import { NextWeekFab } from './components/NextWeekFab'
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
            <Route path="/hall-of-fame" element={<HallOfFamePage />} />
            <Route path="/hall-of-fame/:seasonNumber" element={<HallOfFamePage />} />
            <Route path="/today" element={<TodayPage />} />
            <Route path="/relationships" element={<RelationshipsPage />} />
            <Route path="/registry" element={<RegistryPage />} />
          </Routes>
          <BottomNav />
          <ChatPanel />
          <NextWeekFab />
          <TourOverlay />
        </>
      )}
    </>
  )
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      staleTime: 10_000,
      // refetchOnWindowFocus отключён — после сворачивания/восстановления
      // Mini App все запросы дёргались разом, дерево перерисовывалось
      // полностью, AnimatePresence-overlay'и перезапускали анимации с
      // initial:opacity:0 → визуальное мерцание на главной/грамотах.
      // Свежие данные подтягиваются по staleTime (10s) при следующем
      // взаимодействии — этого хватает.
      refetchOnWindowFocus: false,
      // refetchOnReconnect оставлен default (true) — если сеть рвалась,
      // данные правда стоит подтянуть.
    },
  },
})

// Инициализируем Telegram WebApp
if (typeof window !== 'undefined' && window.Telegram?.WebApp) {
  window.Telegram.WebApp.ready()
  window.Telegram.WebApp.expand()
  window.Telegram.WebApp.setHeaderColor('#060412')
  window.Telegram.WebApp.setBackgroundColor('#060412')
  // Запрещаем свайп вниз для сворачивания/закрытия — в мини-играх свайп
  // иногда случается случайно при попытке тапа, и игрок вываливается.
  // disableVerticalSwipes есть с Bot API 7.7, на старых клиентах просто no-op.
  const wa = window.Telegram.WebApp as any
  try { wa.disableVerticalSwipes?.() } catch { /* noop */ }
  // requestFullscreen() намеренно НЕ вызываем — режим запуска (Compact /
  // Fullsize / Fullscreen) задаётся в BotFather. В Fullscreen-режиме на
  // некоторых Android-устройствах нижнее меню накладывалось на системные
  // кнопки навигации. Сейчас оставляем выбор пользователю/BotFather.
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <AppShell />
        </BrowserRouter>
      </QueryClientProvider>
    </ErrorBoundary>
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
