import { useState, useRef, useEffect, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import { ScreenBackground } from '@/components/ScreenBackground'
import { api } from '@/api/client'
import { useGameStore } from '@/stores/gameStore'
import { colors, spacing } from '@/theme'
import { CoinIcon } from '@/components/icons'

const tg = (window as any).Telegram?.WebApp
const haptic = tg?.HapticFeedback

// Разговорные шаблоны — для болтовни «по приколу», без допросной механики
const ALL_QUESTIONS = [
  'Расскажи о себе',
  'Откуда ты родом?',
  'Как докатился до этого дела?',
  'Самая дикая байка из жизни?',
  'Что самое страшное видел?',
  'Кто твой кумир?',
  'Любимое блюдо?',
  'Чего боишься больше всего?',
  'Если завтра разоришься — куда подашься?',
  'Был ли у тебя любимый человек?',
  'Веришь ли в чудеса?',
  'Что бы делал, если бы вдруг стал царём?',
  'Расскажи свою любимую сказку',
  'Что у тебя в карманах сейчас?',
  'Какая твоя главная слабость?',
  'Какую песню напеваешь, когда никто не слышит?',
]

function pickSessionQuestions(sessionId: string | undefined): string[] {
  // Детерминированно выбираем 8 вопросов на сессию
  const seed = sessionId ? sessionId.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0) : Date.now()
  const shuffled = [...ALL_QUESTIONS].sort((a, b) => {
    const ha = (seed * a.charCodeAt(0) * 2654435761) % ALL_QUESTIONS.length
    const hb = (seed * b.charCodeAt(0) * 2654435761) % ALL_QUESTIONS.length
    return ha - hb
  })
  return shuffled.slice(0, 8)
}

function personaBgUrl(archetype: string | undefined): string | null {
  if (!archetype) return null
  const slug = archetype.toLowerCase()
  return `/personas/${slug}.png`
}

export function AmaPage() {
  const { projectId } = useParams<{ projectId: string }>()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const { gameState, setGameState } = useGameStore()
  const [input, setInput] = useState('')
  const [showInvestSheet, setShowInvestSheet] = useState(false)
  const [onboardingBonus, setOnboardingBonus] = useState<number | null>(null)
  const [usedTemplates, setUsedTemplates] = useState<Set<string>>(new Set())
  const [amaPaymentPending, setAmaPaymentPending] = useState(false)
  const onboardingTriggeredRef = useRef(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const project = useMemo(() => {
    if (!projectId || !gameState) return null
    return (
      gameState.activeProjects.find(p => p.id === projectId) ??
      gameState.inboxProjects.find(p => p.id === projectId) ??
      null
    )
  }, [projectId, gameState])

  const bgUrl = personaBgUrl(project?.personaArchetype)
  const tgWebApp = (window as any).Telegram?.WebApp

  // Инициализируем/получаем сессию
  // Если онбординг не завершён — первая беседа бесплатная (онбординг-проект).
  // После онбординга — беседа платная (10 Stars), сессия не создаётся до оплаты.
  const { data: session, isLoading, refetch: refetchSession } = useQuery({
    queryKey: ['ama', projectId],
    queryFn: async () => {
      try {
        return await api.ama.getSession(projectId!)
      } catch {
        if (!gameState?.isOnboardingComplete) {
          // Онбординг: создаём бесплатно
          await api.ama.start(projectId!)
          return api.ama.getSession(projectId!)
        }
        // Платная беседа — сессия ещё не создана, покажем гейт оплаты
        return null
      }
    },
    enabled: !!projectId,
    staleTime: 0,
  })

  const handleAmaPayment = async () => {
    if (!projectId) return
    setAmaPaymentPending(true)
    try {
      const merchantName = project?.developerName ?? 'дельцом'
      const resp = await api.payments.createInvoice('ama_unlock', projectId, merchantName) as any
      if (!resp.invoiceLink) {
        // PAYMENTS_ENABLED=false — сессия уже активирована на сервере
        await refetchSession()
        setAmaPaymentPending(false)
        return
      }
      if (!tgWebApp?.openInvoice) {
        setAmaPaymentPending(false)
        return
      }
      tgWebApp.openInvoice(resp.invoiceLink, async (status: string) => {
        if (status === 'paid') {
          try {
            await api.payments.activateAmaUnlock(projectId)
            await refetchSession()
          } catch { /* ignore */ }
        }
        setAmaPaymentPending(false)
      })
    } catch {
      setAmaPaymentPending(false)
    }
  }

  const sessionQuestions = useMemo(
    () => pickSessionQuestions(session?.sessionId),
    [session?.sessionId],
  )

  const sendMutation = useMutation({
    mutationFn: (message: string) => api.ama.sendMessage(projectId!, message),
    onMutate: (message: string) => {
      qc.setQueryData(['ama', projectId], (old: any) => {
        if (!old) return old
        return {
          ...old,
          messages: [...old.messages, { role: 'user', content: message, createdAt: new Date().toISOString() }],
        }
      })
    },
    onSuccess: (data) => {
      qc.setQueryData(['ama', projectId], (old: any) => {
        if (!old) return old
        return {
          ...old,
          questionCount: data.questionCount,
          isComplete: data.isSessionComplete,
          messages: [
            ...old.messages,
            { role: 'assistant', content: data.reply, createdAt: new Date().toISOString() },
          ],
        }
      })
    },
    onError: () => {
      qc.invalidateQueries({ queryKey: ['ama', projectId] })
    },
  })

  // Онбординг-бонус: выдаём 50 г когда первая беседа завершена
  useEffect(() => {
    if (
      session?.isComplete &&
      gameState?.isOnboardingComplete === false &&
      !onboardingTriggeredRef.current
    ) {
      onboardingTriggeredRef.current = true
      api.game.completeOnboarding().then((res: any) => {
        if (res.bonusAwarded) {
          setOnboardingBonus(res.bonusAwarded)
          if (gameState) {
            setGameState({
              ...gameState,
              balance: gameState.balance + res.bonusAwarded,
              isOnboardingComplete: true,
            })
          }
        }
      }).catch(() => {})
    }
  }, [session?.isComplete, gameState?.isOnboardingComplete])

  const handleSend = (text?: string) => {
    const msg = text ?? input.trim()
    if (!msg || sendMutation.isPending || session?.isComplete) return
    haptic?.impactOccurred('light')
    if (text) setUsedTemplates(prev => new Set([...prev, text]))
    else setInput('')
    sendMutation.mutate(msg)
  }

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [session?.messages.length])

  if (isLoading) {
    return (
      <ScreenBackground>
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100dvh', color: colors.fairyGold, fontSize: '24px' }}>
          Открываем беседу...
        </div>
      </ScreenBackground>
    )
  }

  // Сессии нет — показываем гейт оплаты
  if (!session) {
    return (
      <ScreenBackground showSparkles={false}>
        <div style={{ display: 'flex', flexDirection: 'column', height: '100dvh' }}>
          <div style={{
            padding: `${spacing.md} ${spacing.lg}`,
            background: 'rgba(10, 8, 24, 0.95)',
            borderBottom: `1px solid ${colors.cardBorder}`,
            display: 'flex', alignItems: 'center', gap: '8px',
          }}>
            <button
              onClick={() => navigate(-1)}
              style={{
                background: `${colors.fairyGold}15`,
                border: `1px solid ${colors.fairyGold}40`,
                borderRadius: '10px',
                color: colors.fairyGold, cursor: 'pointer',
                padding: '6px 12px', fontSize: '13px', fontWeight: 600,
              }}
            >← Назад</button>
            <div style={{ color: colors.textPrimary, fontSize: '14px', fontWeight: 600 }}>
              {project?.developerName ?? 'Делец'}
            </div>
          </div>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: `${spacing.xxl} ${spacing.lg}`, gap: spacing.lg, textAlign: 'center' }}>
            <div style={{ fontSize: '56px' }}>⭐</div>
            <div style={{ color: colors.fairyGold, fontSize: '20px', fontWeight: 700 }}>
              Личная беседа с {project?.developerName ?? 'дельцом'}
            </div>
            <div style={{ color: colors.textSecondary, fontSize: '13px', lineHeight: 1.6, maxWidth: '320px' }}>
              Задай до 10 вопросов хозяину дела лично. Разведай правду, прояви чуйку и реши — вкладываться или нет.
            </div>
            <div style={{
              background: `${colors.fairyGold}12`,
              border: `1px solid ${colors.fairyGold}35`,
              borderRadius: '14px',
              padding: `${spacing.md} ${spacing.lg}`,
              color: colors.textMuted,
              fontSize: '12px',
              lineHeight: 1.5,
            }}>
              Стоимость беседы: <strong style={{ color: colors.fairyGold }}>10 Telegram Stars</strong>
            </div>
            <button
              onClick={handleAmaPayment}
              disabled={amaPaymentPending}
              style={{
                width: '100%', maxWidth: '320px',
                padding: `${spacing.md} ${spacing.lg}`,
                background: `linear-gradient(135deg, #FFB800, #FF8C00)`,
                border: 'none', borderRadius: '14px',
                color: '#1a0a00', fontWeight: 700, fontSize: '16px',
                cursor: amaPaymentPending ? 'not-allowed' : 'pointer',
                opacity: amaPaymentPending ? 0.6 : 1,
              }}
            >
              {amaPaymentPending ? 'Открываем оплату…' : '⭐ Начать беседу · 10 звёзд'}
            </button>
          </div>
        </div>
      </ScreenBackground>
    )
  }

  const questionsLeft = 10 - session.questionCount
  return (
    <ScreenBackground showSparkles={false}>
      {/* Персонажный фон под слоем UI */}
      {bgUrl && (
        <div
          aria-hidden
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 0,
            backgroundImage: `url(${bgUrl})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            backgroundRepeat: 'no-repeat',
            // Затемняем, чтобы текст читался поверх
            filter: 'brightness(0.45) saturate(0.85)',
          }}
        />
      )}
      {/* Виньетка-градиент: верх и низ темнее, центр чуть светлее */}
      {bgUrl && (
        <div
          aria-hidden
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 0,
            background: 'linear-gradient(180deg, rgba(10,8,24,0.85) 0%, rgba(10,8,24,0.4) 30%, rgba(10,8,24,0.4) 70%, rgba(10,8,24,0.95) 100%)',
            pointerEvents: 'none',
          }}
        />
      )}

      <div style={{ display: 'flex', flexDirection: 'column', height: '100dvh', position: 'relative', zIndex: 1 }}>

        {/* Шапка */}
        <div style={{
          padding: `${spacing.md} ${spacing.lg}`,
          background: 'rgba(10, 8, 24, 0.85)',
          borderBottom: `1px solid ${colors.cardBorder}`,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          backdropFilter: 'blur(8px)',
        }}>
          <button
            onClick={() => navigate(-1)}
            style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              background: `${colors.fairyGold}15`,
              border: `1px solid ${colors.fairyGold}40`,
              borderRadius: '10px',
              color: colors.fairyGold, cursor: 'pointer',
              fontSize: '13px', fontWeight: 600,
              padding: '8px 12px',
            }}
          >
            <span style={{ fontSize: '16px', lineHeight: 1 }}>←</span>
            Назад
          </button>
          <div style={{ textAlign: 'center', flex: 1, minWidth: 0 }}>
            <div style={{
              color: colors.fairyGold, fontWeight: 600, fontSize: '14px',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {session.developerName ?? project?.developerName ?? 'Беседа с Дельцом'}
            </div>
            <div style={{ color: colors.textMuted, fontSize: '11px' }}>
              {session.isComplete ? 'Беседа завершена' : `Вопрос ${session.questionCount}/10`}
            </div>
          </div>
          <div style={{ width: '64px' }} />
        </div>

        {/* Сообщения */}
        <div style={{ flex: 1, overflow: 'auto', padding: `${spacing.md} ${spacing.lg}` }}>
          {session.messages.map((msg, i) => {
            const isLastAssistant = msg.role === 'assistant' && i === session.messages.length - 1
            return (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                style={{
                  display: 'flex',
                  justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
                  marginBottom: spacing.md,
                }}
              >
                <div style={{
                  maxWidth: '80%',
                  padding: `${spacing.sm} ${spacing.md}`,
                  borderRadius: msg.role === 'user' ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                  background: msg.role === 'user'
                    ? `${colors.enchantedPurple}dd`
                    : 'rgba(20, 12, 48, 0.85)',
                  border: `1px solid ${msg.role === 'user' ? colors.fairyGold + '30' : colors.cardBorder}`,
                  color: colors.textPrimary,
                  fontSize: '14px',
                  lineHeight: 1.5,
                  backdropFilter: 'blur(6px)',
                }}>
                  <TypewriterText text={msg.content} animate={isLastAssistant} />
                </div>
              </motion.div>
            )
          })}

          {sendMutation.isPending && (
            <div style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: spacing.md }}>
              <div style={{
                padding: `${spacing.sm} ${spacing.md}`,
                borderRadius: '16px 16px 16px 4px',
                background: 'rgba(20, 12, 48, 0.85)',
                border: `1px solid ${colors.cardBorder}`,
                color: colors.textMuted,
                fontSize: '14px',
                backdropFilter: 'blur(6px)',
              }}>
                Делец думает...
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Онбординг-бонус */}
        {onboardingBonus && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            style={{
              margin: `${spacing.sm} ${spacing.lg}`,
              padding: spacing.md,
              background: `${colors.fairyGold}20`,
              border: `1px solid ${colors.fairyGold}`,
              borderRadius: '12px',
              textAlign: 'center',
            }}
          >
            <div style={{ color: colors.fairyGold, fontWeight: 700, fontSize: '16px' }}>
              🎉 +{onboardingBonus} г на счёт!
            </div>
            <div style={{ color: colors.textMuted, fontSize: '12px', marginTop: '4px' }}>
              Онбординг-бонус за первую беседу
            </div>
          </motion.div>
        )}

        {/* Кнопка вложения после завершения беседы */}
        {session.isComplete && (
          <div style={{
            padding: `${spacing.md} ${spacing.lg}`,
            background: 'rgba(10, 8, 24, 0.9)',
            borderTop: `1px solid ${colors.cardBorder}`,
            backdropFilter: 'blur(8px)',
          }}>
            <button
              onClick={() => setShowInvestSheet(true)}
              style={{
                width: '100%',
                padding: spacing.md,
                background: colors.enchantedPurple,
                border: `1px solid ${colors.fairyGold}`,
                borderRadius: '12px',
                color: colors.fairyGold,
                fontWeight: 700,
                cursor: 'pointer',
                fontSize: '14px',
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
              }}
            >
              <CoinIcon size={16} /> Вложить гроши
            </button>
          </div>
        )}

        {/* Шаблоны вопросов + поле ввода */}
        {!session.isComplete && (
          <div style={{
            background: 'rgba(10, 8, 24, 0.9)',
            borderTop: `1px solid ${colors.cardBorder}`,
            backdropFilter: 'blur(8px)',
          }}>
            {/* Шаблоны */}
            {!sendMutation.isPending && (
              <div style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: '4px',
                padding: `${spacing.sm} ${spacing.lg} 0`,
                maxHeight: '72px',
                overflowY: 'auto',
                scrollbarWidth: 'none' as const,
              }}>
                {sessionQuestions.filter(q => !usedTemplates.has(q)).map((q, i) => (
                  <motion.button
                    key={i}
                    whileTap={{ scale: 0.92 }}
                    transition={{ duration: 0.1 }}
                    onClick={() => handleSend(q)}
                    style={{
                      flexBasis: 'calc(50% - 2px)',
                      flexGrow: 0,
                      flexShrink: 0,
                      background: 'transparent',
                      border: `1px solid ${colors.fairyGold}50`,
                      borderRadius: '14px',
                      padding: '4px 8px',
                      color: `${colors.fairyGold}cc`,
                      fontSize: '10px',
                      cursor: 'pointer',
                      whiteSpace: 'nowrap' as const,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      textAlign: 'left' as const,
                      boxSizing: 'border-box' as const,
                    }}
                  >
                    {q.length > 34 ? q.slice(0, 34) + '…' : q}
                  </motion.button>
                ))}
              </div>
            )}

            {/* Поле ввода */}
            <div style={{
              padding: `${spacing.sm} ${spacing.lg}`,
              display: 'flex',
              gap: spacing.sm,
              alignItems: 'center',
            }}>
              <button
                onClick={() => setShowInvestSheet(true)}
                title="Вложить гроши"
                style={{
                  flexShrink: 0,
                  padding: `${spacing.sm} 10px`,
                  background: `${colors.enchantedPurple}80`,
                  border: `1px solid ${colors.fairyGold}50`,
                  borderRadius: '12px',
                  color: colors.fairyGold,
                  cursor: 'pointer',
                  fontSize: '16px',
                  lineHeight: 1,
                }}
              >
                💰
              </button>
              <input
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSend()}
                placeholder="Спроси о чём угодно..."
                maxLength={500}
                style={{
                  flex: 1,
                  background: 'rgba(42, 25, 96, 0.6)',
                  border: `1px solid ${colors.cardBorder}`,
                  borderRadius: '12px',
                  padding: `${spacing.sm} ${spacing.md}`,
                  color: colors.textPrimary,
                  fontSize: '14px',
                  outline: 'none',
                }}
              />
              <motion.button
                whileTap={{ scale: 0.88 }}
                transition={{ duration: 0.1 }}
                onClick={() => handleSend()}
                disabled={!input.trim() || sendMutation.isPending}
                style={{
                  padding: `${spacing.sm} ${spacing.md}`,
                  background: colors.fairyGold,
                  border: 'none',
                  borderRadius: '12px',
                  color: colors.nightBlue,
                  fontWeight: 700,
                  cursor: 'pointer',
                  fontSize: '16px',
                  opacity: !input.trim() || sendMutation.isPending ? 0.5 : 1,
                }}
              >
                →
              </motion.button>
            </div>
          </div>
        )}
      </div>

      {/* Лист вложения */}
      <AnimatePresence>
        {showInvestSheet && projectId && (
          <InvestSheet projectId={projectId} onClose={() => setShowInvestSheet(false)} onSuccess={() => navigate('/portfolio')} />
        )}
      </AnimatePresence>
    </ScreenBackground>
  )
}

function InvestSheet({ projectId, onClose, onSuccess }: { projectId: string; onClose: () => void; onSuccess: () => void }) {
  const [amount, setAmount] = useState('')
  const qc = useQueryClient()
  const { gameState, updateBalance } = useGameStore()

  const investMutation = useMutation({
    mutationFn: () => api.invest.invest(projectId, Number(amount)),
    onSuccess: () => {
      haptic?.notificationOccurred('success')
      updateBalance(-Number(amount))
      qc.invalidateQueries({ queryKey: ['gameState'] })
      onSuccess()
    },
    onError: () => haptic?.notificationOccurred('error'),
  })

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 200,
        display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
        background: 'rgba(0,0,0,0.7)',
      }}
    >
      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: '500px',
          background: colors.nightBlue,
          borderRadius: '20px 20px 0 0',
          border: `1px solid ${colors.cardBorder}`,
          padding: spacing.xxl,
        }}
      >
        <div style={{ color: colors.fairyGold, fontWeight: 700, fontSize: '18px', marginBottom: spacing.sm, display: 'flex', alignItems: 'center', gap: '8px' }}>
          <CoinIcon size={20} /> Вложить гроши
        </div>
        <div style={{ color: colors.textMuted, fontSize: '12px', marginBottom: spacing.sm }}>
          Баланс: {gameState?.balance.toFixed(0) ?? '—'} г · Мин. 5 г · Макс. 5 000 г
        </div>
        <input
          type="number"
          value={amount}
          onChange={e => setAmount(e.target.value)}
          placeholder="Сумма в грошах"
          style={{
            width: '100%', boxSizing: 'border-box',
            background: 'rgba(42, 25, 96, 0.4)',
            border: `1px solid ${colors.cardBorder}`,
            borderRadius: '12px',
            padding: `${spacing.md}`,
            color: colors.textPrimary,
            fontSize: '18px',
            outline: 'none',
            marginBottom: spacing.lg,
          }}
        />
        {investMutation.isError && (
          <div style={{ color: colors.danger, fontSize: '12px', marginBottom: spacing.sm }}>
            {(investMutation.error as Error).message}
          </div>
        )}
        <button
          onClick={() => investMutation.mutate()}
          disabled={!amount || investMutation.isPending}
          style={{
            width: '100%', padding: spacing.md,
            background: colors.enchantedPurple,
            border: `1px solid ${colors.fairyGold}`,
            borderRadius: '12px', color: colors.fairyGold,
            fontWeight: 700, cursor: 'pointer', fontSize: '15px',
            opacity: !amount || investMutation.isPending ? 0.6 : 1,
          }}
        >
          {investMutation.isPending ? '⏳' : 'Вложить'}
        </button>
      </motion.div>
    </motion.div>
  )
}

function TypewriterText({ text, animate }: { text: string; animate: boolean }) {
  const [shown, setShown] = useState(animate ? '' : text)
  useEffect(() => {
    if (!animate) { setShown(text); return }
    setShown('')
    let i = 0
    const id = setInterval(() => {
      i++
      setShown(text.slice(0, i))
      if (i >= text.length) clearInterval(id)
    }, 22)
    return () => clearInterval(id)
  }, [text, animate])
  return <>{shown}</>
}
