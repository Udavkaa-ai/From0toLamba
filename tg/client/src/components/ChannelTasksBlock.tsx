import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { api, type ChannelTaskDTO } from '@/api/client'
import { useGameStore } from '@/stores/gameStore'
import { FairyCard } from './FairyCard'
import { colors, spacing } from '@/theme'

export function ChannelTasksBlock() {
  const queryClient = useQueryClient()
  const setGameState = useGameStore(s => s.setGameState)

  const { data: tasks = [] } = useQuery({
    queryKey: ['channelTasks'],
    queryFn: () => api.tasks.getChannels(),
    staleTime: 30_000,
  })

  if (tasks.length === 0) return null

  return (
    <div style={{ marginBottom: spacing.xl }}>
      <div style={{
        color: colors.fairyGold,
        fontWeight: 700,
        fontSize: '15px',
        marginBottom: spacing.sm,
        textAlign: 'center',
      }}>
        🎁 Награды за подписку
      </div>
      <div style={{ display: 'grid', gap: '8px' }}>
        {tasks.map(task => (
          <ChannelTaskRow
            key={task.id}
            task={task}
            onClaimed={async () => {
              queryClient.invalidateQueries({ queryKey: ['channelTasks'] })
              // Обновляем баланс
              const fresh = await api.game.getState()
              setGameState(fresh)
            }}
          />
        ))}
      </div>
    </div>
  )
}

function ChannelTaskRow({
  task,
  onClaimed,
}: {
  task: ChannelTaskDTO
  onClaimed: () => void
}) {
  const [state, setState] = useState<'idle' | 'loading' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState('')

  const openChannel = () => {
    if (typeof window !== 'undefined' && window.Telegram?.WebApp) {
      window.Telegram.WebApp.openTelegramLink(task.channelLink)
    } else {
      window.open(task.channelLink, '_blank')
    }
  }

  const claim = async () => {
    setState('loading')
    setErrorMsg('')
    try {
      await api.tasks.claimChannel(task.id)
      onClaimed()
    } catch (err: any) {
      const msg: string = err.message ?? 'Ошибка'
      if (msg.includes('Подпишись')) {
        setErrorMsg('Сначала подпишись на канал')
      } else if (msg.includes('уже получена')) {
        onClaimed()
      } else {
        setErrorMsg('Попробуй ещё раз')
      }
      setState('error')
    }
  }

  return (
    <FairyCard padding={spacing.md}>
      <div style={{ display: 'flex', alignItems: 'center', gap: spacing.md }}>
        {/* Иконка */}
        <div style={{
          fontSize: '28px',
          width: '40px',
          textAlign: 'center',
          flexShrink: 0,
        }}>
          {task.claimed ? '✅' : '📣'}
        </div>

        {/* Текст */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            color: task.claimed ? colors.textMuted : colors.textPrimary,
            fontWeight: 600,
            fontSize: '14px',
          }}>
            {task.channelTitle}
          </div>
          <div style={{ color: colors.textMuted, fontSize: '11px', marginTop: '2px' }}>
            {task.description}
          </div>
          {errorMsg && (
            <div style={{ color: '#f87171', fontSize: '11px', marginTop: '3px' }}>
              {errorMsg}
            </div>
          )}
        </div>

        {/* Правая часть */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '6px', flexShrink: 0 }}>
          <div style={{
            color: task.claimed ? colors.textMuted : colors.fairyGold,
            fontWeight: 700,
            fontSize: '14px',
            textDecoration: task.claimed ? 'line-through' : 'none',
          }}>
            +{task.rewardRubles} ₽
          </div>

          {task.claimed ? (
            <div style={{ color: colors.textMuted, fontSize: '11px' }}>Получено ✓</div>
          ) : (
            <div style={{ display: 'flex', gap: '6px' }}>
              <button
                onClick={openChannel}
                style={{
                  padding: '5px 10px',
                  background: 'rgba(255,255,255,0.08)',
                  border: `1px solid ${colors.cardBorder}`,
                  borderRadius: '8px',
                  color: colors.textSecondary,
                  fontSize: '11px',
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                }}
              >
                Подписаться
              </button>
              <button
                onClick={claim}
                disabled={state === 'loading'}
                style={{
                  padding: '5px 10px',
                  background: `${colors.fairyGold}22`,
                  border: `1px solid ${colors.fairyGold}66`,
                  borderRadius: '8px',
                  color: colors.fairyGold,
                  fontSize: '11px',
                  cursor: state === 'loading' ? 'default' : 'pointer',
                  opacity: state === 'loading' ? 0.6 : 1,
                  fontFamily: 'inherit',
                  fontWeight: 600,
                }}
              >
                {state === 'loading' ? '...' : 'Получить'}
              </button>
            </div>
          )}
        </div>
      </div>
    </FairyCard>
  )
}
