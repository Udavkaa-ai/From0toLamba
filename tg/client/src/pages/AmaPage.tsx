import { useState, useRef, useEffect, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import { ScreenBackground } from '@/components/ScreenBackground'
import { api } from '@/api/client'
import { useGameStore } from '@/stores/gameStore'
import { colors, spacing } from '@/theme'

const LIE_TOPICS = [
  { id: 'PATRON_COUNT', emoji: '👥', label: 'Вкладчики', hint: 'Врёт о числе вкладчиков' },
  { id: 'DAILY_PROFIT', emoji: '💰', label: 'Доход', hint: 'Завышает дневной доход' },
  { id: 'PAYOUT_DATE', emoji: '📅', label: 'Выплаты', hint: 'Называет ложные сроки выплат' },
  { id: 'GUILD_SIZE', emoji: '🏗️', label: 'Артель', hint: 'Приукрашивает размер команды' },
  { id: 'ELDER_BLESSING', emoji: '📜', label: 'Проверка', hint: 'Выдуманная проверка старейшин' },
  { id: 'NOBLE_BACKING', emoji: '🏰', label: 'Покровители', hint: 'Несуществующие покровители' },
  { id: 'WITHDRAWAL_LIMITS', emoji: '🔒', label: 'Вывод', hint: 'Скрывает ограничения на вывод' },
]

const ALL_QUESTIONS = [
  // Доходность
  'Сколько реально зарабатывают участники в день?',
  'Назови конкретную цифру — сколько рублей в день на сотню вложенных?',
  'Откуда берётся такая высокая доходность?',
  'Почему у вас выгоднее, чем у конкурентов?',
  'Есть ли участник, готовый подтвердить свой доход?',
  // Вкладчики
  'Сколько сейчас вкладчиков в деле?',
  'Как давно самый первый вкладчик с тобой работает?',
  'Сколько человек вышло из дела за последний месяц и почему?',
  // Выплаты
  'Когда точно будут первые выплаты?',
  'Как выглядит процесс вывода рублей — шаги, сроки?',
  'Были ли когда-нибудь задержки выплат? По какой причине?',
  'Можно вывести рубли прямо сейчас, не дожидаясь срока?',
  // Команда
  'Кто в артели? Можно проверить их имена?',
  'Сколько человек работает над делом?',
  // Проверки и документы
  'Дело проверено старейшинами или воеводой?',
  'Есть ли официальный документ или грамота о деле?',
  'Покажи книгу учёта доходов и расходов',
  // Вывод и ограничения
  'Есть ли ограничения на вывод рублей?',
  'Что случится, если я захочу выйти из дела раньше срока?',
  // Покровители
  'Кто ваши покровители и партнёры?',
  'Есть ли у дела поддержка от торговой гильдии или государства?',
  // Риски
  'Что будет, если дело не пойдёт?',
  'Были ли у тебя дела, которые провалились? Расскажи.',
  'Почему я должен тебе доверять?',
]

function pickSessionQuestions(sessionId: string | undefined): string[] {
  // Детерминированно выбираем 10 вопросов на сессию
  const seed = sessionId ? sessionId.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0) : Date.now()
  const shuffled = [...ALL_QUESTIONS].sort((a, b) => {
    const ha = (seed * a.charCodeAt(0) * 2654435761) % ALL_QUESTIONS.length
    const hb = (seed * b.charCodeAt(0) * 2654435761) % ALL_QUESTIONS.length
    return ha - hb
  })
  return shuffled.slice(0, 10)
}

export function AmaPage() {
  const { projectId } = useParams<{ projectId: string }>()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const { gameState, setGameState } = useGameStore()
  const [input, setInput] = useState('')
  const [selectedTopics, setSelectedTopics] = useState<Set<string>>(new Set())
  const [showInvestSheet, setShowInvestSheet] = useState(false)
  const [showIntuitionResult, setShowIntuitionResult] = useState<any>(null)
  const [showLegend, setShowLegend] = useState(false)
  const [onboardingBonus, setOnboardingBonus] = useState<number | null>(null)
  const [usedTemplates, setUsedTemplates] = useState<Set<string>>(new Set())
  const onboardingTriggeredRef = useRef(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Инициализируем/получаем сессию
  const { data: session, isLoading } = useQuery({
    queryKey: ['ama', projectId],
    queryFn: async () => {
      try {
        return await api.ama.getSession(projectId!)
      } catch {
        await api.ama.start(projectId!)
        return api.ama.getSession(projectId!)
      }
    },
    enabled: !!projectId,
    staleTime: 0,
  })

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

  const intuitionMutation = useMutation({
    mutationFn: () => api.ama.evaluateIntuition(projectId!, [...selectedTopics]),
    onSuccess: (data) => {
      setShowIntuitionResult(data)
      qc.invalidateQueries({ queryKey: ['ama', projectId] })
    },
  })

  // Онбординг-бонус: выдаём 50 ₽ когда первая беседа завершена
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
          // Сразу обновляем Zustand — не ждём рефетч страницы
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
    if (text) setUsedTemplates(prev => new Set([...prev, text]))
    else setInput('')
    sendMutation.mutate(msg)
  }

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [session?.messages.length])

  if (isLoading || !session) {
    return (
      <ScreenBackground>
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100dvh', color: colors.fairyGold, fontSize: '24px' }}>
          Открываем беседу...
        </div>
      </ScreenBackground>
    )
  }

  const questionsLeft = 10 - session.questionCount

  return (
    <ScreenBackground showSparkles={false}>
      <div style={{ display: 'flex', flexDirection: 'column', height: '100dvh' }}>

        {/* Шапка */}
        <div style={{
          padding: `${spacing.md} ${spacing.lg}`,
          background: 'rgba(10, 8, 24, 0.95)',
          borderBottom: `1px solid ${colors.cardBorder}`,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <button
            onClick={() => navigate(-1)}
            style={{ background: 'none', border: 'none', color: colors.textMuted, cursor: 'pointer', fontSize: '20px' }}
          >
            ←
          </button>
          <div style={{ textAlign: 'center' }}>
            <div style={{ color: colors.fairyGold, fontWeight: 600, fontSize: '14px' }}>Беседа с хозяином</div>
            <div style={{ color: colors.textMuted, fontSize: '11px' }}>
              {session.isComplete ? 'Беседа завершена' : `Вопрос ${session.questionCount}/10`}
            </div>
          </div>
          <div style={{ width: '36px' }} />
        </div>

        {/* Полоска Чуйки */}
        <div style={{
          padding: `${spacing.sm} ${spacing.lg}`,
          background: 'rgba(6, 4, 18, 0.8)',
          borderBottom: `1px solid ${colors.cardBorder}`,
        }}>
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{ color: colors.textMuted, fontSize: '11px' }}>👁 Чуйка:</span>
            {LIE_TOPICS.map(t => {
              const selected = selectedTopics.has(t.id)
              return (
                <button
                  key={t.id}
                  onClick={() => {
                    if (session.isIntuitionEvaluated) return
                    setSelectedTopics(prev => {
                      const next = new Set(prev)
                      if (next.has(t.id)) next.delete(t.id)
                      else next.add(t.id)
                      return next
                    })
                  }}
                  style={{
                    background: selected ? `${colors.fairyGold}30` : 'transparent',
                    border: `1px solid ${selected ? colors.fairyGold : colors.cardBorder}`,
                    borderRadius: '20px',
                    padding: '2px 8px',
                    color: selected ? colors.fairyGold : colors.textMuted,
                    cursor: session.isIntuitionEvaluated ? 'default' : 'pointer',
                    fontSize: '11px',
                  }}
                >
                  {t.emoji}
                </button>
              )
            })}
            <button
              onClick={() => setShowLegend(true)}
              style={{
                background: 'none',
                border: 'none',
                color: colors.textMuted,
                cursor: 'pointer',
                fontSize: '13px',
                padding: '0 2px',
                lineHeight: 1,
              }}
              title="Что такое Чуйка?"
            >
              ?
            </button>
          </div>
        </div>

        {/* Сообщения */}
        <div style={{ flex: 1, overflow: 'auto', padding: `${spacing.md} ${spacing.lg}` }}>
          {session.messages.map((msg, i) => (
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
                  ? `${colors.enchantedPurple}cc`
                  : `rgba(42, 25, 96, 0.5)`,
                border: `1px solid ${msg.role === 'user' ? colors.fairyGold + '30' : colors.cardBorder}`,
                color: colors.textPrimary,
                fontSize: '14px',
                lineHeight: 1.5,
              }}>
                {msg.content}
              </div>
            </motion.div>
          ))}

          {sendMutation.isPending && (
            <div style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: spacing.md }}>
              <div style={{
                padding: `${spacing.sm} ${spacing.md}`,
                borderRadius: '16px 16px 16px 4px',
                background: `rgba(42, 25, 96, 0.5)`,
                border: `1px solid ${colors.cardBorder}`,
                color: colors.textMuted,
                fontSize: '14px',
              }}>
                Хозяин думает...
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
              🎉 +{onboardingBonus} ₽ на счёт!
            </div>
            <div style={{ color: colors.textMuted, fontSize: '12px', marginTop: '4px' }}>
              Онбординг-бонус за первую беседу
            </div>
          </motion.div>
        )}

        {/* Кнопки действий после завершения */}
        {session.isComplete && (
          <div style={{ padding: `${spacing.md} ${spacing.lg}`, background: 'rgba(10, 8, 24, 0.95)', borderTop: `1px solid ${colors.cardBorder}` }}>
            {!session.isIntuitionEvaluated && (
              <button
                onClick={() => intuitionMutation.mutate()}
                disabled={intuitionMutation.isPending}
                style={{
                  width: '100%',
                  padding: spacing.md,
                  background: `${colors.fairyGold}20`,
                  border: `1px solid ${colors.fairyGold}`,
                  borderRadius: '12px',
                  color: colors.fairyGold,
                  fontWeight: 600,
                  cursor: 'pointer',
                  marginBottom: spacing.sm,
                  fontSize: '14px',
                }}
              >
                👁 Оценить чуйку
              </button>
            )}
            <button
              onClick={() => setShowInvestSheet(true)}
              style={{
                width: '100%',
                padding: spacing.md,
                background: `${colors.enchantedPurple}`,
                border: `1px solid ${colors.fairyGold}40`,
                borderRadius: '12px',
                color: colors.fairyGold,
                fontWeight: 600,
                cursor: 'pointer',
                fontSize: '14px',
              }}
            >
              💰 Вложить рубли
            </button>
          </div>
        )}

        {/* Шаблоны вопросов + поле ввода */}
        {!session.isComplete && (
          <div style={{
            background: 'rgba(10, 8, 24, 0.95)',
            borderTop: `1px solid ${colors.cardBorder}`,
          }}>
            {/* Шаблоны */}
            {!sendMutation.isPending && (
              <div style={{
                overflowX: 'auto',
                padding: `${spacing.sm} ${spacing.lg} 0`,
                display: 'flex',
                gap: '6px',
                scrollbarWidth: 'none',
              }}>
                {sessionQuestions.filter(q => !usedTemplates.has(q)).map((q, i) => (
                  <button
                    key={i}
                    onClick={() => handleSend(q)}
                    style={{
                      flexShrink: 0,
                      background: 'transparent',
                      border: `1px solid ${colors.fairyGold}50`,
                      borderRadius: '14px',
                      padding: '4px 10px',
                      color: `${colors.fairyGold}cc`,
                      fontSize: '11px',
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                      maxWidth: '200px',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {q.length > 40 ? q.slice(0, 40) + '…' : q}
                  </button>
                ))}
              </div>
            )}

            {/* Поле ввода */}
            <div style={{
              padding: `${spacing.sm} ${spacing.lg}`,
              display: 'flex',
              gap: spacing.sm,
            }}>
              <input
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSend()}
                placeholder="Задай вопрос хозяину..."
                maxLength={500}
                style={{
                  flex: 1,
                  background: 'rgba(42, 25, 96, 0.4)',
                  border: `1px solid ${colors.cardBorder}`,
                  borderRadius: '12px',
                  padding: `${spacing.sm} ${spacing.md}`,
                  color: colors.textPrimary,
                  fontSize: '14px',
                  outline: 'none',
                }}
              />
              <button
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
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Легенда Чуйки */}
      <AnimatePresence>
        {showLegend && (
          <IntuitionLegendModal onClose={() => setShowLegend(false)} />
        )}
      </AnimatePresence>

      {/* Результат оценки чуйки */}
      <AnimatePresence>
        {showIntuitionResult && (
          <IntuitionResultSheet result={showIntuitionResult} onClose={() => setShowIntuitionResult(null)} />
        )}
      </AnimatePresence>

      {/* Лист вложения */}
      <AnimatePresence>
        {showInvestSheet && projectId && (
          <InvestSheet projectId={projectId} onClose={() => setShowInvestSheet(false)} onSuccess={() => navigate('/portfolio')} />
        )}
      </AnimatePresence>
    </ScreenBackground>
  )
}

function IntuitionLegendModal({ onClose }: { onClose: () => void }) {
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
        <div style={{ color: colors.fairyGold, fontWeight: 700, fontSize: '18px', marginBottom: spacing.md }}>
          👁 Чуйка — как работает
        </div>
        <div style={{ color: colors.textMuted, fontSize: '13px', marginBottom: spacing.lg }}>
          Отмечай темы, в которых подозреваешь ложь. После беседы нажми «Оценить чуйку».
        </div>
        {LIE_TOPICS.map(t => (
          <div key={t.id} style={{ display: 'flex', gap: spacing.sm, marginBottom: spacing.md, alignItems: 'flex-start' }}>
            <span style={{ fontSize: '16px' }}>{t.emoji}</span>
            <div>
              <div style={{ color: colors.textPrimary, fontWeight: 600, fontSize: '13px' }}>{t.label}</div>
              <div style={{ color: colors.textMuted, fontSize: '12px' }}>{t.hint}</div>
            </div>
          </div>
        ))}
        <div style={{ color: `${colors.fairyGold}cc`, fontSize: '12px', marginTop: spacing.sm }}>
          ✓ Угадал — +1 очко чуйки &nbsp;&nbsp; ✗ Обвинил напрасно — −1 очко
        </div>
        <button
          onClick={onClose}
          style={{
            width: '100%', marginTop: spacing.lg,
            padding: spacing.md, background: `${colors.fairyGold}20`,
            border: `1px solid ${colors.fairyGold}`, borderRadius: '12px',
            color: colors.fairyGold, fontWeight: 600, cursor: 'pointer', fontSize: '14px',
          }}
        >
          Понятно
        </button>
      </motion.div>
    </motion.div>
  )
}

function IntuitionResultSheet({ result, onClose }: { result: any; onClose: () => void }) {
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
        <div style={{ textAlign: 'center', marginBottom: spacing.lg }}>
          <div style={{ fontSize: '48px' }}>{result.delta > 0 ? '🎯' : result.delta === 0 ? '🤔' : '😅'}</div>
          <div style={{ color: colors.fairyGold, fontSize: '20px', fontWeight: 700, marginTop: spacing.sm }}>
            {result.delta > 0 ? `+${result.delta} к чуйке!` : result.delta === 0 ? 'Не угадал' : `${result.delta} к чуйке`}
          </div>
        </div>
        {result.correctTopics.length > 0 && (
          <div style={{ color: colors.success, fontSize: '13px', marginBottom: spacing.sm }}>
            Верно угадал: {result.correctTopics.join(', ')}
          </div>
        )}
        {result.falseTopics.length > 0 && (
          <div style={{ color: colors.danger, fontSize: '13px' }}>
            Ошибся: {result.falseTopics.join(', ')}
          </div>
        )}
        <button
          onClick={onClose}
          style={{
            width: '100%', marginTop: spacing.xl,
            padding: spacing.md, background: `${colors.fairyGold}20`,
            border: `1px solid ${colors.fairyGold}`, borderRadius: '12px',
            color: colors.fairyGold, fontWeight: 600, cursor: 'pointer', fontSize: '14px',
          }}
        >
          Продолжить
        </button>
      </motion.div>
    </motion.div>
  )
}

function InvestSheet({ projectId, onClose, onSuccess }: { projectId: string; onClose: () => void; onSuccess: () => void }) {
  const [amount, setAmount] = useState('')
  const qc = useQueryClient()
  const { gameState, setGameState } = useGameStore()

  const investMutation = useMutation({
    mutationFn: () => api.invest.invest(projectId, Number(amount)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['gameState'] })
      onSuccess()
    },
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
        <div style={{ color: colors.fairyGold, fontWeight: 700, fontSize: '18px', marginBottom: spacing.sm }}>
          💰 Вложить рубли
        </div>
        <div style={{ color: colors.textMuted, fontSize: '12px', marginBottom: spacing.sm }}>
          Баланс: {gameState?.balance.toFixed(0) ?? '—'} ₽ · Мин. 5 ₽ · Макс. 5 000 ₽
        </div>
        <input
          type="number"
          value={amount}
          onChange={e => setAmount(e.target.value)}
          placeholder="Сумма в рублях"
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
