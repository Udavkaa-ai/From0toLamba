import { motion } from 'framer-motion'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { api, type ChannelTaskDTO } from '@/api/client'
import { useGameStore } from '@/stores/gameStore'
import { colors, spacing , gradients } from '@/theme'

// Ключ включает Telegram user ID чтобы разные аккаунты на одном устройстве
// не мешали друг другу (общий localStorage, но разные юзеры).
function lsKey(): string {
  const uid = (window as any).Telegram?.WebApp?.initDataUnsafe?.user?.id
  return uid ? `channel_promo_date_${uid}` : 'channel_promo_date'
}

function todayKey() {
  return new Date().toISOString().slice(0, 10)
}

export function shouldShowChannelPromo(): boolean {
  if (typeof window === 'undefined') return false
  return localStorage.getItem(lsKey()) !== todayKey()
}

export function markChannelPromoSeen() {
  localStorage.setItem(lsKey(), todayKey())
}

export function ChannelPromoOverlay({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient()
  const setGameState = useGameStore(s => s.setGameState)

  const { data: tasks = [] } = useQuery({
    queryKey: ['channelTasks'],
    queryFn: () => api.tasks.getChannels(),
    staleTime: 30_000,
  })

  const unclaimedTasks = tasks.filter(t => !t.claimed)
  const totalReward = unclaimedTasks.reduce((s, t) => s + t.rewardRubles, 0)

  const openChannel = (link: string) => {
    if (typeof window !== 'undefined' && window.Telegram?.WebApp) {
      window.Telegram.WebApp.openTelegramLink(link)
    } else {
      window.open(link, '_blank')
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 255,
        background: 'rgba(6, 4, 18, 0.88)',
        display: 'flex', alignItems: 'flex-end',
      }}
    >
      <motion.div
        initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 30, stiffness: 300 }}
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%',
          maxHeight: '90dvh',
          display: 'flex', flexDirection: 'column',
          background: gradients.modal,
          borderTop: `1px solid ${colors.fairyGold}55`,
          borderRadius: '20px 20px 0 0',
          boxShadow: '0 -8px 32px rgba(0,0,0,0.5)',
          paddingBottom: 'env(safe-area-inset-bottom)',
        }}
      >
        {/* Заголовок */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: `${spacing.lg} ${spacing.lg} ${spacing.md}`,
          borderBottom: `1px solid ${colors.fairyGold}25`,
          flexShrink: 0,
        }}>
          <div>
            <div style={{ color: colors.fairyGold, fontSize: '16px', fontWeight: 800 }}>
              🎁 Задания ярмарки
            </div>
            {totalReward > 0 && (
              <div style={{ color: colors.textOnDarkMuted, fontSize: '12px', marginTop: '2px' }}>
                Можно получить ещё +{totalReward} г за подписку
              </div>
            )}
          </div>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', color: colors.textOnDarkMuted, fontSize: '20px', cursor: 'pointer', padding: '4px 8px' }}
          >
            ✕
          </button>
        </div>

        {/* Список каналов */}
        <div style={{ padding: `${spacing.md} ${spacing.lg}`, display: 'flex', flexDirection: 'column', gap: '8px', overflowY: 'auto', flex: 1 }}>
          {tasks.map(task => (
            <ChannelPromoRow
              key={task.id}
              task={task}
              onClaimed={async () => {
                qc.invalidateQueries({ queryKey: ['channelTasks'] })
                const fresh = await api.game.getState()
                setGameState(fresh)
              }}
              onOpen={() => openChannel(task.channelLink)}
            />
          ))}
        </div>

        {/* Кнопка закрыть */}
        <div style={{ padding: `${spacing.sm} ${spacing.lg} ${spacing.lg}`, flexShrink: 0 }}>
          <button
            onClick={onClose}
            style={{
              width: '100%',
              padding: spacing.md,
              background: unclaimedTasks.length === 0 ? `${colors.fairyGold}22` : colors.fairyGold,
              border: unclaimedTasks.length === 0 ? `1px solid ${colors.fairyGold}55` : 'none',
              borderRadius: '12px',
              color: unclaimedTasks.length === 0 ? colors.fairyGold : colors.nightBlue,
              fontSize: '14px', fontWeight: 700,
              cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            {unclaimedTasks.length === 0 ? 'Все награды получены ✓' : 'Закрыть'}
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}

function ChannelPromoRow({
  task, onClaimed, onOpen,
}: { task: ChannelTaskDTO; onClaimed: () => void; onOpen: () => void }) {
  const [state, setState] = useState<'idle' | 'loading' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState('')

  const claim = async () => {
    setState('loading')
    setErrorMsg('')
    try {
      await api.tasks.claimChannel(task.id)
      onClaimed()
    } catch (err: any) {
      const msg: string = err.message ?? ''
      if (msg.includes('уже получена')) {
        onClaimed()
      } else if (msg.includes('Подпишись')) {
        setErrorMsg('Сначала подпишись на канал')
        setState('error')
      } else {
        setErrorMsg('Попробуй ещё раз')
        setState('error')
      }
    }
  }

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: spacing.md,
      padding: spacing.md,
      background: task.claimed ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.06)',
      border: `1px solid ${task.claimed ? colors.cardBorder : colors.fairyGold + '30'}`,
      borderRadius: '12px',
    }}>
      <div style={{ fontSize: '26px', flexShrink: 0 }}>
        {task.claimed ? '✅' : '📣'}
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ color: task.claimed ? colors.textOnDarkMuted : colors.textOnDark, fontWeight: 600, fontSize: '13px' }}>
          {task.channelTitle}
        </div>
        <div style={{ color: colors.textOnDarkMuted, fontSize: '11px', marginTop: '1px' }}>{task.description}</div>
        {errorMsg && <div style={{ color: '#f87171', fontSize: '11px', marginTop: '2px' }}>{errorMsg}</div>}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '5px', flexShrink: 0 }}>
        <div style={{
          color: task.claimed ? colors.textOnDarkMuted : colors.fairyGold,
          fontWeight: 700, fontSize: '13px',
          textDecoration: task.claimed ? 'line-through' : 'none',
        }}>
          +{task.rewardRubles} г
        </div>
        {task.claimed ? (
          <div style={{ color: colors.textOnDarkMuted, fontSize: '10px' }}>Получено ✓</div>
        ) : (
          <div style={{ display: 'flex', gap: '5px' }}>
            <button onClick={onOpen} style={btnStyle('secondary')}>Подписаться</button>
            <button onClick={claim} disabled={state === 'loading'} style={btnStyle('primary', state === 'loading')}>
              {state === 'loading' ? '...' : 'Забрать'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

function btnStyle(variant: 'primary' | 'secondary', disabled = false) {
  return {
    padding: '4px 9px',
    background: variant === 'primary' ? `${colors.fairyGold}22` : 'rgba(255,255,255,0.08)',
    border: `1px solid ${variant === 'primary' ? colors.fairyGold + '66' : colors.cardBorder}`,
    borderRadius: '7px',
    color: variant === 'primary' ? colors.fairyGold : colors.textOnDarkSecond,
    fontSize: '10px', fontWeight: variant === 'primary' ? 700 : 400,
    cursor: disabled ? 'default' : 'pointer',
    opacity: disabled ? 0.6 : 1,
    fontFamily: 'inherit',
  } as React.CSSProperties
}
