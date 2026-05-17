import { useState, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { colors, spacing , gradients } from '@/theme'
import { useT } from '@/i18n'

// ─── Типы ─────────────────────────────────────────────────────────────────────

interface FaqItem {
  q: string
  a: string | string[]  // строка или список абзацев
}

// ─── FaqItem — один вопрос/ответ с раскрытием ─────────────────────────────────

function FaqItemRow({ item }: { item: FaqItem }) {
  const [open, setOpen] = useState(false)
  const lines = Array.isArray(item.a) ? item.a : [item.a]

  return (
    <div
      style={{
        borderBottom: `1px solid rgba(255,255,255,0.07)`,
        overflow: 'hidden',
      }}
    >
      <button
        onClick={() => setOpen(v => !v)}
        style={{
          width: '100%', textAlign: 'left',
          padding: '14px 16px',
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px',
        }}
      >
        <span style={{ color: colors.textOnDark, fontSize: '14px', fontWeight: 600, lineHeight: 1.4, flex: 1 }}>
          {item.q}
        </span>
        <span style={{
          color: colors.fairyGold, fontSize: '16px', flexShrink: 0,
          transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
          transition: 'transform 0.2s',
          marginTop: '1px',
        }}>
          ▾
        </span>
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            style={{ overflow: 'hidden' }}
          >
            <div style={{ padding: '0 16px 14px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {lines.map((line, i) => (
                <p key={i} style={{
                  margin: 0,
                  color: colors.textOnDarkSecond,
                  fontSize: '13px',
                  lineHeight: 1.6,
                  paddingLeft: lines.length > 1 ? '8px' : 0,
                  borderLeft: lines.length > 1 ? `2px solid ${colors.fairyGold}40` : 'none',
                }}>
                  {line}
                </p>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ─── FaqModal ─────────────────────────────────────────────────────────────────

export function FaqModal({ onClose }: { onClose: () => void }) {
  const t = useT()
  const sections = t.faq.sections
  const [activeId, setActiveId] = useState(sections[0].id)
  const tabsRef = useRef<HTMLDivElement>(null)
  const activeSection = sections.find(s => s.id === activeId) ?? sections[0]

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      style={{
        position: 'fixed', inset: 0, zIndex: 300,
        background: 'rgba(6, 4, 18, 0.92)',
        display: 'flex', flexDirection: 'column',
      }}
      onClick={onClose}
    >
      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 30, stiffness: 300 }}
        onClick={e => e.stopPropagation()}
        style={{
          position: 'absolute', bottom: 0, left: 0, right: 0,
          height: '90vh',
          background: gradients.modal,
          borderRadius: '20px 20px 0 0',
          border: `1px solid ${colors.fairyGold}30`,
          display: 'flex', flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* Шапка */}
        <div style={{
          padding: '16px 20px 12px',
          borderBottom: `1px solid rgba(255,255,255,0.08)`,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          flexShrink: 0,
        }}>
          <div>
            <div style={{ color: colors.fairyGold, fontSize: '18px', fontWeight: 800, letterSpacing: '0.04em' }}>
              {t.faq.title}
            </div>
            <div style={{ color: colors.textOnDarkMuted, fontSize: '11px', marginTop: '2px' }}>
              {t.faq.subtitle}
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'rgba(255,255,255,0.08)',
              border: `1px solid rgba(255,255,255,0.15)`,
              borderRadius: '50%', width: '34px', height: '34px',
              color: colors.textOnDarkSecond, fontSize: '16px',
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            ✕
          </button>
        </div>

        {/* Разделы — горизонтальный скролл */}
        <div
          ref={tabsRef}
          style={{
            display: 'flex', gap: '8px',
            padding: '12px 16px',
            overflowX: 'auto', flexShrink: 0,
            scrollbarWidth: 'none',
            borderBottom: `1px solid rgba(255,255,255,0.07)`,
          }}
        >
          {sections.map(section => {
            const isActive = section.id === activeId
            return (
              <button
                key={section.id}
                onClick={() => setActiveId(section.id)}
                style={{
                  flexShrink: 0,
                  padding: '7px 14px',
                  borderRadius: '20px',
                  border: `1px solid ${isActive ? colors.fairyGold : 'rgba(255,255,255,0.15)'}`,
                  background: isActive ? `${colors.fairyGold}22` : 'rgba(255,255,255,0.05)',
                  color: isActive ? colors.fairyGold : colors.textOnDarkSecond,
                  fontSize: '13px', fontWeight: isActive ? 700 : 400,
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                  whiteSpace: 'nowrap',
                }}
              >
                {section.label}
              </button>
            )
          })}
        </div>

        {/* Контент раздела */}
        <AnimatePresence mode="wait">
          <motion.div
            key={activeId}
            initial={{ opacity: 0, x: 16 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -16 }}
            transition={{ duration: 0.18 }}
            style={{ overflowY: 'auto', flex: 1, paddingBottom: '32px' }}
          >
            {activeSection.items.map((item, i) => (
              <FaqItemRow key={i} item={item} />
            ))}
          </motion.div>
        </AnimatePresence>
      </motion.div>
    </motion.div>
  )
}

// ─── FaqAnnouncementModal — одноразовый анонс ЧАВО ──────────────────────────

const FAQ_SEEN_KEY = 'faq_v1_seen'

export function useFaqAnnouncement() {
  if (typeof window === 'undefined') return false
  return !localStorage.getItem(FAQ_SEEN_KEY)
}

export function FaqAnnouncementModal({ onClose }: { onClose: () => void }) {
  const t = useT()
  const handleClose = () => {
    localStorage.setItem(FAQ_SEEN_KEY, '1')
    onClose()
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      style={{
        position: 'fixed', inset: 0, zIndex: 350,
        background: 'rgba(6, 4, 18, 0.92)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '24px',
      }}
    >
      <motion.div
        initial={{ scale: 0.88, y: 24 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.88, y: 24 }}
        transition={{ type: 'spring', damping: 26, stiffness: 280 }}
        style={{
          width: '100%', maxWidth: '360px',
          background: gradients.modal,
          border: `1px solid ${colors.fairyGold}50`,
          borderRadius: '20px',
          padding: '28px 24px 24px',
          boxShadow: '0 20px 60px rgba(0,0,0,0.7)',
          textAlign: 'center',
        }}
      >
        <div style={{ fontSize: '56px', marginBottom: '12px' }}>❓</div>

        <div style={{ color: colors.fairyGold, fontSize: '20px', fontWeight: 800, marginBottom: '12px' }}>
          {t.faq.announcementTitle}
        </div>

        <div style={{ color: colors.textOnDark, fontSize: '14px', lineHeight: 1.6, marginBottom: '16px' }}>
          {t.faq.announcementBody}
        </div>

        <div style={{
          padding: '10px 14px',
          background: `${colors.fairyGold}12`,
          border: `1px solid ${colors.fairyGold}35`,
          borderRadius: '12px',
          color: colors.textOnDarkMuted,
          fontSize: '12px',
          lineHeight: 1.5,
          marginBottom: '20px',
        }}>
          {t.faq.announcementHint}
        </div>

        <button
          onClick={handleClose}
          style={{
            width: '100%',
            padding: '14px',
            background: colors.fairyGold,
            border: 'none',
            borderRadius: '12px',
            color: colors.nightBlue,
            fontSize: '15px', fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          {t.faq.announcementBtn}
        </button>
      </motion.div>
    </motion.div>
  )
}
