import { useEffect, useRef, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { colors, spacing } from '@/theme'
import { useTourStore, TOUR_TOTAL } from '@/stores/tourStore'

// ─── Шаги тура ────────────────────────────────────────────────────────────────

interface Step {
  page: string | null   // куда нужно перейти для этого шага
  target: string | null // data-tour selector для подсветки
  title: string
  body: string
  accent?: string
  action: string        // текст кнопки
}

const STEPS: Step[] = [
  {
    page: null,
    target: null,
    title: 'Быстрый тур по игре',
    body: 'Покажем основные элементы интерфейса. Займёт пару минут — потом легче разобраться.',
    action: 'Начать',
  },
  {
    page: '/',
    target: '[data-tour="balance"]',
    title: 'Твой баланс',
    body: 'Здесь свободные гроши — внутриигровая валюта. Сейчас ноль, первые деньги появятся после первой завершённой беседы с дельцом.',
    action: 'Понял',
  },
  {
    page: '/',
    target: '[data-tour="inbox-section"]',
    title: 'Входящие грамоты',
    body: 'Сюда приходят предложения от хозяев дел. Открой, чтобы изучить предложение перед вложением.',
    action: 'Открыть входящие',
  },
  {
    page: '/inbox',
    target: '[data-tour="first-project"]',
    title: 'Предложение от хозяина',
    body: 'Каждая карточка — отдельное дело. Видишь посул (APY), тип дела, имя хозяина. Нажми «Изучить грамоту» чтобы начать разбор.',
    action: 'К грамоте',
  },
  {
    page: '/inbox',
    target: '[data-tour="charter-btn"]',
    title: 'Купеческая грамота',
    body: 'Разбери сетку из 24 печатей: найди поддельные — они немного отличаются от эталона вверху. Чем больше подделок — тем сильнее хозяин врёт в обещаниях.',
    accent: '1–2 подделки → скорее честно · 4–5 → почти наверняка скам',
    action: 'Понял',
  },
  {
    page: '/inbox',
    target: '[data-tour="invest-btn"]',
    title: 'Вложи деньги',
    body: 'После разбора грамоты можно вложить гроши в дело. Минимум — 5 г. Активных дел одновременно может быть не больше 5.',
    action: 'Понял',
  },
  {
    page: '/',
    target: '[data-tour="next-day-fab"]',
    title: 'Следующий день',
    body: 'Нажимай эту кнопку каждый день — дела развиваются, приходят новые вести, появляются события. Без этого время не идёт.',
    action: 'Понял',
  },
  {
    page: '/portfolio',
    target: '[data-tour="portfolio-project"]',
    title: 'Казна — твои вложения',
    body: 'Здесь все активные дела. Нажми на дело чтобы открыть летопись: ежедневные вести от хозяина, доходность и число вкладчиков.',
    action: 'Открыть казну',
  },
  {
    page: '/portfolio',
    target: '[data-tour="portfolio-actions"]',
    title: 'Довложить или вывести',
    body: 'Видишь что дело идёт хорошо? Вложи ещё. Замечаешь тревожные знаки — выводи деньги. Не жди пока сбегут.',
    action: 'Понял',
  },
  {
    page: '/inbox',
    target: '[data-tour="ama-btn"]',
    title: 'Беседа с дельцом',
    body: 'У каждого предложения есть кнопка «Беседа» — можно задать хозяину до 10 вопросов. Слушай внимательно: опытный жулик говорит убедительно, но под давлением проговаривается.',
    action: 'Понял',
  },
  {
    page: '/stats',
    target: '[data-tour="achievements-section"]',
    title: 'Подвиги открываются',
    body: 'После первых закрытых дел здесь появятся карточки — правила вывода по типам, личины хозяев, судьбы проектов. Пользуйся как шпаргалкой.',
    action: 'Понял',
  },
  {
    page: null,
    target: null,
    title: 'Совет: читай печати внимательно',
    body: 'Число фальшивых печатей напрямую связано с типом исхода дела. Тренируй глаз — со временем начнёшь угадывать скам ещё на этапе грамоты.',
    accent: 'Чуйка растёт за каждый правильно опознанный исход',
    action: 'Понял',
  },
  {
    page: null,
    target: null,
    title: 'Что-то непонятно? Есть ЧАВО',
    body: 'Все правила, типы дел, судьбы проектов и особенности вывода — в разделе «ЧАВО».',
    accent: '⚙️ Настройки → ЧАВО',
    action: 'Завершить тур',
  },
]

// ─── Spotlight — подсветка элемента через 4 тёмных прямоугольника ─────────────

function Spotlight({ rect }: { rect: DOMRect }) {
  const pad = 6
  const x = Math.max(0, rect.left - pad)
  const y = Math.max(0, rect.top - pad)
  const w = rect.width + pad * 2
  const h = rect.height + pad * 2
  const bg = 'rgba(0,0,0,0.72)'

  return (
    <>
      <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 399 }}>
        {/* top */}
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: y, background: bg }} />
        {/* left */}
        <div style={{ position: 'absolute', top: y, left: 0, width: x, height: h, background: bg }} />
        {/* right */}
        <div style={{ position: 'absolute', top: y, left: x + w, right: 0, height: h, background: bg }} />
        {/* bottom */}
        <div style={{ position: 'absolute', top: y + h, left: 0, right: 0, bottom: 0, background: bg }} />
        {/* gold border */}
        <div style={{
          position: 'absolute', top: y, left: x, width: w, height: h,
          border: `2px solid ${colors.fairyGold}`,
          borderRadius: '10px',
          boxShadow: `0 0 0 3px ${colors.fairyGold}30, 0 0 24px ${colors.fairyGold}50`,
        }} />
      </div>
    </>
  )
}

// ─── TourCard — карточка с текстом и кнопкой ─────────────────────────────────

function TourCard({
  step, total, targetRect, onNext, onDismiss,
}: {
  step: Step
  total: number
  targetRect: DOMRect | null
  onNext: () => void
  onDismiss: () => void
}) {
  // Позиция карточки: снизу если цель в верхней половине экрана (или нет цели),
  // сверху если цель в нижней трети
  const winH = window.innerHeight
  const showAbove = targetRect !== null && targetRect.bottom > winH * 0.65

  const cardStyle: React.CSSProperties = showAbove
    ? {
        position: 'fixed',
        left: spacing.lg, right: spacing.lg,
        top: Math.max(8, (targetRect?.top ?? 0) - 220),
        zIndex: 400,
      }
    : {
        position: 'fixed',
        left: spacing.lg, right: spacing.lg,
        bottom: `calc(72px + env(safe-area-inset-bottom) + 8px)`,
        zIndex: 400,
      }

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 16 }}
      transition={{ duration: 0.2 }}
      style={cardStyle}
    >
      <div style={{
        background: `linear-gradient(145deg, ${colors.enchantedPurple}, #0f1228)`,
        border: `1px solid ${colors.fairyGold}50`,
        borderRadius: '16px',
        padding: '16px 16px 14px',
        boxShadow: '0 8px 32px rgba(0,0,0,0.7)',
      }}>
        {/* Прогресс */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
          <div style={{ display: 'flex', gap: '4px' }}>
            {Array.from({ length: total }).map((_, i) => {
              const idx = STEPS.indexOf(step)
              return (
                <div key={i} style={{
                  width: i === idx ? '16px' : '6px', height: '4px',
                  borderRadius: '2px',
                  background: i < idx
                    ? `${colors.fairyGold}80`
                    : i === idx ? colors.fairyGold : 'rgba(255,255,255,0.15)',
                  transition: 'all 0.25s',
                }} />
              )
            })}
          </div>
          <button
            onClick={onDismiss}
            style={{
              background: 'transparent', border: 'none',
              color: colors.textMuted, fontSize: '16px',
              cursor: 'pointer', padding: '0 2px', lineHeight: 1,
            }}
          >✕</button>
        </div>

        <div style={{ color: colors.fairyGold, fontSize: '15px', fontWeight: 700, marginBottom: '6px' }}>
          {step.title}
        </div>
        <div style={{ color: colors.textPrimary, fontSize: '13px', lineHeight: 1.55, marginBottom: step.accent ? '10px' : '14px' }}>
          {step.body}
        </div>
        {step.accent && (
          <div style={{
            padding: '7px 12px', marginBottom: '14px',
            background: `${colors.fairyGold}12`,
            border: `1px solid ${colors.fairyGold}35`,
            borderRadius: '10px',
            color: colors.fairyGold,
            fontSize: '12px', fontWeight: 600,
          }}>
            {step.accent}
          </div>
        )}
        <button
          onClick={onNext}
          style={{
            width: '100%', padding: '11px',
            background: colors.fairyGold,
            border: 'none', borderRadius: '10px',
            color: colors.nightBlue,
            fontSize: '14px', fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          {step.action}
        </button>
      </div>
    </motion.div>
  )
}

// ─── TourOverlay — точка входа, рендерится в AppShell ─────────────────────────

export function TourOverlay() {
  const { step: stepIdx, next, dismiss } = useTourStore()
  const navigate = useNavigate()
  const location = useLocation()
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null)
  const rafRef = useRef<number | null>(null)

  const step = stepIdx !== null && stepIdx < STEPS.length ? STEPS[stepIdx] : null

  // Навигация при смене шага
  useEffect(() => {
    if (!step) return
    if (step.page && location.pathname !== step.page) {
      navigate(step.page)
    }
  }, [stepIdx])

  // Поиск целевого элемента — опрашиваем каждые 200мс (элемент может появиться
  // после загрузки данных)
  useEffect(() => {
    if (!step?.target) { setTargetRect(null); return }

    const tick = () => {
      const el = document.querySelector(step.target!) as HTMLElement | null
      if (el) {
        setTargetRect(el.getBoundingClientRect())
      } else {
        setTargetRect(null)
      }
      rafRef.current = window.setTimeout(tick, 300)
    }
    tick()
    return () => { if (rafRef.current) clearTimeout(rafRef.current) }
  }, [stepIdx, location.pathname])

  const handleNext = () => {
    next()
  }

  if (step === null || stepIdx === null) return null

  // Шаги без целевой страницы — центрированная модалка
  const isCentered = !step.page || !step.target

  return (
    <AnimatePresence>
      <div key={stepIdx}>
        {/* Тёмный фон для шагов без spotlight */}
        {isCentered && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{
              position: 'fixed', inset: 0, zIndex: 399,
              background: 'rgba(0,0,0,0.72)',
            }}
          />
        )}

        {/* Spotlight (только если нашли элемент) */}
        {!isCentered && targetRect && <Spotlight rect={targetRect} />}

        {/* Карточка тура */}
        {isCentered ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ type: 'spring', damping: 26, stiffness: 280 }}
            style={{
              position: 'fixed', zIndex: 400,
              left: spacing.lg, right: spacing.lg,
              top: '50%', transform: 'translateY(-50%)',
            }}
          >
            <div style={{
              background: `linear-gradient(145deg, ${colors.enchantedPurple}, #0f1228)`,
              border: `1px solid ${colors.fairyGold}50`,
              borderRadius: '20px',
              padding: '24px 20px 20px',
              boxShadow: '0 16px 48px rgba(0,0,0,0.75)',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <div style={{ display: 'flex', gap: '4px' }}>
                  {Array.from({ length: TOUR_TOTAL }).map((_, i) => (
                    <div key={i} style={{
                      width: i === stepIdx ? '16px' : '6px', height: '4px', borderRadius: '2px',
                      background: i < stepIdx
                        ? `${colors.fairyGold}80`
                        : i === stepIdx ? colors.fairyGold : 'rgba(255,255,255,0.15)',
                      transition: 'all 0.25s',
                    }} />
                  ))}
                </div>
                <button onClick={dismiss} style={{ background: 'transparent', border: 'none', color: colors.textMuted, fontSize: '16px', cursor: 'pointer', padding: '0 2px', lineHeight: 1 }}>✕</button>
              </div>

              <div style={{ color: colors.fairyGold, fontSize: '17px', fontWeight: 700, marginBottom: '10px' }}>
                {step.title}
              </div>
              <div style={{ color: colors.textPrimary, fontSize: '14px', lineHeight: 1.6, marginBottom: step.accent ? '14px' : '18px' }}>
                {step.body}
              </div>
              {step.accent && (
                <div style={{
                  padding: '8px 14px', marginBottom: '18px',
                  background: `${colors.fairyGold}12`, border: `1px solid ${colors.fairyGold}35`,
                  borderRadius: '10px', color: colors.fairyGold, fontSize: '13px', fontWeight: 600,
                }}>
                  {step.accent}
                </div>
              )}
              <button onClick={handleNext} style={{
                width: '100%', padding: '13px',
                background: colors.fairyGold, border: 'none', borderRadius: '12px',
                color: colors.nightBlue, fontSize: '15px', fontWeight: 700, cursor: 'pointer',
              }}>
                {step.action}
              </button>
            </div>
          </motion.div>
        ) : (
          <TourCard
            step={step}
            total={TOUR_TOTAL}
            targetRect={targetRect}
            onNext={handleNext}
            onDismiss={dismiss}
          />
        )}
      </div>
    </AnimatePresence>
  )
}
