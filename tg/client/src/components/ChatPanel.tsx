import { useEffect, useRef, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useLocation } from 'react-router-dom'
import { api, type ChatMessageDTO } from '@/api/client'
import { useGameStore } from '@/stores/gameStore'
import { colors, spacing } from '@/theme'
import { useT } from '@/i18n'

// Определяет язык по доминирующему скрипту, возвращает null если русский или неизвестно
function detectForeignLanguage(text: string): string | null {
  if (!text || text.length < 2) return null
  const chars = text.replace(/\s+/g, '')
  if (!chars.length) return null
  const cyrillic = (chars.match(/[Ѐ-ӿ]/g) ?? []).length
  if (cyrillic / chars.length > 0.25) return null // русский
  const arabic = (chars.match(/[؀-ۿݐ-ݿ]/g) ?? []).length
  if (arabic / chars.length > 0.2) return 'ar'
  const chinese = (chars.match(/[一-鿿㐀-䶿]/g) ?? []).length
  if (chinese / chars.length > 0.15) return 'zh'
  const latin = (chars.match(/[a-zA-Z]/g) ?? []).length
  if (latin / chars.length > 0.25) return 'en'
  return null
}

const LANG_LABEL: Record<string, string> = {
  en: '🇬🇧 English',
  ar: '🇸🇦 Arabic',
  zh: '🇨🇳 Chinese',
}

const RANK_EMOJI: Record<string, string> = {
  NEWBIE: '🪙',
  AMBASSADOR: '🏪',
  ANALYST: '📜',
  SHARK: '⚔️',
  LAMBO_SENSEI: '👑',
}

const POLL_INTERVAL = 5000

export function ChatPanel() {
  const location = useLocation()
  const t = useT()
  const gameState = useGameStore(s => s.gameState)

  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<ChatMessageDTO[]>([])
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [unread, setUnread] = useState(0)
  const [replyTo, setReplyTo] = useState<ChatMessageDTO | null>(null)
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [translations, setTranslations] = useState<Record<number, string>>({})
  const [translating, setTranslating] = useState<number | null>(null)

  const uiLang = gameState?.preferredLanguage === 'en' ? 'en' : 'ru'

  // Сбрасываем кэш переводов при смене языка интерфейса
  useEffect(() => { setTranslations({}) }, [uiLang])

  const lastIdRef = useRef(0)
  const listRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const hidden = location.pathname.startsWith('/ama/') ||
    location.pathname.startsWith('/charter/') ||
    location.pathname === '/registry'

  const fetchMessages = useCallback(async (initial = false) => {
    try {
      const since = initial ? 0 : lastIdRef.current
      const msgs = await api.chat.getMessages(since > 0 ? since : undefined)
      if (msgs.length === 0) return
      if (initial) {
        setMessages(msgs)
        lastIdRef.current = msgs[msgs.length - 1].id
      } else {
        setMessages(prev => [...prev, ...msgs])
        if (!open) setUnread(u => u + msgs.length)
        lastIdRef.current = msgs[msgs.length - 1].id
      }
    } catch { /* silent */ }
  }, [open])

  useEffect(() => { fetchMessages(true) }, [])

  useEffect(() => {
    pollRef.current = setInterval(() => fetchMessages(false), POLL_INTERVAL)
    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, [fetchMessages])

  useEffect(() => {
    if (open && listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight
    }
  }, [open, messages.length])

  const handleOpen = () => { setOpen(true); setUnread(0) }

  const handleSend = async () => {
    const val = text.trim()
    if (!val || sending) return
    setSending(true)
    setError(null)
    try {
      const msg = await api.chat.sendMessage(val, replyTo?.id)
      setText('')
      setReplyTo(null)
      setMessages(prev => prev.find(m => m.id === msg.id) ? prev : [...prev, msg])
      lastIdRef.current = Math.max(lastIdRef.current, msg.id)
      setTimeout(() => { if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight }, 50)
    } catch (e: any) {
      const code = e?.response?.data?.error
      if (code === 'PROFANITY') setError(t.chat.errorProfanity)
      else if (code === 'RATE_LIMIT') setError(t.chat.errorRateLimit)
      else setError(t.chat.errorGeneral)
    } finally {
      setSending(false) }
  }

  const handleDelete = async (id: number) => {
    setSelectedId(null)
    try {
      await api.chat.deleteMessage(id)
      setMessages(prev => prev.filter(m => m.id !== id))
    } catch { /* silent */ }
  }

  const handleTranslate = async (msg: ChatMessageDTO) => {
    setSelectedId(null)
    if (translations[msg.id]) return // уже есть
    setTranslating(msg.id)
    const targetLang = (gameState?.preferredLanguage === 'en') ? 'en' : 'ru'
    try {
      const { translation } = await api.chat.translate(msg.text, targetLang)
      setTranslations(prev => ({ ...prev, [msg.id]: translation }))
    } catch { /* silent */ } finally {
      setTranslating(null)
    }
  }

  const handleReply = (msg: ChatMessageDTO) => {
    setSelectedId(null)
    setReplyTo(msg)
    setTimeout(() => inputRef.current?.focus(), 50)
  }

  const handleMsgTap = (msg: ChatMessageDTO, isMe: boolean) => {
    if (selectedId === msg.id) { setSelectedId(null); return }
    setSelectedId(msg.id)
  }

  if (hidden) return null

  const myUserId = gameState?.userId

  return (
    <>
      {/* Floating button */}
      <AnimatePresence>
        {!open && (
          <motion.button
            key="chat-fab"
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            onClick={handleOpen}
            style={{
              position: 'fixed', right: '16px',
              bottom: `calc(72px + env(safe-area-inset-bottom))`,
              zIndex: 150, width: '48px', height: '48px', borderRadius: '50%',
              background: `linear-gradient(135deg, ${colors.enchantedPurple}, #1a0f4e)`,
              border: `1.5px solid ${colors.fairyGold}60`,
              boxShadow: `0 4px 20px rgba(0,0,0,0.5), 0 0 16px ${colors.fairyGold}20`,
              cursor: 'pointer', display: 'flex', alignItems: 'center',
              justifyContent: 'center', fontSize: '22px',
            }}
          >
            💬
            {unread > 0 && (
              <div style={{
                position: 'absolute', top: '-4px', right: '-4px',
                background: '#e74c3c', color: '#fff', borderRadius: '50%',
                width: '18px', height: '18px', fontSize: '10px', fontWeight: 700,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                {unread > 9 ? '9+' : unread}
              </div>
            )}
          </motion.button>
        )}
      </AnimatePresence>

      {/* Chat panel */}
      <AnimatePresence>
        {open && (
          <>
            <motion.div
              key="chat-backdrop"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => { setOpen(false); setSelectedId(null) }}
              style={{ position: 'fixed', inset: 0, zIndex: 160, background: 'rgba(0,0,0,0.55)' }}
            />
            <motion.div
              key="chat-panel"
              initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 32, stiffness: 320 }}
              style={{
                position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 161,
                height: '72dvh',
                background: `linear-gradient(180deg, ${colors.enchantedPurple} 0%, ${colors.nightBlue} 100%)`,
                borderTop: `1px solid ${colors.fairyGold}40`,
                borderRadius: '20px 20px 0 0',
                display: 'flex', flexDirection: 'column',
              }}
            >
              {/* Header */}
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: `${spacing.md} ${spacing.lg}`,
                borderBottom: `1px solid rgba(255,255,255,0.07)`, flexShrink: 0,
              }}>
                <div style={{ color: colors.fairyGold, fontSize: '16px', fontWeight: 700 }}>
                  🏪 {t.chat.title}
                </div>
                <button
                  onClick={() => setOpen(false)}
                  style={{ background: 'none', border: 'none', color: colors.textMuted, fontSize: '20px', cursor: 'pointer', padding: '4px 8px' }}
                >✕</button>
              </div>

              {/* Message list */}
              <div
                ref={listRef}
                onClick={() => setSelectedId(null)}
                style={{
                  flex: 1, overflowY: 'auto',
                  padding: `${spacing.sm} ${spacing.md}`,
                  display: 'flex', flexDirection: 'column', gap: '6px',
                }}
              >
                {messages.length === 0 && (
                  <div style={{ color: colors.textMuted, fontSize: '13px', textAlign: 'center', marginTop: '32px' }}>
                    {t.chat.empty}
                  </div>
                )}
                {messages.map(msg => {
                  const isMe = msg.userId === myUserId
                  const isSelected = selectedId === msg.id
                  const foreignLang = detectForeignLanguage(msg.text)
                  // Кнопка нужна только если язык сообщения отличается от языка интерфейса
                  const needsTranslation = foreignLang !== null && foreignLang !== uiLang
                  const translation = translations[msg.id]
                  const isTranslating = translating === msg.id
                  return (
                    <div
                      key={msg.id}
                      style={{ alignSelf: isMe ? 'flex-end' : 'flex-start', maxWidth: '82%' }}
                      onClick={e => { e.stopPropagation(); handleMsgTap(msg, isMe) }}
                    >
                      {!isMe && (
                        <div style={{ fontSize: '11px', color: colors.fairyGold, marginBottom: '3px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <span>{RANK_EMOJI[msg.investorRank] ?? '🪙'}</span>
                          <span style={{ fontWeight: 600 }}>{msg.displayName}</span>
                          {foreignLang && (
                            <span style={{ color: colors.textMuted, fontWeight: 400 }}>
                              · {LANG_LABEL[foreignLang] ?? foreignLang}
                            </span>
                          )}
                        </div>
                      )}
                      <div style={{
                        padding: '8px 12px',
                        background: isMe ? `${colors.fairyGold}22` : 'rgba(255,255,255,0.07)',
                        border: `1px solid ${isSelected ? colors.fairyGold + '80' : isMe ? colors.fairyGold + '40' : 'rgba(255,255,255,0.1)'}`,
                        borderRadius: isMe ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
                        color: colors.textPrimary, fontSize: '13px', lineHeight: 1.45,
                        wordBreak: 'break-word', transition: 'border-color 0.15s',
                      }}>
                        {/* Quoted reply */}
                        {msg.replyToText && (
                          <div style={{
                            borderLeft: `2px solid ${colors.fairyGold}70`,
                            paddingLeft: '8px', marginBottom: '6px',
                            color: colors.textMuted, fontSize: '11px', lineHeight: 1.4,
                          }}>
                            <span style={{ color: colors.fairyGold, fontWeight: 600 }}>{msg.replyToDisplayName}</span>
                            <div style={{ marginTop: '1px', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis', maxWidth: '200px' }}>
                              {msg.replyToText}
                            </div>
                          </div>
                        )}
                        {msg.text}
                        {/* Перевод */}
                        {isTranslating && (
                          <div style={{ marginTop: '6px', color: colors.textMuted, fontSize: '11px' }}>⏳ Перевожу...</div>
                        )}
                        {translation && (
                          <div style={{
                            marginTop: '6px', paddingTop: '6px',
                            borderTop: `1px solid rgba(255,255,255,0.1)`,
                            color: colors.textMuted, fontSize: '12px', fontStyle: 'italic',
                          }}>
                            🌐 {translation}
                          </div>
                        )}
                      </div>

                      {/* Action buttons — appear when selected */}
                      <AnimatePresence>
                        {isSelected && (
                          <motion.div
                            initial={{ opacity: 0, y: -4 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -4 }}
                            transition={{ duration: 0.12 }}
                            style={{
                              display: 'flex', gap: '6px', marginTop: '4px',
                              justifyContent: isMe ? 'flex-end' : 'flex-start',
                            }}
                            onClick={e => e.stopPropagation()}
                          >
                            {!isMe && (
                              <button
                                onClick={() => handleReply(msg)}
                                style={{
                                  padding: '4px 10px', fontSize: '11px', fontWeight: 600,
                                  background: `${colors.fairyGold}20`,
                                  border: `1px solid ${colors.fairyGold}50`,
                                  borderRadius: '8px', color: colors.fairyGold, cursor: 'pointer',
                                }}
                              >
                                ↩ {t.chat.replyTo}
                              </button>
                            )}
                            {needsTranslation && !translation && !isTranslating && (
                              <button
                                onClick={() => handleTranslate(msg)}
                                style={{
                                  padding: '4px 10px', fontSize: '11px', fontWeight: 600,
                                  background: 'rgba(255,255,255,0.08)',
                                  border: '1px solid rgba(255,255,255,0.2)',
                                  borderRadius: '8px', color: colors.textMuted, cursor: 'pointer',
                                }}
                              >
                                🌐 Перевести
                              </button>
                            )}
                            {isMe && (
                              <button
                                onClick={() => handleDelete(msg.id)}
                                style={{
                                  padding: '4px 10px', fontSize: '11px', fontWeight: 600,
                                  background: 'rgba(231,76,60,0.15)',
                                  border: '1px solid rgba(231,76,60,0.4)',
                                  borderRadius: '8px', color: '#e74c3c', cursor: 'pointer',
                                }}
                              >
                                🗑
                              </button>
                            )}
                          </motion.div>
                        )}
                      </AnimatePresence>

                      <div style={{ fontSize: '10px', color: colors.textMuted, marginTop: '2px', textAlign: isMe ? 'right' : 'left' }}>
                        {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Input area */}
              <div style={{
                padding: `${spacing.sm} ${spacing.md}`,
                paddingBottom: `calc(${spacing.md} + env(safe-area-inset-bottom))`,
                borderTop: `1px solid rgba(255,255,255,0.07)`, flexShrink: 0,
              }}>
                {/* Reply preview */}
                <AnimatePresence>
                  {replyTo && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      style={{
                        display: 'flex', alignItems: 'center', gap: '8px',
                        marginBottom: '6px', padding: '6px 10px',
                        background: `${colors.fairyGold}10`,
                        border: `1px solid ${colors.fairyGold}30`,
                        borderRadius: '10px',
                      }}
                    >
                      <div style={{ flex: 1, overflow: 'hidden' }}>
                        <div style={{ color: colors.fairyGold, fontSize: '10px', fontWeight: 600 }}>{replyTo.displayName}</div>
                        <div style={{ color: colors.textMuted, fontSize: '11px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {replyTo.text}
                        </div>
                      </div>
                      <button
                        onClick={() => setReplyTo(null)}
                        style={{ background: 'none', border: 'none', color: colors.textMuted, cursor: 'pointer', fontSize: '14px', padding: '2px 4px', flexShrink: 0 }}
                      >✕</button>
                    </motion.div>
                  )}
                </AnimatePresence>

                {error && (
                  <div style={{ color: '#ff6b6b', fontSize: '11px', marginBottom: '6px' }}>{error}</div>
                )}
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    ref={inputRef}
                    value={text}
                    onChange={e => { setText(e.target.value); setError(null) }}
                    onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() } }}
                    placeholder={t.chat.placeholder}
                    maxLength={300}
                    style={{
                      flex: 1, padding: '10px 14px',
                      background: 'rgba(255,255,255,0.07)',
                      border: '1px solid rgba(255,255,255,0.15)',
                      borderRadius: '12px', color: colors.textPrimary,
                      fontSize: '14px', outline: 'none',
                    }}
                  />
                  <button
                    onClick={handleSend}
                    disabled={sending || !text.trim()}
                    style={{
                      padding: '10px 16px',
                      background: text.trim() ? colors.fairyGold : 'rgba(255,255,255,0.1)',
                      border: 'none', borderRadius: '12px',
                      color: text.trim() ? colors.nightBlue : colors.textMuted,
                      fontSize: '13px', fontWeight: 700,
                      cursor: text.trim() ? 'pointer' : 'default',
                      transition: 'all 0.2s',
                    }}
                  >
                    {t.chat.send}
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  )
}
