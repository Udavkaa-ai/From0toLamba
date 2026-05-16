import { useEffect, useRef, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { ScreenBackground, APP_VERSION, homeBackground } from '@/components/ScreenBackground'
import { FairyCard, OrnamentDivider } from '@/components/FairyCard'
import { RankUpOverlay } from '@/components/RankUpOverlay'
import { OnboardingTutorial } from '@/components/OnboardingTutorial'
import {
  WhatsNewOverlay, getPendingChangelog, markChangelogSeen, type ChangelogEntry,
} from '@/components/WhatsNewOverlay'
import { AchievementUnlockedOverlay } from '@/components/AchievementUnlockedOverlay'
import { FaqModal, FaqAnnouncementModal, useFaqAnnouncement } from '@/components/FaqModal'
import { ChannelPromoOverlay, shouldShowChannelPromo, markChannelPromoSeen } from '@/components/ChannelPromoOverlay'
import { MarketAnnouncementOverlay } from '@/components/MarketAnnouncementOverlay'
import { DayTransitionOverlay } from '@/components/DayTransitionOverlay'
import { CoinShowerOverlay } from '@/components/CoinShowerOverlay'
import { CountUp } from '@/components/CountUp'
import { EyeIcon, LockIcon } from '@/components/icons'
import { api, type ProjectDTO, type DailyUpdateDTO, type ClosureSummaryDTO, type MyReferralEntryDTO } from '@/api/client'
import { useGameStore } from '@/stores/gameStore'
import { useTourStore, isTourDone } from '@/stores/tourStore'
import { useLangStore, type Lang } from '@/stores/langStore'
import { useT } from '@/i18n'
import { colors, spacing, typography } from '@/theme'
import { getTheme, setTheme } from '@/theme/colors'
import { playSound, isMuted, setMuted, isMusicMuted, setMusicMuted, getVolume, setVolume } from '@/sounds'

const MODEL_OPTIONS = [
  {
    id: 'deepseek/deepseek-v4-flash',
    label: 'DeepSeek V4 Flash',
    subtitle: 'быстрый и дешёвый, по умолчанию',
  },
  {
    id: 'google/gemini-3.1-flash-lite-preview',
    label: 'Gemini 2.5 Flash',
    subtitle: 'умнее, медленнее',
  },
]

// Модульные синглтоны — сохраняются между навигациями (один экземпляр Audio на сессию).
let mainThemePlayed = false
let audioElement: HTMLAudioElement | null = null

export function HomePage() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const { setGameState, gameState } = useGameStore()
  const { start: startTour } = useTourStore()
  const { lang, setLang } = useLangStore()
  const t = useT()
  const [showSettings, setShowSettings] = useState(false)
  const [localModel, setLocalModel] = useState<string | null>(null)
  const [showResetConfirm, setShowResetConfirm] = useState(false)
  const [showMyReferrals, setShowMyReferrals] = useState(false)
  const [showDayNews, setShowDayNews] = useState(false)
  const [dayClosures, setDayClosures] = useState<ClosureSummaryDTO[]>([])
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [paymentPending, setPaymentPending] = useState(false)
  const [showTutorial, setShowTutorial] = useState(false)
  const [pendingChangelog, setPendingChangelog] = useState<ChangelogEntry | null>(null)
  const [showBannerModal, setShowBannerModal] = useState(false)
  const [showFaq, setShowFaq] = useState(false)
  const [showFaqAnnouncement, setShowFaqAnnouncement] = useState(useFaqAnnouncement)
  const [showChannelPromo, setShowChannelPromo] = useState(false)
  const [showMarketAnnouncement, setShowMarketAnnouncement] = useState(false)
  // Подтверждение перехода на следующий день, если в инбоксе остались дела
  const [showInboxLeftConfirm, setShowInboxLeftConfirm] = useState(false)
  const [nicknameInput, setNicknameInput] = useState<string>('')
  const [nicknameError, setNicknameError] = useState<string | null>(null)
  const [nicknameSaving, setNicknameSaving] = useState(false)
  const [soundMuted, setSoundMuted] = useState(isMuted)
  const [musicMuted, setMusicMutedState] = useState(isMusicMuted)
  const [soundVolume, setSoundVolume] = useState(getVolume)

  // ─── Фоновая музыка — только один раз за сессию ────────────────────────────
  const audioRef = useRef<HTMLAudioElement | null>(null)
  // Множитель: при ползунке 0.5 (по умолчанию) музыка на 20% (0.5 × 0.4 = 0.2)
  const MUSIC_FACTOR = 0.4
  const musicVol = () => isMusicMuted() ? 0 : getVolume() * MUSIC_FACTOR

  useEffect(() => {
    if (mainThemePlayed) {
      // Повторный маунт (навигация туда-обратно) — переподключаем ref к живому элементу
      audioRef.current = audioElement
      return () => { audioRef.current = null }
    }
    mainThemePlayed = true

    const audio = new Audio('/main_theme.mp3')
    audio.loop = true                     // тема крутится по кругу всю сессию
    audio.volume = musicVol()
    audioElement = audio
    audioRef.current = audio

    // touchHandler нужен чтобы убрать слушатели при размонтировании (иначе
    // старый Audio-элемент снова запускается при касании уже без ref-управления)
    let touchHandler: (() => void) | null = null

    const tryPlay = () => {
      audio.play().catch(() => {
        touchHandler = () => {
          document.removeEventListener('touchstart', touchHandler!)
          document.removeEventListener('click', touchHandler!)
          touchHandler = null
          audio.volume = musicVol()
          audio.play().catch(() => {})
        }
        document.addEventListener('touchstart', touchHandler)
        document.addEventListener('click', touchHandler)
      })
    }

    // Пауза/восстановление при сворачивании приложения (в т.ч. Telegram Mini App
    // на iOS/Android). visibilitychange один не справляется: при сворачивании
    // Telegram на Android он часто не приходит. Слушаем сразу несколько событий:
    //   visibilitychange   — стандарт (большинство браузеров)
    //   pagehide/pageshow  — iOS Safari, надёжнее всего для бэкграунда
    //   blur/focus         — Telegram WebApp на Android при сворачивании к чату
    //   viewportChanged    — событие Telegram WebApp при коллапсе мини-аппа
    let userPaused = false  // не возобновляем, если игрок сам выключил звук
    const pause = () => {
      if (!audio.paused) {
        userPaused = false
        audio.pause()
      }
    }
    const resume = () => {
      if (isMusicMuted() || userPaused) return
      if (audio.paused && !audio.ended) {
        audio.volume = musicVol()
        audio.play().catch(() => {})
      }
    }
    const onVisibilityChange = () => {
      if (document.hidden) pause()
      else resume()
    }
    const onPageHide = () => pause()
    const onPageShow = () => resume()
    const onBlur = () => pause()
    const onFocus = () => resume()
    document.addEventListener('visibilitychange', onVisibilityChange)
    window.addEventListener('pagehide', onPageHide)
    window.addEventListener('pageshow', onPageShow)
    window.addEventListener('blur', onBlur)
    window.addEventListener('focus', onFocus)

    // Telegram WebApp: при сворачивании мини-аппа viewport меняет состояние.
    // Если isExpanded=false и стабильно — мини-апп свёрнут, ставим на паузу.
    const tgApp = (window as any).Telegram?.WebApp
    const onTgViewportChange = () => {
      if (!tgApp?.isExpanded) pause()
      else resume()
    }
    tgApp?.onEvent?.('viewportChanged', onTgViewportChange)

    tryPlay()

    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange)
      window.removeEventListener('pagehide', onPageHide)
      window.removeEventListener('pageshow', onPageShow)
      window.removeEventListener('blur', onBlur)
      window.removeEventListener('focus', onFocus)
      tgApp?.offEvent?.('viewportChanged', onTgViewportChange)
      if (touchHandler) {
        document.removeEventListener('touchstart', touchHandler)
        document.removeEventListener('click', touchHandler)
        touchHandler = null
      }
      audio.pause()
      audioRef.current = null
    }
  }, [])

  // Реагируем на изменения громкости и music-mute
  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return
    if (musicMuted) {
      audio.volume = 0
      audio.pause()
    } else {
      audio.volume = soundVolume * MUSIC_FACTOR
      if (audio.paused && !audio.ended) audio.play().catch(() => {})
    }
  }, [musicMuted, soundVolume])

  useEffect(() => {
    if (gameState?.pendingRankUp) playSound('rankup')
  }, [gameState?.pendingRankUp])

  // Changelog показываем после того как дойдёт gameState — нужно знать
  // завершён ли онбординг (новичкам вместо changelog идёт тур).
  useEffect(() => {
    if (!gameState) return
    const entry = getPendingChangelog(APP_VERSION, gameState.isOnboardingComplete)
    if (entry) setPendingChangelog(entry)
    if (gameState.isOnboardingComplete && shouldShowChannelPromo()) setShowChannelPromo(true)
    if (gameState.isOnboardingComplete && gameState.pendingMarketAnnouncement) setShowMarketAnnouncement(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameState?.isOnboardingComplete])
  // Тикает каждую секунду, чтобы перерисовывать таймер кулдауна
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])

  const localModelInitRef = useRef(false)
  const { isLoading, isError, error, data: freshGameState } = useQuery({
    queryKey: ['gameState'],
    queryFn: () => api.game.getState(),
    refetchInterval: 30_000,
  })

  useEffect(() => {
    if (!freshGameState) return
    setGameState(freshGameState)
    if (!localModelInitRef.current) {
      localModelInitRef.current = true
      setLocalModel(freshGameState.preferredModel)
    }
  }, [freshGameState])

  const tgHaptic = (window as any).Telegram?.WebApp?.HapticFeedback

  // Видимый «бесшовный» переход — оверлей с купцом на ярмарке держится пока
  // данные нового дня не подтянутся (мутация в процессе + краткая буферная пауза).
  const [isDayTransition, setIsDayTransition] = useState(false)

  // Дождь монет: после успешного дня летят золотые на размер изменения казны
  // (баланс + текущая стоимость активных дел). Срабатывает между transition и DayNews.
  const [coinShowerDelta, setCoinShowerDelta] = useState<number | null>(null)
  // Снимок «казны до дня» + день, в который снимали. На него смотрит useEffect,
  // ждёт пока придёт свежий gameState (currentDay инкрементнётся), считает дельту
  // и запускает дождь.
  const [pendingShowerSnapshot, setPendingShowerSnapshot] = useState<{ wealth: number; day: number } | null>(null)
  const [readyForShower, setReadyForShower] = useState(false)

  const computeWealth = (gs: typeof gameState): number => {
    if (!gs) return 0
    const active = gs.activeProjects.reduce((sum, p) => sum + p.currentValueRubles, 0)
    return gs.balance + active
  }

  // Эффект «триггер дождя монет»: ждём (1) переход дня закончился, (2) пришли
  // свежие данные нового дня, (3) есть снимок казны до. Сравниваем — запускаем.
  useEffect(() => {
    if (!readyForShower || !pendingShowerSnapshot || !freshGameState) return
    if (freshGameState.currentDay <= pendingShowerSnapshot.day) return  // ещё старые данные
    const delta = Math.floor(computeWealth(freshGameState) - pendingShowerSnapshot.wealth)
    setPendingShowerSnapshot(null)
    setReadyForShower(false)
    if (Math.abs(delta) >= 1) {
      setCoinShowerDelta(delta)
      // Открываем «вести дня» через 1.7с, чтобы дождь успел отыграть
      setTimeout(() => setShowDayNews(true), 1700)
    } else {
      setShowDayNews(true)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [readyForShower, freshGameState])

  const advanceMutation = useMutation({
    mutationFn: api.game.advanceDay,
    onMutate: () => {
      setIsDayTransition(true)
      if (gameState) {
        setPendingShowerSnapshot({ wealth: computeWealth(gameState), day: gameState.currentDay })
        setReadyForShower(false)
      }
    },
    onSuccess: (data) => {
      tgHaptic?.notificationOccurred('success')
      playSound('day')
      qc.invalidateQueries({ queryKey: ['gameState'] })
      qc.invalidateQueries({ queryKey: ['updates'] })
      qc.invalidateQueries({ queryKey: ['inbox'] })
      qc.invalidateQueries({ queryKey: ['portfolio'] })
      setDayClosures(data.closures ?? [])
      // Держим оверлей ещё ~800мс, чтобы refetch инбокса/портфеля успел осесть,
      // и игрок не увидел ни старых грамот, ни «инбокс пуст».
      setTimeout(() => {
        setIsDayTransition(false)
        setReadyForShower(true)
      }, 800)
    },
    onError: () => {
      tgHaptic?.notificationOccurred('error')
      setIsDayTransition(false)
      setPendingShowerSnapshot(null)
      setReadyForShower(false)
    },
  })

  const handleTimerSkipPayment = async () => {
    setPaymentPending(true)
    const finishTransition = (closures: ClosureSummaryDTO[]) => {
      qc.invalidateQueries({ queryKey: ['gameState'] })
      qc.invalidateQueries({ queryKey: ['updates'] })
      qc.invalidateQueries({ queryKey: ['inbox'] })
      qc.invalidateQueries({ queryKey: ['portfolio'] })
      setShowPaymentModal(false)
      setDayClosures(closures ?? [])
      tgHaptic?.notificationOccurred('success')
      setTimeout(() => {
        setIsDayTransition(false)
        setReadyForShower(true)
      }, 800)
    }
    try {
      setIsDayTransition(true)
      if (gameState) {
        setPendingShowerSnapshot({ wealth: computeWealth(gameState), day: gameState.currentDay })
        setReadyForShower(false)
      }
      const resp = await api.payments.createInvoice('timer_skip') as any
      if (!resp.invoiceLink) {
        finishTransition(resp.closures ?? [])
        setPaymentPending(false)
        return
      }
      const tgWebApp = (window as any).Telegram?.WebApp
      if (!tgWebApp?.openInvoice) {
        setIsDayTransition(false)
        setPaymentPending(false)
        return
      }
      tgWebApp.openInvoice(resp.invoiceLink, async (status: string) => {
        if (status === 'paid') {
          try {
            const result = await api.payments.activateTimerSkip()
            finishTransition(result.closures ?? [])
          } catch {
            tgHaptic?.notificationOccurred('error')
            setIsDayTransition(false)
          }
        } else {
          setIsDayTransition(false)
        }
        setPaymentPending(false)
      })
    } catch {
      tgHaptic?.notificationOccurred('error')
      setIsDayTransition(false)
      setPaymentPending(false)
    }
  }

  const updateModelMutation = useMutation({
    mutationFn: (model: string) => api.game.updateSettings({ preferredModel: model }),
    onSuccess: () => {},
  })

  const updateLang = (l: Lang) => {
    setLang(l)
    api.game.updateSettings({ preferredLanguage: l }).catch(() => {})
  }

  const completeOnboardingMutation = useMutation({
    mutationFn: api.game.completeOnboarding,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['gameState'] }),
  })

  // Показываем тур при первом входе (новый игрок) или при обновлении до v3.0 (старый игрок).
  // Ключ 'onboarding_v3_seen' сбрасывает флаг для всех при мажорном обновлении.
  useEffect(() => {
    if (!gameState) return
    const seenV3 = !!localStorage.getItem('onboarding_v3_seen')
    if ((!gameState.isOnboardingComplete || !seenV3) && !showTutorial) {
      setShowTutorial(true)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameState?.isOnboardingComplete])

  // Запускаем пошаговый UI-тур после завершения онбординга (один раз)
  useEffect(() => {
    if (!gameState?.isOnboardingComplete) return
    if (isTourDone()) return
    if (useTourStore.getState().step !== null) return  // тур уже активен — не сбрасывать
    const timer = setTimeout(() => startTour(), 1200)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameState?.isOnboardingComplete])

  const resetMutation = useMutation({
    mutationFn: api.game.resetGame,
    onSuccess: () => {
      window.localStorage.removeItem('seenAchievements')
      setShowResetConfirm(false)
      setShowSettings(false)
      qc.invalidateQueries({ queryKey: ['gameState'] })
      navigate('/')
    },
  })

  const handleOpenSettings = () => {
    setNicknameInput(gameState?.nickname ?? '')
    setNicknameError(null)
    setShowSettings(true)
  }

  const handleSaveNickname = async () => {
    const val = nicknameInput.trim()
    if (val.length > 20) { setNicknameError(t.nickname.errorChars); return }
    setNicknameSaving(true)
    setNicknameError(null)
    try {
      await api.user.setNickname(val || null)
      qc.invalidateQueries({ queryKey: ['gameState'] })
    } catch (e: any) {
      const code = e?.response?.data?.error
      setNicknameError(code === 'PROFANITY' ? t.nickname.errorProfanity : t.nickname.errorChars)
    } finally {
      setNicknameSaving(false)
    }
  }

  if (isLoading) {
    return (
      <ScreenBackground>
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100dvh', color: colors.fairyGold, fontSize: '24px' }}>
          ✦
        </div>
      </ScreenBackground>
    )
  }

  if (isError || !gameState) {
    return (
      <ScreenBackground>
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', minHeight: '100dvh', gap: '12px', padding: '24px' }}>
          <div style={{ color: colors.fairyGold, fontSize: '32px' }}>⚠️</div>
          <div style={{ color: colors.textPrimary, fontSize: '16px', fontWeight: 600, textAlign: 'center' }}>
            {t.home.loadError}
          </div>
          <div style={{ color: colors.textMuted, fontSize: '13px', textAlign: 'center' }}>
            {(error as Error)?.message ?? t.home.loadErrorHint}
          </div>
          <button
            onClick={() => qc.invalidateQueries({ queryKey: ['gameState'] })}
            style={{
              marginTop: '8px',
              padding: '10px 24px',
              background: `linear-gradient(135deg, ${colors.enchantedPurple}, ${colors.nightBlue})`,
              border: `1px solid ${colors.fairyGold}40`,
              borderRadius: '12px',
              color: colors.fairyGold,
              fontSize: '14px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            {t.common.retry}
          </button>
        </div>
      </ScreenBackground>
    )
  }

  const totalWealth = gameState.balance + gameState.activeProjects.reduce((s, p) => s + p.currentValueRubles, 0)
  const activeValue = gameState.activeProjects.reduce((s, p) => s + p.currentValueRubles, 0)
  // Доход учитывает и уже полученные деньги, и нереализованную прибыль по активным делам —
  // иначе сразу после первого вложения ROI будет −100%, хотя деньги не потеряны, а «в работе»
  const roi = gameState.totalInvested > 0
    ? ((gameState.totalReturned + activeValue - gameState.totalInvested) / gameState.totalInvested * 100)
    : 0

  const currentModel = localModel ?? gameState.preferredModel

  return (
    <ScreenBackground bgImage={homeBackground(gameState.currentDay)}>
      {gameState.pendingRankUp && <RankUpOverlay rank={gameState.pendingRankUp} />}
      <AnimatePresence>
        {showTutorial && (
          <OnboardingTutorial
            onClose={() => {
              setShowTutorial(false)
              localStorage.setItem('onboarding_v3_seen', '1')
              if (!gameState.isOnboardingComplete) completeOnboardingMutation.mutate()
            }}
          />
        )}
        {pendingChangelog && !showTutorial && (
          <WhatsNewOverlay
            entry={pendingChangelog}
            onClose={() => {
              markChangelogSeen(APP_VERSION)
              setPendingChangelog(null)
            }}
          />
        )}
      </AnimatePresence>
      {!showTutorial && !pendingChangelog && <AchievementUnlockedOverlay />}
      <AnimatePresence>
        {showFaq && <FaqModal onClose={() => setShowFaq(false)} />}
      </AnimatePresence>
      <AnimatePresence>
        {showFaqAnnouncement && !showTutorial && (
          <FaqAnnouncementModal onClose={() => setShowFaqAnnouncement(false)} />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {isDayTransition && <DayTransitionOverlay />}
      </AnimatePresence>
      <AnimatePresence>
        {coinShowerDelta !== null && (
          <CoinShowerOverlay
            key="coin-shower"
            delta={coinShowerDelta}
            durationSec={1.6}
            onDone={() => setCoinShowerDelta(null)}
          />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {showMarketAnnouncement && !showTutorial && !pendingChangelog && !showFaqAnnouncement && (
          <MarketAnnouncementOverlay onClose={() => setShowMarketAnnouncement(false)} />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {showChannelPromo && !showTutorial && !pendingChangelog && !showFaqAnnouncement && !showMarketAnnouncement && (
          <ChannelPromoOverlay
            onClose={() => {
              markChannelPromoSeen()
              setShowChannelPromo(false)
            }}
          />
        )}
      </AnimatePresence>

      {/* Баннер-объявление: до 1 мая — о сбросе, с 1 мая — о турнире */}
      <AnimatePresence>
        {showBannerModal && <BannerAnnouncementModal onClose={() => setShowBannerModal(false)} />}
      </AnimatePresence>

      {/* Reset confirmation modal */}
      <AnimatePresence>
        {showResetConfirm && (
          <motion.div
            key="reset-overlay"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => setShowResetConfirm(false)}
            style={{
              position: 'fixed', inset: 0, zIndex: 200,
              background: 'rgba(0,0,0,0.80)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              padding: '20px',
            }}
          >
            <motion.div
              key="reset-modal"
              initial={{ opacity: 0, scale: 0.88, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.88, y: 16 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              onClick={e => e.stopPropagation()}
              style={{
                width: '100%', maxWidth: '360px',
                background: `linear-gradient(180deg, #1a0a08 0%, ${colors.nightBlue} 100%)`,
                border: `1px solid ${colors.danger}50`,
                borderRadius: '16px',
                padding: '24px',
                maxHeight: 'calc(100dvh - 40px)',
                overflowY: 'auto',
              }}
            >
              <div style={{ textAlign: 'center', marginBottom: '16px' }}>
                <div style={{
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  width: '40px', height: '40px', borderRadius: '50%',
                  background: `${colors.danger}20`, border: `2px solid ${colors.danger}`,
                  color: colors.danger, fontSize: '20px', fontWeight: 900, marginBottom: '12px',
                }}>!</div>
                <div style={{ color: colors.textPrimary, fontSize: '16px', fontWeight: 700 }}>
                  {t.home.settingsResetTitle}
                </div>
              </div>
              <div style={{
                padding: '12px',
                background: `${colors.danger}10`,
                border: `1px solid ${colors.danger}30`,
                borderRadius: '10px',
                marginBottom: '16px',
                fontSize: '12px',
                color: colors.textSecondary,
                lineHeight: 1.6,
              }}>
                <div style={{ fontWeight: 700, color: colors.danger, marginBottom: '6px' }}>{t.home.settingsResetDeleted}</div>
                {t.home.settingsResetItems.map(item => (
                  <div key={item} style={{ marginTop: '3px' }}>{item}</div>
                ))}
                <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: `1px solid ${colors.danger}20`, color: colors.textMuted, fontSize: '11px' }}>
                  {t.home.settingsResetSaved}
                </div>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  onClick={() => setShowResetConfirm(false)}
                  style={{
                    flex: 1, padding: '11px',
                    background: 'rgba(255,255,255,0.08)',
                    border: '1px solid rgba(255,255,255,0.15)',
                    borderRadius: '10px',
                    color: colors.textPrimary,
                    fontSize: '13px', fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  {t.common.cancel}
                </button>
                <button
                  onClick={() => resetMutation.mutate()}
                  disabled={resetMutation.isPending}
                  style={{
                    flex: 1, padding: '11px',
                    background: colors.danger,
                    border: 'none',
                    borderRadius: '10px',
                    color: '#fff',
                    fontSize: '13px', fontWeight: 700,
                    cursor: 'pointer',
                    opacity: resetMutation.isPending ? 0.6 : 1,
                  }}
                >
                  {resetMutation.isPending ? t.home.settingsResetPending : t.home.settingsResetConfirm}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      {showMyReferrals && (
        <MyReferralsSheet onClose={() => setShowMyReferrals(false)} />
      )}

      {showDayNews && gameState.activeProjects.length > 0 && (
        <DayNewsOverlay projects={gameState.activeProjects} closures={dayClosures} onClose={() => setShowDayNews(false)} />
      )}

      {/* Settings Sheet */}
      <AnimatePresence>
        {showSettings && (
          <>
            {/* Backdrop */}
            <motion.div
              key="settings-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => { setShowSettings(false); setShowResetConfirm(false) }}
              style={{
                position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 100,
              }}
            />
            {/* Sheet */}
            <motion.div
              key="settings-sheet"
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              style={{
                position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 101,
                background: `linear-gradient(180deg, ${colors.enchantedPurple} 0%, ${colors.nightBlue} 100%)`,
                borderTop: `1px solid ${colors.fairyGold}40`,
                borderRadius: '20px 20px 0 0',
                padding: `24px 20px calc(140px + env(safe-area-inset-bottom))`,
                maxHeight: '85dvh',
                overflowY: 'auto',
              }}
            >
              {/* Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                <div style={{ color: colors.fairyGold, fontSize: '18px', fontWeight: 700 }}>{t.home.settingsTitle}</div>
                <button
                  onClick={() => { setShowSettings(false); setShowResetConfirm(false) }}
                  style={{ background: 'none', border: 'none', color: colors.textMuted, fontSize: '20px', cursor: 'pointer', padding: '4px 8px' }}
                >
                  ✕
                </button>
              </div>

              {/* Nickname section */}
              <div style={{ marginBottom: '28px' }}>
                <div style={{ color: colors.textSecondary, fontSize: '12px', fontWeight: 600, marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  {t.nickname.sectionLabel}
                </div>
                <div style={{ fontSize: '11px', color: colors.textMuted, marginBottom: '8px' }}>{t.nickname.hint}</div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    value={nicknameInput}
                    onChange={e => { setNicknameInput(e.target.value); setNicknameError(null) }}
                    placeholder={t.nickname.placeholder}
                    maxLength={20}
                    style={{
                      flex: 1, padding: '10px 14px',
                      background: 'rgba(255,255,255,0.07)',
                      border: `1px solid ${nicknameError ? '#ff6b6b' : 'rgba(255,255,255,0.15)'}`,
                      borderRadius: '10px', color: colors.textPrimary,
                      fontSize: '14px', outline: 'none',
                    }}
                  />
                  <button
                    onClick={handleSaveNickname}
                    disabled={nicknameSaving}
                    style={{
                      padding: '10px 16px', background: colors.fairyGold,
                      border: 'none', borderRadius: '10px',
                      color: colors.nightBlue, fontSize: '13px', fontWeight: 700,
                      cursor: 'pointer', opacity: nicknameSaving ? 0.6 : 1,
                    }}
                  >
                    {t.nickname.save}
                  </button>
                </div>
                {nicknameError && (
                  <div style={{ color: '#ff6b6b', fontSize: '11px', marginTop: '6px' }}>{nicknameError}</div>
                )}
              </div>

              {/* Model section */}
              <div style={{ marginBottom: '28px' }}>
                <div style={{ color: colors.textSecondary, fontSize: '12px', fontWeight: 600, marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  {t.home.settingsSectionAI}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {MODEL_OPTIONS.map(option => {
                    const isSelected = currentModel === option.id
                    return (
                      <button
                        key={option.id}
                        onClick={() => {
                          setLocalModel(option.id)
                          updateModelMutation.mutate(option.id)
                        }}
                        style={{
                          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                          padding: '12px 16px',
                          background: isSelected ? `${colors.fairyGold}18` : 'rgba(255,255,255,0.05)',
                          border: `1px solid ${isSelected ? colors.fairyGold : 'rgba(255,255,255,0.1)'}`,
                          borderRadius: '12px',
                          cursor: 'pointer',
                          transition: 'all 0.2s',
                          textAlign: 'left',
                        }}
                      >
                        <div>
                          <div style={{ color: isSelected ? colors.fairyGold : colors.textPrimary, fontSize: '14px', fontWeight: 600 }}>
                            {option.label}
                          </div>
                          <div style={{ color: colors.textMuted, fontSize: '12px', marginTop: '2px' }}>
                            {t.home.modelSubtitles[option.id] ?? option.subtitle}
                          </div>
                        </div>
                        <div style={{
                          width: '20px', height: '20px', borderRadius: '50%',
                          border: `2px solid ${isSelected ? colors.fairyGold : 'rgba(255,255,255,0.3)'}`,
                          background: isSelected ? colors.fairyGold : 'transparent',
                          flexShrink: 0,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                          {isSelected && <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: colors.nightBlue }} />}
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Звук */}
              <div style={{ marginBottom: '28px' }}>
                <div style={{ color: colors.textSecondary, fontSize: '12px', fontWeight: 600, marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  {t.home.settingsSectionSound}
                </div>

                {/* Музыка */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                  <span style={{ color: colors.textPrimary, fontSize: '14px' }}>
                    🎵 {musicMuted ? 'Музыка выключена' : 'Музыка играет'}
                  </span>
                  <button
                    onClick={() => {
                      const next = !musicMuted
                      setMusicMutedState(next)
                      setMusicMuted(next)
                    }}
                    style={{
                      padding: '6px 16px',
                      background: musicMuted ? `${colors.textMuted}20` : `${colors.fairyGold}20`,
                      border: `1px solid ${musicMuted ? colors.textMuted : colors.fairyGold}55`,
                      borderRadius: '10px',
                      color: musicMuted ? colors.textMuted : colors.fairyGold,
                      fontSize: '13px', fontWeight: 600, cursor: 'pointer',
                    }}
                  >
                    {musicMuted ? 'Включить' : 'Выключить'}
                  </button>
                </div>

                {/* Звуковые эффекты */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                  <span style={{ color: colors.textPrimary, fontSize: '14px' }}>
                    🔔 {soundMuted ? 'Звуки выключены' : 'Звуки включены'}
                  </span>
                  <button
                    onClick={() => {
                      const next = !soundMuted
                      setSoundMuted(next)
                      setMuted(next)
                      if (!next) playSound('tap')
                    }}
                    style={{
                      padding: '6px 16px',
                      background: soundMuted ? `${colors.textMuted}20` : `${colors.fairyGold}20`,
                      border: `1px solid ${soundMuted ? colors.textMuted : colors.fairyGold}55`,
                      borderRadius: '10px',
                      color: soundMuted ? colors.textMuted : colors.fairyGold,
                      fontSize: '13px', fontWeight: 600, cursor: 'pointer',
                    }}
                  >
                    {soundMuted ? 'Включить' : 'Выключить'}
                  </button>
                </div>

                {(!soundMuted || !musicMuted) && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ color: colors.textMuted, fontSize: '12px', flexShrink: 0 }}>{t.home.settingsSoundLow}</span>
                    <input
                      type="range"
                      min={0} max={1} step={0.05}
                      value={soundVolume}
                      onChange={e => {
                        const v = Number(e.target.value)
                        setSoundVolume(v)
                        setVolume(v)
                      }}
                      onMouseUp={() => !soundMuted && playSound('tap')}
                      onTouchEnd={() => !soundMuted && playSound('tap')}
                      style={{ flex: 1, accentColor: colors.fairyGold }}
                    />
                    <span style={{ color: colors.textMuted, fontSize: '12px', flexShrink: 0 }}>{t.home.settingsSoundHigh}</span>
                  </div>
                )}
              </div>

              {/* Тема оформления — переключатель Классическая / Сказочная */}
              <div style={{ marginBottom: '28px' }}>
                <div style={{ color: colors.textSecondary, fontSize: '12px', fontWeight: 600, marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Оформление
                </div>
                <div style={{
                  display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px',
                }}>
                  {([
                    { id: 'classic' as const, label: 'Классическая', hint: 'Магия в полночь · фиолет + золото' },
                    { id: 'fairy' as const,   label: 'Сказочная',     hint: 'Резное дерево + пергамент + печать' },
                  ]).map(opt => {
                    const isActive = getTheme() === opt.id
                    return (
                      <button
                        key={opt.id}
                        onClick={() => { if (!isActive) { playSound('tap'); setTheme(opt.id) } }}
                        style={{
                          padding: '12px 12px',
                          background: isActive ? `${colors.fairyGold}22` : 'rgba(255,255,255,0.04)',
                          border: `1.5px solid ${isActive ? colors.fairyGold : colors.cardBorder}`,
                          borderRadius: '12px',
                          color: isActive ? colors.fairyGold : colors.textSecondary,
                          fontSize: '13px',
                          fontWeight: 700,
                          cursor: isActive ? 'default' : 'pointer',
                          textAlign: 'left',
                          boxShadow: isActive ? `0 0 16px ${colors.fairyGold}30` : 'none',
                          transition: '0.15s',
                        }}
                      >
                        {opt.label}{isActive && ' ·  ✓'}
                        <div style={{ fontSize: '10px', color: colors.textMuted, marginTop: '4px', fontWeight: 400, lineHeight: 1.4 }}>
                          {opt.hint}
                        </div>
                      </button>
                    )
                  })}
                </div>
                <div style={{ color: colors.textMuted, fontSize: '11px', marginTop: '8px', lineHeight: 1.4 }}>
                  Сменив тему, игра перезагрузится.
                </div>
              </div>

              {/* Повторный просмотр вводного рассказа */}
              <div style={{ marginBottom: '28px' }}>
                <div style={{ color: colors.textSecondary, fontSize: '12px', fontWeight: 600, marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  {t.home.settingsSectionHints}
                </div>
                <button
                  onClick={() => { setShowSettings(false); setShowTutorial(true) }}
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    background: `${colors.fairyGold}18`,
                    border: `1px solid ${colors.fairyGold}55`,
                    borderRadius: '12px',
                    color: colors.fairyGold,
                    fontSize: '14px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    textAlign: 'left',
                  }}
                >
                  {t.home.settingsHowToPlay}
                  <div style={{ fontSize: '11px', color: colors.textMuted, marginTop: '4px', fontWeight: 400 }}>
                    {t.home.settingsHowToPlayHint}
                  </div>
                </button>
                <button
                  onClick={() => { playSound('tap'); setShowSettings(false); setShowFaq(true) }}
                  style={{
                    width: '100%',
                    marginTop: '8px',
                    padding: '12px 16px',
                    background: `${colors.fairyGold}18`,
                    border: `1px solid ${colors.fairyGold}55`,
                    borderRadius: '12px',
                    color: colors.fairyGold,
                    fontSize: '14px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    textAlign: 'left',
                  }}
                >
                  {t.home.settingsFaq}
                  <div style={{ fontSize: '11px', color: colors.textMuted, marginTop: '4px', fontWeight: 400 }}>
                    {t.home.settingsFaqHint}
                  </div>
                </button>
                <button
                  onClick={() => { playSound('tap'); setShowSettings(false); startTour() }}
                  style={{
                    width: '100%',
                    marginTop: '8px',
                    padding: '12px 16px',
                    background: `${colors.fairyGold}18`,
                    border: `1px solid ${colors.fairyGold}55`,
                    borderRadius: '12px',
                    color: colors.fairyGold,
                    fontSize: '14px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    textAlign: 'left',
                  }}
                >
                  {t.home.settingsTour}
                  <div style={{ fontSize: '11px', color: colors.textMuted, marginTop: '4px', fontWeight: 400 }}>
                    {t.home.settingsTourHint}
                  </div>
                </button>
              </div>

              {/* Язык / Language */}
              <div style={{ marginBottom: '28px' }}>
                <div style={{ color: colors.textSecondary, fontSize: '12px', fontWeight: 600, marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  {t.home.settingsSectionLang}
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  {([
                    { l: 'ru' as Lang, flag: '🇷🇺', label: 'Русский' },
                    { l: 'en' as Lang, flag: '🇬🇧', label: 'English' },
                  ]).map(({ l, flag, label }) => (
                    <button
                      key={l}
                      onClick={() => { playSound('tap'); updateLang(l) }}
                      style={{
                        flex: 1,
                        padding: '12px 8px',
                        background: lang === l ? `${colors.fairyGold}18` : 'rgba(255,255,255,0.05)',
                        border: `1px solid ${lang === l ? colors.fairyGold : 'rgba(255,255,255,0.1)'}`,
                        borderRadius: '12px',
                        color: lang === l ? colors.fairyGold : colors.textSecondary,
                        fontSize: '14px',
                        fontWeight: lang === l ? 700 : 400,
                        cursor: 'pointer',
                      }}
                    >
                      {flag} {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Пригласительная грамота */}
              <div style={{ marginBottom: '28px' }}>
                <div style={{ color: colors.textSecondary, fontSize: '12px', fontWeight: 600, marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  {t.home.settingsReferrals}
                </div>
                <button
                  onClick={() => handleInvite(gameState, t.home.inviteLines)}
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    background: `${colors.fairyGold}18`,
                    border: `1px solid ${colors.fairyGold}55`,
                    borderRadius: '12px',
                    color: colors.fairyGold,
                    fontSize: '14px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    textAlign: 'left',
                  }}
                >
                  {t.home.settingsInvite}
                  <div style={{ fontSize: '11px', color: colors.textMuted, marginTop: '4px', fontWeight: 400 }}>
                    {t.home.settingsInviteHint}
                  </div>
                </button>
                <button
                  onClick={() => { setShowSettings(false); setShowMyReferrals(true) }}
                  style={{
                    width: '100%',
                    marginTop: '8px',
                    padding: '10px 16px',
                    background: 'rgba(255,255,255,0.04)',
                    border: `1px solid ${colors.cardBorder}`,
                    borderRadius: '12px',
                    color: colors.textSecondary,
                    fontSize: '13px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    textAlign: 'left',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <span>{t.home.settingsMyReferrals}</span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    {gameState.referralCount > 0 && (
                      <span style={{
                        background: colors.fairyGold, color: colors.nightBlue,
                        borderRadius: '10px', padding: '1px 8px',
                        fontSize: '11px', fontWeight: 700,
                      }}>
                        {gameState.referralCount}
                      </span>
                    )}
                    <span style={{ color: colors.textMuted, fontSize: '11px', fontWeight: 400 }}>→</span>
                  </span>
                </button>
              </div>

              {/* Правила · Отказ от ответственности */}
              <div style={{ marginBottom: '24px' }}>
                <div style={{ color: colors.textMuted, fontSize: '12px', fontWeight: 600, marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  {t.home.settingsSectionLegal}
                </div>
                <div style={{
                  padding: '14px 16px',
                  background: 'rgba(255,255,255,0.04)',
                  border: `1px solid ${colors.cardBorder}`,
                  borderRadius: '12px',
                  color: colors.textMuted,
                  fontSize: '11px',
                  lineHeight: 1.7,
                }}>
                  <strong style={{ color: colors.textSecondary, display: 'block', marginBottom: '6px' }}>
                    {t.home.settingsLegalTitle}
                  </strong>
                  {t.home.settingsLegalText.split('\n\n').map((para, i) => (
                    <span key={i}>{i > 0 && <><br /><br /></>}{para}</span>
                  ))}
                  <br /><br />
                  <span style={{ color: `${colors.fairyGold}90` }}>@vknyazi_bot · v{APP_VERSION}</span>
                </div>
              </div>

              {/* Reset button */}
              <div>
                <button
                  onClick={() => { setShowSettings(false); setShowResetConfirm(true) }}
                  style={{
                    width: '100%', padding: '12px 16px',
                    background: 'rgba(244,67,54,0.12)',
                    border: `1px solid ${colors.danger}60`,
                    borderRadius: '12px',
                    color: colors.danger,
                    fontSize: '14px', fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                  }}
                >
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    width: '20px', height: '20px',
                    borderRadius: '50%',
                    background: colors.danger,
                    color: '#fff',
                    fontSize: '13px', fontWeight: 900, lineHeight: 1,
                    flexShrink: 0,
                  }}>!</span>
                  {t.home.settingsResetBtn}
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Bottom-отступ закрывает FAB «Следующий день» (≈55px), сам FAB сидит на 68px+safe-area,
          плюс зазор 12px чтобы карточки можно было докрутить выше кнопки */}
      <div style={{ padding: `calc(${spacing.xxl} + var(--tg-safe-area-inset-top, env(safe-area-inset-top, 0px))) ${spacing.lg} calc(140px + env(safe-area-inset-bottom))`, maxWidth: '500px', margin: '0 auto' }}>

        {/* Логотип + кнопка настроек */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          style={{ marginBottom: spacing.xxl }}
        >
          {/* Кнопки звука и настроек — строка над заголовком */}
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
            <button
              onClick={() => {
                playSound('tap')
                // Кнопка-выключатель «всё разом»: если хоть что-то играет — выключить всё;
                // если всё выключено — включить и музыку, и звуки
                const allOff = soundMuted && musicMuted
                const next = !allOff
                setSoundMuted(next)
                setMuted(next)
                setMusicMutedState(next)
                setMusicMuted(next)
              }}
              style={{
                background: `${colors.fairyGold}14`,
                border: `1px solid ${colors.fairyGold}35`,
                borderRadius: '10px',
                color: (soundMuted && musicMuted) ? colors.textMuted : colors.fairyGold,
                fontSize: '16px',
                cursor: 'pointer', padding: '5px 8px',
                lineHeight: 1,
              }}
            >
              {(soundMuted && musicMuted) ? '🔇' : '🔊'}
            </button>
            <button
              onClick={() => { playSound('tap'); handleOpenSettings() }}
              style={{
                background: `${colors.fairyGold}14`,
                border: `1px solid ${colors.fairyGold}35`,
                borderRadius: '10px',
                color: colors.fairyGold,
                fontSize: '16px',
                cursor: 'pointer', padding: '5px 8px',
                lineHeight: 1,
              }}
            >
              ⚙️
            </button>
          </div>

          {/* Название + баннер */}
          <div style={{ textAlign: 'center' }}>
            <div style={{
              fontFamily: typography.headingFontFamily,
              fontSize: '28px',
              fontWeight: 700,
              color: colors.fairyGold,
              letterSpacing: '0.06em',
              textShadow: `0 0 24px ${colors.fairyGold}40`,
            }}>
              {t.home.gameTitle}
            </div>
          <button
            onClick={() => setShowBannerModal(true)}
            style={{
              display: 'inline-block',
              marginTop: '6px',
              padding: '3px 10px',
              background: `${colors.fairyGold}18`,
              border: `1px solid ${colors.fairyGold}40`,
              borderRadius: '12px',
              color: colors.fairyGold,
              fontSize: '10px',
              fontWeight: 600,
              letterSpacing: '0.03em',
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            {IS_TOURNAMENT_ACTIVE ? t.home.tournamentBannerBtn : t.home.preResetBannerBtn}
          </button>
          {(() => {
            const maxC = gameState.maxConsecutiveAdvances ?? 7
            const usedC = gameState.consecutiveAdvances ?? 0
            const dayName = usedC > 0 ? t.home.weekDays[Math.min(usedC, maxC) - 1] : null
            return dayName ? (
              <div style={{ color: `${colors.fairyGold}70`, fontSize: '11px', marginTop: '2px', letterSpacing: '0.05em' }}>
                {dayName}
              </div>
            ) : null
          })()}
          <div style={{ color: colors.textMuted, fontSize: '12px', marginTop: '2px' }}>
            ✦ {t.home.dayLabel} {gameState.currentDay} · {(t.ranks as unknown as Record<string, string>)[gameState.investorRank] ?? gameState.investorRank} ✦
          </div>
          </div>{/* end centre block */}

        </motion.div>

        {/* Баланс */}
        <motion.div data-tour="balance" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <FairyCard accent style={{ marginBottom: spacing.lg, textAlign: 'center' }}>
            <div style={{ color: colors.textSecondary, fontSize: '12px', marginBottom: '4px' }}>{t.home.freeBalance}</div>
            <div style={{
              color: colors.fairyGold,
              fontFamily: typography.headingFontFamily,
              fontSize: '40px',
              fontWeight: 700,
              letterSpacing: '0.02em',
              textShadow: `0 0 28px ${colors.fairyGold}50`,
              fontVariantNumeric: 'tabular-nums',
            }}>
              <CountUp value={gameState.balance} />
              <span style={{ fontSize: '26px', marginLeft: '6px', opacity: 0.85 }}>{t.common.currency}</span>
            </div>
            <OrnamentDivider />
            <div style={{ display: 'flex', justifyContent: 'space-around' }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ color: colors.textMuted, fontSize: '11px' }}>{t.home.balanceInvested}</div>
                <div style={{ color: colors.textSecondary, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
                  {Math.floor(gameState.totalInvested)} {t.common.currency}
                </div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ color: colors.textMuted, fontSize: '11px' }}>{t.home.balanceReturned}</div>
                <div style={{ color: colors.textSecondary, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
                  {Math.floor(gameState.totalReturned + activeValue)} {t.common.currency}
                </div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ color: colors.textMuted, fontSize: '11px' }}>{t.home.roi}</div>
                <div style={{ color: roi >= 0 ? colors.success : colors.danger, fontWeight: 700 }}>
                  {roi >= 0 ? '+' : ''}{roi.toFixed(1)}%
                </div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ color: colors.textMuted, fontSize: '11px' }}>Дел взято</div>
                <div style={{ color: colors.textPrimary, fontWeight: 600 }}>{gameState.dealsCount}</div>
              </div>
            </div>
          </FairyCard>
        </motion.div>

        {/* Быстрый доступ к «Отношениям» — чип с суммарным числом жетонов */}
        <TokensQuickChip onNavigate={() => navigate('/relationships')} />

        {/* Активные дела */}
        {gameState.activeProjects.length > 0 && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
            <div style={{ color: colors.fairyGold, fontSize: '13px', fontWeight: 600, marginBottom: spacing.sm, marginLeft: '4px' }}>
              {t.home.activeCount(gameState.activeProjects.length)}
            </div>
            {gameState.activeProjects.map((p, i) => (
              <ActiveProjectCard key={p.id} project={p} delay={0.2 + i * 0.05} onPress={() => navigate(`/portfolio`)} />
            ))}
          </motion.div>
        )}

        {/* Входящие — компактная лента из топ-2 + ссылка на полный список */}
        {gameState.inboxProjects.length > 0 && (
          <motion.div data-tour="inbox-section" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
            <div style={{
              display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
              margin: `${spacing.lg} 4px ${spacing.sm}`,
            }}>
              <div style={{ color: colors.fairyGold, fontSize: '13px', fontWeight: 600 }}>
                {t.home.inboxCount(gameState.inboxProjects.length)}
              </div>
              {gameState.inboxProjects.length > 2 && (
                <button
                  onClick={() => { tgHaptic?.impactOccurred('light'); navigate('/inbox') }}
                  style={{
                    background: 'transparent', border: 'none',
                    color: colors.fairyGold, fontSize: 12, fontWeight: 600,
                    cursor: 'pointer', padding: '2px 4px',
                  }}
                >
                  Все ({gameState.inboxProjects.length}) →
                </button>
              )}
            </div>
            {gameState.inboxProjects.slice(0, 2).map((p, i) => (
              <InboxFeedCard
                key={p.id}
                project={p}
                delay={0.3 + i * 0.06}
                onPress={() => { tgHaptic?.impactOccurred('light'); navigate(`/charter/${p.id}`) }}
              />
            ))}
          </motion.div>
        )}

      </div>

      {/* Модалка оплаты для пропуска ожидания */}
      <AnimatePresence>
        {showPaymentModal && (
          <StarsPaymentOverlay
            isPending={paymentPending}
            onConfirm={handleTimerSkipPayment}
            onClose={() => setShowPaymentModal(false)}
          />
        )}
      </AnimatePresence>

      {/* Плавающая кнопка «Следующий день» — скрыта когда открыты настройки/модалки */}
      {!showSettings && !showPaymentModal && (
        <NextDayFab
          gameState={gameState}
          now={now}
          isPending={advanceMutation.isPending}
          onAdvance={() => {
            tgHaptic?.impactOccurred('medium')
            // Не все дела рассмотрены — предупреждаем, чтобы игрок не «уходил спать»
            // забыв про входящие предложения
            if (gameState.inboxProjects.length > 0) {
              setShowInboxLeftConfirm(true)
            } else {
              advanceMutation.mutate()
            }
          }}
          onWatchAd={() => setShowPaymentModal(true)}
        />
      )}

      <AnimatePresence>
        {showInboxLeftConfirm && (
          <InboxLeftConfirmSheet
            leftCount={gameState?.inboxProjects.length ?? 0}
            pending={advanceMutation.isPending}
            onStay={() => setShowInboxLeftConfirm(false)}
            onAdvance={() => {
              setShowInboxLeftConfirm(false)
              advanceMutation.mutate()
            }}
          />
        )}
      </AnimatePresence>
    </ScreenBackground>
  )
}

function InboxLeftConfirmSheet({
  leftCount, pending, onStay, onAdvance,
}: {
  leftCount: number
  pending: boolean
  onStay: () => void
  onAdvance: () => void
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      onClick={onStay}
      style={{
        position: 'fixed', inset: 0, zIndex: 250,
        background: 'rgba(6, 4, 18, 0.85)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: spacing.lg,
        backdropFilter: 'blur(4px)',
      }}
    >
      <motion.div
        initial={{ scale: 0.92, y: 16 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.92, y: 16 }}
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 380,
          background: `linear-gradient(145deg, ${colors.enchantedPurple}, ${colors.nightBlue})`,
          border: `1px solid ${colors.fairyGold}80`,
          borderRadius: 16,
          padding: spacing.xl,
        }}
      >
        <div style={{ textAlign: 'center', marginBottom: spacing.lg }}>
          <div style={{ fontSize: 44, marginBottom: 4 }}>📜</div>
          <div style={{ color: colors.fairyGold, fontSize: 17, fontWeight: 700 }}>
            Не все дела ещё рассмотрены
          </div>
          <div style={{ color: colors.textSecondary, fontSize: 13, marginTop: spacing.sm, lineHeight: 1.5 }}>
            В инбоксе осталось <b style={{ color: colors.fairyGold }}>{leftCount}</b>{' '}
            {leftCount === 1 ? 'предложение' : leftCount < 5 ? 'предложения' : 'предложений'}.
            Уйдёшь до утра — пропустишь шанс вложиться.
          </div>
        </div>
        <div style={{ display: 'flex', gap: spacing.sm }}>
          <button
            onClick={onStay}
            disabled={pending}
            style={{
              flex: 1, padding: spacing.md,
              background: colors.fairyGold,
              border: 'none',
              borderRadius: 12,
              color: colors.nightBlue,
              fontSize: 14, fontWeight: 800,
              cursor: 'pointer',
            }}
          >
            Остаться на ярмарке
          </button>
          <button
            onClick={onAdvance}
            disabled={pending}
            style={{
              flex: 1, padding: spacing.md,
              background: `${colors.fairyGold}18`,
              border: `1px solid ${colors.fairyGold}55`,
              borderRadius: 12,
              color: colors.fairyGold,
              fontSize: 14, fontWeight: 700,
              cursor: 'pointer',
              opacity: pending ? 0.6 : 1,
            }}
          >
            {pending ? '⏳' : 'Всё равно уйти'}
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}

function MyReferralsSheet({ onClose }: { onClose: () => void }) {
  const t = useT()
  const { data, isLoading } = useQuery({
    queryKey: ['referrals', 'my'],
    queryFn: api.referrals.getMy,
  })
  const threshold = data?.threshold ?? 10

  return (
    <AnimatePresence>
      <motion.div
        key="referrals-backdrop"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={onClose}
        style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 100 }}
      />
      <motion.div
        key="referrals-sheet"
        initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 30, stiffness: 300 }}
        style={{
          position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 101,
          background: `linear-gradient(180deg, ${colors.enchantedPurple} 0%, ${colors.nightBlue} 100%)`,
          borderTop: `1px solid ${colors.fairyGold}40`,
          borderRadius: '20px 20px 0 0',
          padding: `24px 20px calc(140px + env(safe-area-inset-bottom))`,
          maxHeight: '85dvh',
          overflowY: 'auto',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div style={{ color: colors.fairyGold, fontSize: '17px', fontWeight: 700 }}>{t.home.referralsSheetTitle}</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: colors.textMuted, fontSize: '20px', cursor: 'pointer', padding: '4px 8px' }}>✕</button>
        </div>
        <div style={{ color: colors.textMuted, fontSize: '11px', marginBottom: '16px', lineHeight: 1.5 }}>
          {t.home.referralsSheetBonus(threshold)}
        </div>

        {isLoading && [1, 2, 3].map(i => (
          <div key={i} style={{ height: '52px', background: 'rgba(255,255,255,0.05)', borderRadius: '10px', marginBottom: '8px', animation: 'pulse 1.5s infinite' }} />
        ))}

        {!isLoading && data?.referrals.length === 0 && (
          <div style={{ textAlign: 'center', color: colors.textMuted, padding: '32px 0' }}>
            <div style={{ fontSize: '32px', marginBottom: '8px' }}>📜</div>
            <div>{t.home.referralsEmpty}</div>
            <div style={{ fontSize: '11px', marginTop: '4px' }}>{t.home.referralsEmptyHint}</div>
          </div>
        )}

        {data?.referrals.map((r: MyReferralEntryDTO) => {
          const done = r.bonusGranted
          const pct = Math.min(100, Math.round((r.intuitionScore / threshold) * 100))
          const displayName = r.username ? '@' + r.username : r.firstName
          return (
            <div key={r.userId} style={{
              display: 'flex', alignItems: 'center', gap: '12px',
              padding: '10px 12px',
              marginBottom: '8px',
              borderRadius: '10px',
              background: done ? `${colors.success}12` : 'rgba(255,255,255,0.05)',
              border: `1px solid ${done ? colors.success + '40' : colors.cardBorder}`,
            }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ color: done ? colors.success : colors.textPrimary, fontWeight: 600, fontSize: '13px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {displayName}
                </div>
                {!done && (
                  <div style={{ marginTop: '4px' }}>
                    <div style={{ height: '3px', background: 'rgba(255,255,255,0.1)', borderRadius: '2px', overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: pct + '%', background: colors.fairyGold, borderRadius: '2px', transition: 'width 0.3s' }} />
                    </div>
                    <div style={{ color: colors.textMuted, fontSize: '10px', marginTop: '3px' }}>
                      {t.home.referralsIntuition(r.intuitionScore, threshold)}
                    </div>
                  </div>
                )}
              </div>
              <div style={{ flexShrink: 0, textAlign: 'right' }}>
                {done ? (
                  <div style={{ color: colors.success, fontSize: '12px', fontWeight: 700 }}>{t.home.referralsDone}</div>
                ) : (
                  <div style={{ color: colors.textMuted, fontSize: '11px' }}>{t.home.referralsDay(r.currentDay)}</div>
                )}
              </div>
            </div>
          )
        })}
      </motion.div>
    </AnimatePresence>
  )
}

function handleInvite(gameState: { userId: number; firstName?: string } | any, inviteLines: string[]) {
  const userId = gameState?.userId
  if (!userId) return
  // ?startapp= — payload приходит в initData.start_param, не зависит от того,
  // жал ли получатель Start раньше (с ?start= deeplink молчит у активного юзера).
  // Требует настроенной Main Mini App в BotFather (см. CLAUDE.md → Реферальная программа).
  const botLink = `https://t.me/vknyazi_bot?startapp=ref_${userId}`
  const text = inviteLines.join('\n')

  const shareUrl = `https://t.me/share/url?url=${encodeURIComponent(botLink)}&text=${encodeURIComponent(text)}`
  const tg = (window as any).Telegram?.WebApp
  if (tg?.openTelegramLink) tg.openTelegramLink(shareUrl)
  else window.open(shareUrl, '_blank')
}

function NextDayFab({
  gameState, now, isPending, onAdvance, onWatchAd,
}: {
  gameState: { lastAdvancedAt: string | null; advanceCooldownMs: number; consecutiveAdvances: number; maxConsecutiveAdvances: number }
  now: number
  isPending: boolean
  onAdvance: () => void
  onWatchAd: () => void
}) {
  const t = useT()
  const lastMs = gameState.lastAdvancedAt ? new Date(gameState.lastAdvancedAt).getTime() : 0
  const cooldownMs = gameState.advanceCooldownMs ?? 2 * 60 * 60 * 1000
  const remainingFreePresses = Math.max(0, (gameState.maxConsecutiveAdvances ?? 3) - (gameState.consecutiveAdvances ?? 0))
  const remainingMs = Math.max(0, lastMs + cooldownMs - now)
  const isLocked = remainingFreePresses === 0 && remainingMs > 0

  const label = isPending
    ? t.home.nextDayPending
    : isLocked
      ? t.home.nextDayFabCooldown(formatRemaining(remainingMs))
      : `🌅 ${t.home.nextDay}`

  const maxConsec = gameState.maxConsecutiveAdvances ?? 7
  const usedConsec = gameState.consecutiveAdvances ?? 0
  const currentDayName = usedConsec > 0 ? t.home.weekDays[Math.min(usedConsec, maxConsec) - 1] : null

  return (
    <div data-tour="next-day-fab" style={{
      position: 'fixed',
      left: '50%',
      transform: 'translateX(-50%)',
      bottom: 'calc(68px + env(safe-area-inset-bottom))',
      zIndex: 110,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: '4px',
    }}>
      {currentDayName && (
        <div style={{
          color: isLocked ? `${colors.fairyGold}80` : colors.textMuted,
          fontSize: '10px',
          whiteSpace: 'nowrap',
        }}>
          {currentDayName}
        </div>
      )}
      <motion.button
        whileTap={{ scale: isLocked || isPending ? 1 : 0.95 }}
        transition={{ duration: 0.1 }}
        onClick={() => { if (!isLocked && !isPending) onAdvance() }}
        disabled={isPending || isLocked}
        style={{
          padding: '10px 24px',
          background: isLocked
            ? `rgba(13, 23, 53, 0.85)`
            : `linear-gradient(135deg, ${colors.enchantedPurple}ee, ${colors.nightBlue}ee)`,
          border: `1px solid ${isLocked ? `${colors.fairyGold}25` : `${colors.fairyGold}60`}`,
          borderRadius: '24px',
          color: isLocked ? colors.textMuted : colors.fairyGold,
          fontSize: '13px',
          fontWeight: 600,
          cursor: isLocked || isPending ? 'not-allowed' : 'pointer',
          backdropFilter: 'blur(12px)',
          boxShadow: isLocked ? 'none' : `0 4px 20px ${colors.fairyGold}30`,
          whiteSpace: 'nowrap',
          opacity: isPending ? 0.7 : 1,
        }}
      >
        {label}
      </motion.button>

      {isLocked && (
        <motion.button
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
          onClick={onWatchAd}
          style={{
            padding: '7px 18px',
            background: 'rgba(13, 23, 53, 0.80)',
            border: `1px dashed ${colors.fairyGold}45`,
            borderRadius: '20px',
            color: colors.fairyGold,
            fontSize: '12px',
            fontWeight: 600,
            cursor: 'pointer',
            backdropFilter: 'blur(12px)',
            whiteSpace: 'nowrap',
          }}
        >
          {t.home.nextDaySkipFab}
        </motion.button>
      )}
    </div>
  )
}

function NextDayButton({
  gameState, now, isPending, isError, errorMessage, onAdvance, onWatchAd,
}: {
  gameState: {
    lastAdvancedAt: string | null
    advanceCooldownMs: number
    consecutiveAdvances: number
    maxConsecutiveAdvances: number
  }
  now: number
  isPending: boolean
  isError: boolean
  errorMessage: string | undefined
  onAdvance: () => void
  onWatchAd: () => void
}) {
  const t = useT()
  const lastMs = gameState.lastAdvancedAt ? new Date(gameState.lastAdvancedAt).getTime() : 0
  const cooldownMs = gameState.advanceCooldownMs ?? 2 * 60 * 60 * 1000
  const maxConsec = gameState.maxConsecutiveAdvances ?? 3
  const usedConsec = gameState.consecutiveAdvances ?? 0
  const remainingFreePresses = Math.max(0, maxConsec - usedConsec)
  const remainingMs = Math.max(0, lastMs + cooldownMs - now)
  // Блокировка только когда пачка быстрых дней исчерпана И кулдаун ещё идёт
  const isLocked = remainingFreePresses === 0 && remainingMs > 0

  const label = isPending
    ? t.home.nextDayPending
    : isLocked
      ? t.home.nextDayCooldown(formatRemaining(remainingMs))
      : `🌅 ${t.home.nextDay}`

  // Подпись под кнопкой: только когда пачка уже начала расходоваться
  let subline: string | null = null
  if (!isPending) {
    if (isLocked) subline = t.home.nextDayBreak(formatRemaining(remainingMs))
    else if (usedConsec > 0 && remainingFreePresses > 0) {
      subline = t.home.nextDayRemaining(remainingFreePresses, maxConsec)
    }
  }

  return (
    <>
      <motion.button
        whileTap={{ scale: isLocked ? 1 : 0.97 }}
        transition={{ duration: 0.1 }}
        onClick={() => { if (!isLocked && !isPending) onAdvance() }}
        disabled={isPending || isLocked}
        style={{
          width: '100%',
          marginTop: spacing.xl,
          padding: `${spacing.md} ${spacing.lg}`,
          background: `linear-gradient(135deg, ${colors.enchantedPurple}, ${colors.nightBlue})`,
          border: `1px solid ${isLocked ? `${colors.fairyGold}25` : `${colors.fairyGold}40`}`,
          borderRadius: '12px',
          color: isLocked ? colors.textMuted : colors.fairyGold,
          fontSize: '14px',
          fontWeight: 600,
          cursor: isLocked || isPending ? 'not-allowed' : 'pointer',
          opacity: isPending ? 0.6 : 1,
        }}
      >
        {label}
      </motion.button>
      {subline && (
        <div style={{ color: colors.textMuted, fontSize: '11px', textAlign: 'center', marginTop: '6px' }}>
          {subline}
        </div>
      )}
      {isLocked && (
        <button
          onClick={onWatchAd}
          style={{
            width: '100%',
            marginTop: spacing.sm,
            padding: `${spacing.sm} ${spacing.md}`,
            background: 'transparent',
            border: `1px dashed ${colors.fairyGold}50`,
            borderRadius: '12px',
            color: colors.fairyGold,
            fontSize: '13px',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          {t.home.nextDaySkipBtn}
        </button>
      )}
      {isError && !isLocked && (
        <div style={{ color: colors.danger, fontSize: '12px', textAlign: 'center', marginTop: '8px' }}>
          {errorMessage}
        </div>
      )}
    </>
  )
}

function formatRemaining(ms: number): string {
  const total = Math.ceil(ms / 1000)
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  if (h > 0) return `${h}ч ${m.toString().padStart(2, '0')}м`
  if (m > 0) return `${m}м ${s.toString().padStart(2, '0')}с`
  return `${s}с`
}

function StarsPaymentOverlay({
  isPending, onConfirm, onClose,
}: { isPending: boolean; onConfirm: () => void; onClose: () => void }) {
  const t = useT()
  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 250,
        background: 'rgba(0,0,0,0.75)',
        display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
      }}
    >
      <motion.div
        initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: '500px',
          background: colors.nightBlue,
          borderRadius: '20px 20px 0 0',
          border: `1px solid ${colors.cardBorder}`,
          padding: `${spacing.xxl} ${spacing.xxl} calc(${spacing.xxl} + 80px + env(safe-area-inset-bottom))`,
        }}
      >
        <div style={{ fontSize: '40px', textAlign: 'center', marginBottom: spacing.md }}>⭐</div>
        <div style={{ color: colors.fairyGold, fontWeight: 700, fontSize: '17px', textAlign: 'center', marginBottom: spacing.sm }}>
          {t.home.starsSkipTitle}
        </div>
        <div style={{ color: colors.textSecondary, fontSize: '13px', textAlign: 'center', lineHeight: 1.5, marginBottom: spacing.lg }}>
          {t.home.starsSkipBody}
        </div>
        <button
          onClick={onConfirm}
          disabled={isPending}
          style={{
            width: '100%',
            padding: spacing.md,
            background: `linear-gradient(135deg, #FFB800, #FF8C00)`,
            border: 'none',
            borderRadius: '12px',
            color: '#1a0a00',
            fontWeight: 700,
            fontSize: '15px',
            cursor: 'pointer',
            opacity: isPending ? 0.6 : 1,
            marginBottom: spacing.sm,
          }}
        >
          {isPending ? t.home.starsSkipPending : t.home.starsSkipBtn}
        </button>
        <button
          onClick={onClose}
          style={{
            width: '100%',
            padding: spacing.md,
            background: 'transparent',
            border: `1px solid ${colors.cardBorder}`,
            borderRadius: '12px',
            color: colors.textMuted,
            fontWeight: 500,
            fontSize: '14px',
            cursor: 'pointer',
          }}
        >
          {t.home.starsSkipWait}
        </button>
      </motion.div>
    </motion.div>
  )
}

function ActiveProjectCard({ project, delay, onPress }: { project: ProjectDTO; delay: number; onPress: () => void }) {
  const navigate = useNavigate()
  const t = useT()
  const profit = project.investedAmountRubles > 0
    ? ((project.currentValueRubles - project.investedAmountRubles) / project.investedAmountRubles * 100)
    : 0

  const { data: updates } = useQuery({
    queryKey: ['updates', project.id],
    queryFn: () => api.projects.getUpdates(project.id),
  })

  const latestUpdate: DailyUpdateDTO | undefined = updates?.[0]
  // Свежее случайное событие — отдельная плашка ниже, заметная и в характере.
  // Обычные сигналы (payoutStatus, userCountDelta, redFlags) — мелкой строкой как раньше.
  const eventKind = latestUpdate?.eventKind
  let newsSignal: string | null = null
  if (latestUpdate && !eventKind) {
    if (latestUpdate.payoutStatus === 'BOOSTED' || latestUpdate.userCountDelta > 5) newsSignal = '🟢'
    else if (latestUpdate.payoutStatus === 'DELAYED' || latestUpdate.userCountDelta < -5) newsSignal = '🔴'
    else if (latestUpdate.redFlags.length > 0) newsSignal = '⚠️'
  }
  const eventColor = eventKind === 'NEGATIVE' ? colors.danger
    : eventKind === 'POSITIVE' ? colors.success
    : eventKind === 'NEUTRAL' ? colors.fairyGold
    : null
  const eventGlyph = eventKind === 'NEUTRAL' ? '◇' : '◆'

  return (
    <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay }}>
      <FairyCard onClick={onPress} style={{ marginBottom: spacing.sm }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ color: colors.textPrimary, fontWeight: 600, fontSize: '14px' }}>{project.name}</div>
            <div style={{ color: colors.textMuted, fontSize: '11px', marginTop: '2px' }}>
              {project.developerName} · {project.daysSinceJoined} {t.common.days}
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ color: colors.textMuted, fontSize: '10px', letterSpacing: '0.02em' }}>
              {t.home.activeCardInvested} {Math.floor(project.investedAmountRubles)} {t.common.currency}
            </div>
            <div style={{
              color: colors.fairyGold,
              fontFamily: typography.headingFontFamily,
              fontSize: '20px',
              fontWeight: 700,
              lineHeight: 1.1,
              letterSpacing: '0.02em',
              fontVariantNumeric: 'tabular-nums',
              textShadow: `0 0 14px ${colors.fairyGold}30`,
              marginTop: '2px',
            }}>
              <CountUp value={project.currentValueRubles} /> {t.common.currency}
            </div>
            <div style={{ color: profit >= 0 ? colors.success : colors.danger, fontSize: '11px', fontWeight: 600 }}>
              {profit >= 0 ? '+' : ''}{profit.toFixed(1)}%
            </div>
          </div>
        </div>
        {/* Свежее событие — заголовок + полный текст вести прямо на карточке.
            Игрок не должен лезть в Казну чтобы порадоваться/огорчиться. */}
        {eventKind && eventColor && latestUpdate && (
          <div style={{
            marginTop: spacing.sm,
            padding: '10px 12px',
            borderRadius: '10px',
            background: `${eventColor}18`,
            border: `1px solid ${eventColor}55`,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
              <span style={{ color: eventColor, fontSize: '14px', lineHeight: 1 }}>{eventGlyph}</span>
              <span style={{ color: colors.textPrimary, fontSize: '13px', fontWeight: 700, flex: 1 }}>
                {latestUpdate.title}
              </span>
            </div>
            <div style={{ color: colors.textSecondary, fontSize: '12px', lineHeight: 1.5, whiteSpace: 'pre-line' }}>
              {latestUpdate.body}
            </div>
          </div>
        )}
        {(project.isWithdrawalLocked || newsSignal) && (
          <div style={{ display: 'flex', alignItems: 'center', gap: spacing.sm, marginTop: spacing.sm }}>
            {project.isWithdrawalLocked && (
              <div style={{ color: colors.warning, fontSize: '11px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                <LockIcon size={12} /> {t.home.activeCardLocked}
              </div>
            )}
            {newsSignal && !project.isWithdrawalLocked && (
              <div style={{ color: colors.textMuted, fontSize: '11px' }}>
                {newsSignal} {latestUpdate?.title}
              </div>
            )}
          </div>
        )}
        <div style={{ marginTop: spacing.sm, display: 'flex', justifyContent: 'flex-end' }}>
          <button
            onClick={e => { e.stopPropagation(); navigate('/portfolio') }}
            style={{
              padding: '4px 10px', background: `${colors.fairyGold}15`,
              border: `1px solid ${colors.fairyGold}40`, borderRadius: '6px',
              color: colors.fairyGold, cursor: 'pointer', fontSize: '11px',
            }}
          >
            {t.home.activeCardAddMore}
          </button>
        </div>
      </FairyCard>
    </motion.div>
  )
}

// Карточка входящего дела для ленты на главной — компактная, тап ведёт прямо к испытанию.
function InboxFeedCard({ project, delay, onPress }: { project: ProjectDTO; delay: number; onPress: () => void }) {
  const t = useT()
  const typeLabels = t.inbox.types as Record<string, string>
  const typeLabel = typeLabels[project.type] ?? project.type
  return (
    <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay }}>
      <FairyCard onClick={onPress} style={{ marginBottom: spacing.sm, cursor: 'pointer', padding: spacing.md }}>
        <div style={{ display: 'flex', gap: spacing.md, alignItems: 'center' }}>
          {project.bannerImageUrl && (
            <img
              src={project.bannerImageUrl}
              alt={project.name}
              style={{
                width: 64, height: 64, objectFit: 'cover',
                borderRadius: 10, flexShrink: 0,
                border: `1px solid ${colors.fairyGold}40`,
              }}
              onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
            />
          )}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              color: colors.fairyGold, fontWeight: 700, fontSize: 14,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {project.name}
            </div>
            <div style={{ color: colors.textMuted, fontSize: 11, marginTop: 2 }}>
              {typeLabel} · {project.developerName}
            </div>
            <div style={{
              marginTop: 6, display: 'inline-block',
              padding: '3px 8px',
              background: `${colors.fairyGold}18`,
              border: `1px solid ${colors.fairyGold}55`,
              borderRadius: 8,
              color: colors.fairyGold, fontSize: 11, fontWeight: 700,
            }}>
              {t.inbox.studyBtn}
            </div>
          </div>
        </div>
      </FairyCard>
    </motion.div>
  )
}

// Чип-кнопка «Отношения с дельцами» — быстрый доступ на главной.
// Показывает сумму всех жетонов + до 3-х эмодзи хозяев, по которым жетоны есть.
function TokensQuickChip({ onNavigate }: { onNavigate: () => void }) {
  const { gameState } = useGameStore()
  const tokens = gameState?.archetypeTokens ?? {}
  const archEmoji: Record<string, string> = {
    BURATINO: '🪆', BOYARIN: '👑', KOLOBOK: '🤗', KOSCHEI: '💀',
    ZOLUSHKA: '👠', BABA_YAGA: '🧙‍♀️', IVAN_DURAK: '🃏',
  }
  const withBalance = Object.entries(tokens)
    .filter(([, v]) => (v as any)?.balance > 0)
    .map(([k]) => k)
  const totalBalance = Object.values(tokens).reduce((s, v) => s + ((v as any)?.balance ?? 0), 0)
  const sampleEmojis = withBalance.slice(0, 3).map(a => archEmoji[a] ?? '🪙')

  return (
    <motion.button
      onClick={onNavigate}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.15 }}
      whileTap={{ scale: 0.98 }}
      style={{
        width: '100%',
        display: 'flex', alignItems: 'center', gap: spacing.sm,
        marginBottom: spacing.lg,
        padding: `${spacing.sm} ${spacing.md}`,
        background: `linear-gradient(135deg, ${colors.fairyGold}22, ${colors.fairyGold}0A)`,
        border: `1px solid ${colors.fairyGold}66`,
        borderRadius: 14,
        color: colors.fairyGold,
        cursor: 'pointer',
        fontFamily: 'inherit',
        textAlign: 'left',
        boxShadow: totalBalance > 0 ? `0 0 16px ${colors.fairyGold}25` : 'none',
      }}
    >
      <div style={{ fontSize: 22, lineHeight: 1 }}>🪙</div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
          <span>Отношения с дельцами</span>
          {totalBalance > 0 && (
            <span style={{
              padding: '2px 8px', borderRadius: 8,
              background: colors.fairyGold, color: colors.nightBlue,
              fontSize: 11, fontWeight: 800, fontVariantNumeric: 'tabular-nums',
            }}>
              {totalBalance}
            </span>
          )}
        </div>
        <div style={{ fontSize: 11, color: colors.textMuted, marginTop: 2, display: 'flex', alignItems: 'center', gap: 4 }}>
          {sampleEmojis.length > 0 ? (
            <>
              <span style={{ letterSpacing: '0.1em' }}>{sampleEmojis.join(' ')}</span>
              <span>· жетоны хозяев в копилке</span>
            </>
          ) : (
            <span>7 хозяев · жетоны и статистика</span>
          )}
        </div>
      </div>
      <span style={{ fontSize: 16, color: colors.fairyGold, opacity: 0.6 }}>→</span>
    </motion.button>
  )
}

function DayNewsOverlay({
  projects, closures, onClose,
}: {
  projects: ProjectDTO[]
  closures: ClosureSummaryDTO[]
  onClose: () => void
}) {
  const navigate = useNavigate()
  const t = useT()
  const [idx, setIdx] = useState(0)

  // Сначала карточки итогов закрытий (драма), потом — обычные новости активных дел
  const closureCount = closures.length
  const total = closureCount + projects.length
  const isClosure = idx < closureCount
  const currentClosure = isClosure ? closures[idx] : null
  const currentProject = !isClosure ? projects[idx - closureCount] : null

  // Звук при первом закрытии
  useEffect(() => {
    if (!currentClosure) return
    const profitable = currentClosure.profitPercent >= 0
    playSound(profitable ? 'win' : 'lose')
  }, [idx])

  const dismiss = () => {
    if (idx < total - 1) setIdx(idx + 1)
    else onClose()
  }

  const goPrimary = () => {
    onClose()
    navigate(isClosure ? '/registry' : '/portfolio')
  }

  if (!currentClosure && !currentProject) return null

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 200,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      {/* Backdrop */}
      <div
        style={{ position: 'absolute', inset: 0, background: 'rgba(6, 4, 18, 0.88)' }}
        onClick={dismiss}
      />

      {/* Card stack hint */}
      {total - idx - 1 > 0 && (
        <div style={{
          position: 'absolute',
          width: 'min(360px, calc(100vw - 48px))',
          height: '200px',
          background: `linear-gradient(145deg, #1a1040, #0D1735)`,
          border: `1px solid rgba(255,184,0,0.2)`,
          borderRadius: '16px',
          transform: 'translateY(12px) scale(0.95)',
          zIndex: 201,
        }} />
      )}

      <AnimatePresence mode="wait">
        <motion.div
          key={idx}
          drag="x"
          dragConstraints={{ left: 0, right: 0 }}
          dragElastic={0.3}
          onDragEnd={(_, info) => {
            if (info.offset.x > 80) goPrimary()
            else if (info.offset.x < -80) dismiss()
          }}
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{
            opacity: 1, scale: 1, y: 0,
            // Пульс рамки только для closure-карточек, чтобы итог дела бил в глаза
            boxShadow: isClosure
              ? [`0 0 0 ${currentClosure!.profitPercent >= 0 && !currentClosure!.forcedByMafia ? colors.success : colors.danger}40`,
                 `0 0 32px ${currentClosure!.profitPercent >= 0 && !currentClosure!.forcedByMafia ? colors.success : colors.danger}80`,
                 `0 0 0 ${currentClosure!.profitPercent >= 0 && !currentClosure!.forcedByMafia ? colors.success : colors.danger}40`]
              : '0 0 0 rgba(0,0,0,0)',
          }}
          exit={{ opacity: 0, x: -120, scale: 0.85 }}
          transition={{
            type: 'spring', damping: 22, stiffness: 260,
            boxShadow: { duration: 1.6, repeat: Infinity, ease: 'easeInOut' },
          }}
          style={{
            position: 'relative', zIndex: 202,
            width: 'min(360px, calc(100vw - 48px))',
            background: `linear-gradient(145deg, #2A1960, #0D1735)`,
            border: isClosure
              ? `2px solid ${currentClosure!.profitPercent >= 0 && !currentClosure!.forcedByMafia ? colors.success : colors.danger}`
              : `1px solid rgba(255,184,0,0.35)`,
            borderRadius: '16px',
            padding: '20px',
            cursor: 'grab',
          }}
        >
          {/* Counter */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <div style={{ color: colors.fairyGold, fontSize: '11px', fontWeight: 600 }}>
              {isClosure ? t.home.dayNewsClosure(idx + 1, total) : t.home.dayNewsUpdate(idx + 1, total)}
            </div>
            <button
              onClick={onClose}
              style={{ background: 'none', border: 'none', color: colors.textMuted, fontSize: '18px', cursor: 'pointer', padding: '0 4px', lineHeight: 1 }}
            >
              ✕
            </button>
          </div>

          {currentClosure
            ? <ClosureCardContent closure={currentClosure} />
            : currentProject && <ProjectNewsCardContent project={currentProject} />}

          {/* Действия: кнопки + свайп */}
          <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
            <button
              onClick={e => { e.stopPropagation(); dismiss() }}
              style={{
                flex: 1,
                padding: '10px 12px',
                background: 'rgba(255,255,255,0.06)',
                border: `1px solid ${colors.textMuted}40`,
                borderRadius: '10px',
                color: colors.textSecondary,
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              {t.home.dayNewsNext}
            </button>
            <button
              onClick={e => { e.stopPropagation(); goPrimary() }}
              style={{
                flex: 1,
                padding: '10px 12px',
                background: `${colors.fairyGold}20`,
                border: `1px solid ${colors.fairyGold}70`,
                borderRadius: '10px',
                color: colors.fairyGold,
                fontSize: '12px',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              {isClosure ? t.home.dayNewsToRegistry : t.home.dayNewsToDeal}
            </button>
          </div>
          <div style={{ color: colors.textMuted, fontSize: '10px', textAlign: 'center', marginTop: '8px', opacity: 0.7 }}>
            {t.home.dayNewsSwipe}
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  )
}

function ClosureCardContent({ closure }: { closure: ClosureSummaryDTO }) {
  const t = useT()
  const profitable = closure.profitPercent >= 0
  const accent = closure.forcedByMafia
    ? colors.danger
    : profitable
      ? colors.success
      : closure.profitPercent <= -50
        ? colors.danger
        : colors.warning

  const fateLabel = (t.fates[closure.fate as keyof typeof t.fates] ?? closure.fate).replace(/^\S+\s/, '')

  const fateEmoji = closure.forcedByMafia ? '⚡'
    : closure.fate === 'UNICORN' ? '🔥'
    : closure.fate === 'SURVIVOR' ? '⚓'
    : closure.fate === 'INSTANT_SCAM' ? '💀'
    : closure.fate === 'SLOW_DRAIN' ? '🕯️'
    : closure.fate === 'HONEST_FAIL' ? '😔'
    : '📜'

  // Haptic-сигнал при появлении карточки итогов — игрок физически почувствует
  useEffect(() => {
    const tg = (window as any).Telegram?.WebApp?.HapticFeedback
    if (!tg) return
    if (closure.forcedByMafia || !profitable) tg.notificationOccurred('warning')
    else tg.notificationOccurred('success')
  }, [closure.id])

  return (
    <div>
      {/* Большой fate-эмодзи сверху — драма, кричит «дело закрылось» */}
      <div style={{ textAlign: 'center', marginBottom: '12px' }}>
        <motion.div
          initial={{ scale: 0.5, rotate: -10 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: 'spring', damping: 12, stiffness: 200, delay: 0.1 }}
          style={{ fontSize: '56px', lineHeight: 1, filter: `drop-shadow(0 0 12px ${accent}80)` }}
        >
          {fateEmoji}
        </motion.div>
        <div style={{
          color: accent,
          fontFamily: typography.headingFontFamily,
          fontSize: '14px',
          fontWeight: 700,
          letterSpacing: '0.15em',
          textTransform: 'uppercase',
          marginTop: '6px',
          textShadow: `0 0 16px ${accent}60`,
        }}>
          {t.home.closedTitle}
        </div>
      </div>

      {/* Заголовок: имя + delta */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
        <div>
          <div style={{ color: colors.textPrimary, fontWeight: 700, fontSize: '15px' }}>{closure.name}</div>
          <div style={{ color: colors.textMuted, fontSize: '11px', marginTop: '2px' }}>
            {closure.developerName} · {closure.daysActive} {t.common.days}
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ color: accent, fontFamily: typography.headingFontFamily, fontSize: '22px', fontWeight: 700, lineHeight: 1.1 }}>
            {profitable ? '+' : ''}{closure.profitPercent.toFixed(1)}%
          </div>
          <div style={{ color: colors.textMuted, fontSize: '10px', marginTop: '2px' }}>{fateLabel}</div>
        </div>
      </div>

      {/* Причина закрытия (наратив) */}
      <div style={{
        padding: '10px 12px',
        background: `${accent}15`,
        border: `1px solid ${accent}50`,
        borderRadius: '10px',
        color: colors.textSecondary,
        fontSize: '12px',
        lineHeight: 1.5,
        marginBottom: '12px',
        whiteSpace: 'pre-line',
      }}>
        {closure.forcedByMafia && (
          <div style={{ color: colors.danger, fontSize: '11px', fontWeight: 700, marginBottom: '4px' }}>
            {t.home.mafiaForced}
          </div>
        )}
        {closure.closureReason}
      </div>

      {/* Числа: Вложено → Получено */}
      <div style={{ display: 'flex', justifyContent: 'space-around', alignItems: 'center', padding: '8px 0' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ color: colors.textMuted, fontSize: '10px' }}>{t.home.balanceInvested}</div>
          <div style={{ color: colors.textSecondary, fontWeight: 600, fontSize: '14px', fontVariantNumeric: 'tabular-nums' }}>
            {Math.floor(closure.investedAmount)} {t.common.currency}
          </div>
        </div>
        <div style={{ color: colors.textMuted, fontSize: '14px' }}>→</div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ color: colors.textMuted, fontSize: '10px' }}>{t.home.balanceReturned}</div>
          <div style={{
            color: accent,
            fontFamily: typography.headingFontFamily,
            fontSize: '20px',
            fontWeight: 700,
            fontVariantNumeric: 'tabular-nums',
            textShadow: `0 0 12px ${accent}40`,
          }}>
            {Math.floor(closure.returnedAmount)} {t.common.currency}
          </div>
        </div>
      </div>
    </div>
  )
}

function ProjectNewsCardContent({ project }: { project: ProjectDTO }) {
  const t = useT()
  const { data: updates } = useQuery({
    queryKey: ['updates', project.id],
    queryFn: () => api.projects.getUpdates(project.id),
  })

  const latest = updates?.[0]
  // Случайное событие имеет приоритет в подаче — заметный цветной ромб
  let signal = '⚪'
  let signalColor: string = colors.textMuted
  if (latest?.eventKind === 'NEGATIVE') { signal = '◆'; signalColor = colors.danger }
  else if (latest?.eventKind === 'POSITIVE') { signal = '◆'; signalColor = colors.success }
  else if (latest?.eventKind === 'NEUTRAL') { signal = '◇'; signalColor = colors.fairyGold }
  else if (latest) {
    if (latest.payoutStatus === 'BOOSTED' || latest.userCountDelta > 5) { signal = '🟢'; signalColor = colors.success }
    else if (latest.payoutStatus === 'DELAYED' || latest.userCountDelta < -5) { signal = '🔴'; signalColor = colors.danger }
  }

  const profit = project.investedAmountRubles > 0
    ? ((project.currentValueRubles - project.investedAmountRubles) / project.investedAmountRubles * 100)
    : 0

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
        <div>
          <div style={{ color: colors.textPrimary, fontWeight: 700, fontSize: '15px' }}>{project.name}</div>
          <div style={{ color: colors.textMuted, fontSize: '11px', marginTop: '2px' }}>{project.developerName}</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ color: colors.fairyGold, fontWeight: 700 }}>{Math.floor(project.currentValueRubles)} {t.common.currency}</div>
          <div style={{ color: profit >= 0 ? colors.success : colors.danger, fontSize: '11px' }}>
            {profit >= 0 ? '+' : ''}{profit.toFixed(1)}%
          </div>
        </div>
      </div>

      {latest ? (
        <div style={{
          background: 'rgba(255,255,255,0.05)',
          border: `1px solid ${signalColor}40`,
          borderRadius: '10px',
          padding: '10px 12px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
            <span style={{ fontSize: '13px' }}>{signal}</span>
            <span style={{ color: colors.textSecondary, fontSize: '12px', fontWeight: 600 }}>{latest.title}</span>
          </div>
          <div style={{ color: colors.textMuted, fontSize: '11px', lineHeight: 1.5, whiteSpace: 'pre-line' }}>
            {latest.body.slice(0, 220)}{latest.body.length > 220 ? '…' : ''}
          </div>
          {latest.redFlags.length > 0 && (
            <div style={{ marginTop: '6px' }}>
              {latest.redFlags.slice(0, 2).map((flag, i) => (
                <div key={i} style={{ color: colors.warning, fontSize: '10px' }}>⚠️ {flag}</div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div style={{ color: colors.textMuted, fontSize: '12px', textAlign: 'center', padding: '12px' }}>
          {t.common.loading}
        </div>
      )}
    </div>
  )
}

// Переключатель вручную: true = баннер «Тестируем 2 сезон», false = объявление о перезапуске
const IS_TOURNAMENT_ACTIVE = true

function BannerAnnouncementModal({ onClose }: { onClose: () => void }) {
  const t = useT()
  const content = IS_TOURNAMENT_ACTIVE ? null : t.home.preReset

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 260,
        background: 'rgba(6, 4, 18, 0.88)',
      }}
    >
      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 30, stiffness: 300 }}
        onClick={e => e.stopPropagation()}
        style={{
          position: 'fixed', bottom: 0, left: 0, right: 0,
          maxHeight: '90dvh',
          display: 'flex', flexDirection: 'column',
          background: `linear-gradient(180deg, ${colors.enchantedPurple} 0%, ${colors.nightBlue} 100%)`,
          borderTop: `1px solid ${colors.fairyGold}55`,
          borderRadius: '20px 20px 0 0',
          boxShadow: '0 -8px 32px rgba(0,0,0,0.5)',
        }}
      >
        {/* Заголовок — фиксирован */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: `${spacing.lg} ${spacing.lg} ${spacing.md}`,
          borderBottom: `1px solid ${colors.fairyGold}25`,
          flexShrink: 0,
        }}>
          <div style={{ color: colors.fairyGold, fontSize: '16px', fontWeight: 800, flex: 1, paddingRight: spacing.sm }}>
            {content ? content.title : '🧪 Тестируем 2 сезон!'}
          </div>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', color: colors.textMuted, fontSize: '20px', cursor: 'pointer', padding: '4px 8px', flexShrink: 0 }}
          >
            ✕
          </button>
        </div>

        {/* Скроллируемый контент */}
        <div style={{ overflowY: 'auto', flex: 1, padding: spacing.lg }}>
          {content ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.md }}>
              {content.sections.map((s, i) => (
                <div key={i} style={{
                  padding: `${spacing.sm} ${spacing.md}`,
                  background: 'rgba(255,255,255,0.04)',
                  border: `1px solid ${colors.cardBorder}`,
                  borderRadius: '10px',
                }}>
                  {s.heading && (
                    <div style={{ color: colors.fairyGold, fontSize: '12px', fontWeight: 700, marginBottom: '4px' }}>
                      {s.heading}
                    </div>
                  )}
                  <div style={{ color: colors.textPrimary, fontSize: '13px', lineHeight: 1.6, whiteSpace: 'pre-line' }}>
                    {s.body}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <Season2TestingScene />
          )}
        </div>

        {/* Кнопка — фиксирована снизу */}
        <div style={{
          padding: `${spacing.md} ${spacing.lg} calc(${spacing.lg} + env(safe-area-inset-bottom))`,
          flexShrink: 0,
          borderTop: `1px solid ${colors.fairyGold}25`,
        }}>
          <button
            onClick={onClose}
            style={{
              width: '100%',
              padding: spacing.md,
              background: colors.fairyGold,
              border: 'none', borderRadius: '12px',
              color: colors.nightBlue,
              fontSize: '14px', fontWeight: 700,
              cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            {t.common.close}
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}

// ─── Сцена «Тестируем 2 сезон» ──────────────────────────────────────────────
// Живая SVG-картинка: 3 купца-тестировщика играют на телефонах. Над каждым
// летят монетки/искорки, пальцы тапают по экрану. Тап по фигурке — взлетает +1.
function Season2TestingScene() {
  const [pops, setPops] = useState<Array<{ id: number; x: number; y: number; value: string }>>([])
  const idRef = useRef(0)

  const spawnPop = (x: number, y: number) => {
    const id = idRef.current++
    const v = Math.random() < 0.4 ? '⭐' : '+1'
    setPops(prev => [...prev, { id, x, y, value: v }])
    setTimeout(() => setPops(prev => prev.filter(p => p.id !== id)), 900)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.md }}>
      <div style={{ position: 'relative', width: '100%', aspectRatio: '5 / 4', maxWidth: 360, margin: '0 auto' }}>
        <svg viewBox="0 0 500 400" width="100%" height="100%" style={{ display: 'block' }}>
          <defs>
            <linearGradient id="phoneScreen" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#FFE090" stopOpacity="0.9" />
              <stop offset="100%" stopColor="#FFB800" stopOpacity="0.75" />
            </linearGradient>
          </defs>

          {/* Деревянная скамья / стол */}
          <rect x="20" y="320" width="460" height="14" rx="3" fill="#3A2210" />
          <rect x="20" y="334" width="460" height="34" rx="3" fill="#2A1808" />
          <line x1="60" y1="320" x2="60" y2="368" stroke="#1A1004" strokeWidth="1" />
          <line x1="260" y1="320" x2="260" y2="368" stroke="#1A1004" strokeWidth="1" />
          <line x1="440" y1="320" x2="440" y2="368" stroke="#1A1004" strokeWidth="1" />

          {/* — Тестировщик 1 (слева, скоморох в красном колпаке) — */}
          <g transform="translate(110, 220)">
            <circle cx="0" cy="-90" r="32" fill="#E8C28A" stroke="#8C6230" strokeWidth="2" />
            <path d="M -28 -106 Q -16 -150 0 -150 Q 16 -150 28 -106 Z" fill="#C03030" stroke="#5A0808" strokeWidth="2" />
            <circle cx="-28" cy="-106" r="5" fill="#FFE090" />
            <circle cx="-10" cy="-92" r="2.5" fill="#0D1735" />
            <circle cx="10" cy="-92" r="2.5" fill="#0D1735" />
            <path d="M -8 -80 Q 0 -74 8 -80" fill="none" stroke="#5A2A10" strokeWidth="2" />
            <path d="M -20 -75 Q 0 -50 20 -75 Q 14 -68 0 -66 Q -14 -68 -20 -75 Z" fill="#3D2A05" />
            <path d="M -40 -55 L 40 -55 L 50 60 L -50 60 Z" fill="#2A1960" stroke="#FFB800" strokeWidth="1.5" />
            <path d="M -30 -55 L 30 -55 L 30 -42 Q 0 -36 -30 -42 Z" fill="#FFB800" opacity="0.6" />
            <rect x="-28" y="-30" width="56" height="80" rx="10" fill="#1A1024" stroke="#FFB800" strokeWidth="2" />
            <rect x="-22" y="-22" width="44" height="62" rx="3" fill="url(#phoneScreen)" />
            <rect x="-18" y="-18" width="14" height="14" rx="2" fill="#0D1735" opacity="0.6" />
            <rect x="-2" y="-18" width="14" height="14" rx="2" fill="#0D1735" opacity="0.6" />
            <rect x="-18" y="-2" width="14" height="14" rx="2" fill="#0D1735" opacity="0.6" />
            <rect x="-2" y="-2" width="14" height="14" rx="2" fill="#0D1735" opacity="0.6" />
            <g>
              <ellipse cx="6" cy="20" rx="5" ry="3" fill="#E8C28A" stroke="#8C6230" strokeWidth="1">
                <animate attributeName="cy" values="20;8;20" dur="1.4s" repeatCount="indefinite" />
                <animate attributeName="rx" values="5;6;5" dur="1.4s" repeatCount="indefinite" />
              </ellipse>
              <circle cx="6" cy="20" r="4" fill="none" stroke="#FFE090" strokeWidth="2" opacity="0.7">
                <animate attributeName="r" values="4;14;4" dur="1.4s" repeatCount="indefinite" />
                <animate attributeName="opacity" values="0.7;0;0.7" dur="1.4s" repeatCount="indefinite" />
              </circle>
            </g>
          </g>
          <rect x="80" y="290" width="60" height="40" rx="6" fill="transparent"
                style={{ cursor: 'pointer' }}
                onClick={(e) => spawnPop((e.nativeEvent as MouseEvent).offsetX, (e.nativeEvent as MouseEvent).offsetY)} />

          {/* — Тестировщица 2 (центр, кокошник) — */}
          <g transform="translate(250, 230)">
            <circle cx="0" cy="-100" r="32" fill="#F5D4A0" stroke="#8C6230" strokeWidth="2" />
            <path d="M -32 -120 Q 0 -160 32 -120 L 32 -110 L -32 -110 Z" fill="#9060C0" stroke="#3A1850" strokeWidth="2" />
            <circle cx="0" cy="-130" r="3" fill="#FFE090" />
            <circle cx="-12" cy="-122" r="2" fill="#FFE090" />
            <circle cx="12" cy="-122" r="2" fill="#FFE090" />
            <path d="M -24 -90 Q -40 -50 -32 -10 Q -28 -8 -28 -14 Q -32 -50 -22 -86" fill="#5A3A10" />
            <circle cx="-10" cy="-100" r="2.5" fill="#0D1735" />
            <circle cx="10" cy="-100" r="2.5" fill="#0D1735" />
            <path d="M -8 -88 Q 0 -82 8 -88" fill="none" stroke="#C03030" strokeWidth="2" />
            <path d="M -42 -65 L 42 -65 L 52 50 L -52 50 Z" fill="#7D2030" stroke="#FFB800" strokeWidth="1.5" />
            <path d="M -30 -65 L 30 -65 L 30 -52 Q 0 -46 -30 -52 Z" fill="#FFB800" opacity="0.6" />
            <rect x="-30" y="-40" width="60" height="86" rx="10" fill="#1A1024" stroke="#FFB800" strokeWidth="2" />
            <rect x="-24" y="-32" width="48" height="68" rx="3" fill="url(#phoneScreen)" />
            <rect x="-20" y="-28" width="40" height="18" rx="2" fill="#2A1960" />
            <circle cx="-12" cy="-19" r="3" fill="#FFB800" />
            <rect x="-6" y="-22" width="22" height="2" fill="#FFB800" opacity="0.7" />
            <rect x="-6" y="-18" width="16" height="2" fill="#FFB800" opacity="0.4" />
            <rect x="-18" y="20" width="36" height="10" rx="3" fill="#FFB800">
              <animate attributeName="opacity" values="0.4;1;0.4" dur="1.5s" repeatCount="indefinite" />
            </rect>
            <g>
              <ellipse cx="0" cy="40" rx="5" ry="3" fill="#F5D4A0" stroke="#8C6230" strokeWidth="1">
                <animate attributeName="cy" values="40;26;40" dur="1.1s" repeatCount="indefinite" />
              </ellipse>
              <circle cx="0" cy="40" r="4" fill="none" stroke="#FFE090" strokeWidth="2" opacity="0.7">
                <animate attributeName="r" values="4;16;4" dur="1.1s" repeatCount="indefinite" />
                <animate attributeName="opacity" values="0.7;0;0.7" dur="1.1s" repeatCount="indefinite" />
              </circle>
            </g>
          </g>
          <rect x="220" y="300" width="60" height="40" rx="6" fill="transparent"
                style={{ cursor: 'pointer' }}
                onClick={(e) => spawnPop((e.nativeEvent as MouseEvent).offsetX, (e.nativeEvent as MouseEvent).offsetY)} />

          {/* — Тестировщик 3 (справа, боярин в шапке) — */}
          <g transform="translate(390, 220)">
            <circle cx="0" cy="-90" r="32" fill="#D6A878" stroke="#5A3A10" strokeWidth="2" />
            <path d="M -30 -106 Q -16 -140 0 -142 Q 16 -140 30 -106 L 30 -100 L -30 -100 Z" fill="#3D2810" stroke="#1A0A04" strokeWidth="2" />
            <path d="M -30 -106 L 30 -106" stroke="#8C6230" strokeWidth="3" />
            <path d="M -22 -78 Q 0 -30 22 -78 Q 16 -62 0 -56 Q -16 -62 -22 -78 Z" fill="#2A1A05" />
            <circle cx="-10" cy="-92" r="2.5" fill="#0D1735" />
            <circle cx="10" cy="-92" r="2.5" fill="#0D1735" />
            <path d="M -40 -55 L 40 -55 L 50 60 L -50 60 Z" fill="#3A4060" stroke="#FFB800" strokeWidth="1.5" />
            <path d="M -30 -55 L 30 -55 L 30 -42 Q 0 -36 -30 -42 Z" fill="#FFB800" opacity="0.6" />
            <rect x="-28" y="-30" width="56" height="80" rx="10" fill="#1A1024" stroke="#FFB800" strokeWidth="2" />
            <rect x="-22" y="-22" width="44" height="62" rx="3" fill="url(#phoneScreen)" />
            {[0,1,2].map(r => [0,1,2].map(c => (
              <rect key={`${r}-${c}`} x={-18 + c * 13} y={-18 + r * 13} width="10" height="10" rx="2"
                    fill={(r + c) % 2 === 0 ? '#2A1960' : '#7D2030'} opacity="0.7" />
            )))}
            <g>
              <ellipse cx="-4" cy="22" rx="5" ry="3" fill="#D6A878" stroke="#5A3A10" strokeWidth="1">
                <animate attributeName="cy" values="22;10;22" dur="1.7s" repeatCount="indefinite" />
              </ellipse>
              <circle cx="-4" cy="22" r="4" fill="none" stroke="#FFE090" strokeWidth="2" opacity="0.7">
                <animate attributeName="r" values="4;14;4" dur="1.7s" repeatCount="indefinite" />
                <animate attributeName="opacity" values="0.7;0;0.7" dur="1.7s" repeatCount="indefinite" />
              </circle>
            </g>
          </g>
          <rect x="360" y="290" width="60" height="40" rx="6" fill="transparent"
                style={{ cursor: 'pointer' }}
                onClick={(e) => spawnPop((e.nativeEvent as MouseEvent).offsetX, (e.nativeEvent as MouseEvent).offsetY)} />

          {/* Парящие монетки и искры */}
          <circle cx="80" cy="60" r="6" fill="#FFB800" opacity="0.85">
            <animate attributeName="cy" values="60;40;60" dur="3s" repeatCount="indefinite" />
            <animate attributeName="opacity" values="0.85;0.4;0.85" dur="3s" repeatCount="indefinite" />
          </circle>
          <circle cx="160" cy="40" r="4" fill="#FFE090" opacity="0.6">
            <animate attributeName="cy" values="40;20;40" dur="2.4s" repeatCount="indefinite" />
          </circle>
          <circle cx="320" cy="50" r="6" fill="#FFB800" opacity="0.8">
            <animate attributeName="cy" values="50;30;50" dur="2.8s" repeatCount="indefinite" />
          </circle>
          <circle cx="420" cy="70" r="5" fill="#FFE090" opacity="0.7">
            <animate attributeName="cy" values="70;48;70" dur="3.2s" repeatCount="indefinite" />
          </circle>
          {/* Реплики-облачка */}
          <g transform="translate(160, 130)">
            <path d="M 0 0 Q -8 -2 -10 6 Q -4 8 0 6 L 4 12 L 4 6 Q 12 4 10 -2 Q 6 -6 0 0" fill="rgba(255,255,255,0.85)" />
            <text x="-3" y="6" fontSize="8" fill="#0D1735" fontWeight="700">!</text>
          </g>
          <g transform="translate(340, 140)">
            <path d="M 0 0 Q 8 -2 10 6 Q 4 8 0 6 L -4 12 L -4 6 Q -12 4 -10 -2 Q -6 -6 0 0" fill="rgba(255,255,255,0.85)" />
            <text x="-2" y="6" fontSize="8" fill="#0D1735" fontWeight="700">?</text>
          </g>
        </svg>

        {/* Всплывающие +1 при тапе по фигуркам */}
        <AnimatePresence>
          {pops.map(p => (
            <motion.div
              key={p.id}
              initial={{ opacity: 1, y: 0, scale: 1 }}
              animate={{ opacity: 0, y: -50, scale: 1.5 }}
              transition={{ duration: 0.9, ease: 'easeOut' }}
              style={{
                position: 'absolute', left: p.x, top: p.y,
                transform: 'translate(-50%, -100%)',
                color: colors.fairyGold, fontSize: 22, fontWeight: 900,
                textShadow: '0 2px 8px rgba(0,0,0,0.6)',
                pointerEvents: 'none', userSelect: 'none',
              }}
            >
              {p.value}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      <div style={{
        padding: `${spacing.md} ${spacing.lg}`,
        background: 'rgba(255,255,255,0.04)',
        border: `1px solid ${colors.cardBorder}`,
        borderRadius: '12px',
        color: colors.textPrimary,
        fontSize: 13, lineHeight: 1.6, textAlign: 'center',
      }}>
        Сейчас обкатываем второй сезон: 7 разных мини-игр, новые чины,
        живые сцены и убрали «чуйку». Спасибо что тестируешь — пиши фидбек
        в обсуждении канала, любая мелочь поможет.
      </div>
    </div>
  )
}
