import { useEffect, useRef, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { colors, spacing , gradients } from '@/theme'
import { useTourStore, TOUR_TOTAL } from '@/stores/tourStore'
import { useT } from '@/i18n'

// ─── Маршруты и цели для каждого шага тура ───────────────────────────────────

interface StepMeta {
  page: string | null   // куда нужно перейти для этого шага
  target: string | null // data-tour selector для подсветки
}

const STEP_META: StepMeta[] = [
  { page: null,        target: null },
  { page: '/',         target: '[data-tour="balance"]' },
  { page: '/',         target: '[data-tour="inbox-section"]' },
  { page: '/inbox',    target: '[data-tour="first-project"]' },
  { page: '/inbox',    target: '[data-tour="charter-btn"]' },
  { page: null,        target: null },
  { page: '/',         target: '[data-tour="next-day-fab"]' },
  { page: '/portfolio',target: '[data-tour="portfolio-project"]' },
  { page: '/portfolio',target: '[data-tour="portfolio-actions"]' },
  { page: null,        target: null },
  { page: '/stats',    target: '[data-tour="achievements-section"]' },
  { page: null,        target: null },
  { page: null,        target: null },
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
  stepIdx, stepData, total, targetRect, onNext, onDismiss,
}: {
  stepIdx: number
  stepData: { title: string; body: string; accent?: string | null; action: string }
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
        background: gradients.modal,
        border: `1px solid ${colors.fairyGold}50`,
        borderRadius: '16px',
        padding: '16px 16px 14px',
        boxShadow: '0 8px 32px rgba(0,0,0,0.7)',
      }}>
        {/* Прогресс */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
          <div style={{ display: 'flex', gap: '4px' }}>
            {Array.from({ length: total }).map((_, i) => (
              <div key={i} style={{
                width: i === stepIdx ? '16px' : '6px', height: '4px',
                borderRadius: '2px',
                background: i < stepIdx
                  ? `${colors.fairyGold}80`
                  : i === stepIdx ? colors.fairyGold : 'rgba(255,255,255,0.15)',
                transition: 'all 0.25s',
              }} />
            ))}
          </div>
          <button
            onClick={onDismiss}
            style={{
              background: 'transparent', border: 'none',
              color: colors.textOnDarkMuted, fontSize: '16px',
              cursor: 'pointer', padding: '0 2px', lineHeight: 1,
            }}
          >✕</button>
        </div>

        <div style={{ color: colors.fairyGold, fontSize: '15px', fontWeight: 700, marginBottom: '6px' }}>
          {stepData.title}
        </div>
        <div style={{ color: colors.textOnDark, fontSize: '13px', lineHeight: 1.55, marginBottom: stepData.accent ? '10px' : '14px' }}>
          {stepData.body}
        </div>
        {stepData.accent && (
          <div style={{
            padding: '7px 12px', marginBottom: '14px',
            background: `${colors.fairyGold}12`,
            border: `1px solid ${colors.fairyGold}35`,
            borderRadius: '10px',
            color: colors.fairyGold,
            fontSize: '12px', fontWeight: 600,
          }}>
            {stepData.accent}
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
          {stepData.action}
        </button>
      </div>
    </motion.div>
  )
}

// ─── TourOverlay — точка входа, рендерится в AppShell ─────────────────────────

export function TourOverlay() {
  const t = useT()
  const { step: stepIdx, next, dismiss } = useTourStore()
  const navigate = useNavigate()
  const location = useLocation()
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null)
  const rafRef = useRef<number | null>(null)

  const meta = stepIdx !== null && stepIdx < STEP_META.length ? STEP_META[stepIdx] : null
  const stepData = stepIdx !== null && stepIdx < t.tour.steps.length ? t.tour.steps[stepIdx] : null

  // Навигация при смене шага
  useEffect(() => {
    if (!meta) return
    if (meta.page && location.pathname !== meta.page) {
      navigate(meta.page)
    }
  }, [stepIdx])

  // Поиск целевого элемента — опрашиваем каждые 200мс (элемент может появиться
  // после загрузки данных)
  useEffect(() => {
    if (!meta?.target) { setTargetRect(null); return }

    let scrolled = false
    const tick = () => {
      const el = document.querySelector(meta.target!) as HTMLElement | null
      if (el) {
        if (!scrolled) {
          scrolled = true
          el.scrollIntoView({ behavior: 'smooth', block: 'center' })
          // Берём rect после небольшой паузы — scrollIntoView ещё не завершился
          rafRef.current = window.setTimeout(() => {
            setTargetRect(el.getBoundingClientRect())
            rafRef.current = window.setTimeout(tick, 300)
          }, 400)
          return
        }
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

  if (meta === null || stepData === null || stepIdx === null) return null

  // Шаги без целевой страницы — центрированная модалка
  const isCentered = !meta.page || !meta.target

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
              background: gradients.modal,
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
                <button onClick={dismiss} style={{ background: 'transparent', border: 'none', color: colors.textOnDarkMuted, fontSize: '16px', cursor: 'pointer', padding: '0 2px', lineHeight: 1 }}>✕</button>
              </div>

              <div style={{ color: colors.fairyGold, fontSize: '17px', fontWeight: 700, marginBottom: '10px' }}>
                {stepData.title}
              </div>
              <div style={{ color: colors.textOnDark, fontSize: '14px', lineHeight: 1.6, marginBottom: stepData.accent ? '14px' : '18px' }}>
                {stepData.body}
              </div>
              {stepData.accent && (
                <div style={{
                  padding: '8px 14px', marginBottom: '18px',
                  background: `${colors.fairyGold}12`, border: `1px solid ${colors.fairyGold}35`,
                  borderRadius: '10px', color: colors.fairyGold, fontSize: '13px', fontWeight: 600,
                }}>
                  {stepData.accent}
                </div>
              )}
              <button onClick={handleNext} style={{
                width: '100%', padding: '13px',
                background: colors.fairyGold, border: 'none', borderRadius: '12px',
                color: colors.nightBlue, fontSize: '15px', fontWeight: 700, cursor: 'pointer',
              }}>
                {stepData.action}
              </button>
            </div>
          </motion.div>
        ) : (
          <TourCard
            stepIdx={stepIdx}
            stepData={stepData}
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
