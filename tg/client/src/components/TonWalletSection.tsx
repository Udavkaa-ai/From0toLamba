import { useEffect, useState } from 'react'
import { TonConnectButton, useTonAddress, useTonConnectUI } from '@tonconnect/ui-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/api/client'
import { useT } from '@/i18n'
import { colors } from '@/theme'
import { useGameStore } from '@/stores/gameStore'
import { playSound } from '@/sounds'

/**
 * TON Connect-секция в Настройках. Требование Telegram Apps Center: апп должен
 * иметь интеграцию с TON Connect SDK. Тут:
 *  • Кнопка подключения кошелька (TonConnectButton из ui-react).
 *  • При первом подключении сервер начисляет бонус +200 г.
 *  • Кнопка «Поддержать разработчика 0.1 TON» — реальная on-chain транзакция.
 *    Адрес получаем с сервера (TON_DONATE_ADDRESS env-var); если не задан —
 *    кнопка не показывается.
 */
export function TonWalletSection() {
  const t = useT()
  const qc = useQueryClient()
  const { updateBalance } = useGameStore()
  const userAddress = useTonAddress()
  const [tonConnectUI] = useTonConnectUI()
  const [bonusFlash, setBonusFlash] = useState<number | null>(null)
  const [donateState, setDonateState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')

  // Адрес для донатов (TON_DONATE_ADDRESS env). null → кнопка доната скрыта.
  const { data: donateAddrData } = useQuery({
    queryKey: ['donateAddress'],
    queryFn: () => api.wallet.getDonateAddress(),
    staleTime: Infinity,
  })

  const connectMutation = useMutation({
    mutationFn: (addr: string) => api.wallet.connect(addr),
    onSuccess: (res) => {
      if (res.bonusGranted && res.bonusAmount) {
        updateBalance(res.bonusAmount)
        setBonusFlash(res.bonusAmount)
        playSound('rankup')
        setTimeout(() => setBonusFlash(null), 4000)
      }
      qc.invalidateQueries({ queryKey: ['gameState'] })
    },
  })

  const disconnectMutation = useMutation({
    mutationFn: () => api.wallet.disconnect(),
  })

  // Слушаем изменения статуса коннекта и синхронизируем с бэком.
  useEffect(() => {
    if (userAddress) {
      connectMutation.mutate(userAddress)
    } else {
      // Если кошелёк был привязан, а сейчас отвязали — синхронизируем сервер.
      // Не делаем при первом mount (когда юзер ещё не подключал ничего).
      const wasConnected = (window as any).__tonWalletWasConnected
      if (wasConnected) {
        disconnectMutation.mutate()
      }
    }
    ;(window as any).__tonWalletWasConnected = !!userAddress
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userAddress])

  const handleDonate = async () => {
    if (!donateAddrData?.address) return
    setDonateState('sending')
    try {
      // Транзакция 0.1 TON. 1 TON = 1e9 nano-tons.
      const validUntil = Math.floor(Date.now() / 1000) + 360
      await tonConnectUI.sendTransaction({
        validUntil,
        messages: [{ address: donateAddrData.address, amount: '100000000' }], // 0.1 TON
      })
      setDonateState('sent')
      playSound('win')
      setTimeout(() => setDonateState('idle'), 4000)
    } catch (err) {
      console.warn('[donate] failed/cancelled:', err)
      setDonateState('error')
      setTimeout(() => setDonateState('idle'), 3000)
    }
  }

  const shortAddr = userAddress
    ? `${userAddress.slice(0, 4)}…${userAddress.slice(-4)}`
    : null

  return (
    <div style={{ marginBottom: '28px' }}>
      <div style={{ color: colors.textOnDarkSecond, fontSize: '12px', fontWeight: 600, marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
        {t.tonWallet.sectionLabel}
      </div>
      <div style={{ fontSize: '11px', color: colors.textOnDarkMuted, marginBottom: '12px', lineHeight: 1.4 }}>
        {t.tonWallet.hint}
      </div>

      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '10px' }}>
        <TonConnectButton />
      </div>

      {shortAddr && (
        <div style={{
          padding: '10px 12px',
          background: `${colors.fairyGold}10`,
          border: `1px solid ${colors.fairyGold}30`,
          borderRadius: '10px',
          color: colors.textOnDarkSecond,
          fontSize: '12px',
          marginBottom: '10px',
        }}>
          {t.tonWallet.connectedAs} <span style={{ color: colors.fairyGold, fontFamily: 'monospace' }}>{shortAddr}</span>
        </div>
      )}

      {bonusFlash !== null && (
        <div style={{
          padding: '10px 12px',
          background: `${colors.success}20`,
          border: `1px solid ${colors.success}55`,
          borderRadius: '10px',
          color: colors.success,
          fontSize: '13px',
          fontWeight: 600,
          marginBottom: '10px',
          textAlign: 'center',
        }}>
          {t.tonWallet.bonusGranted.replace('{n}', String(bonusFlash))}
        </div>
      )}

      {userAddress && donateAddrData?.address && (
        <button
          onClick={() => { playSound('tap'); handleDonate() }}
          disabled={donateState === 'sending'}
          style={{
            width: '100%',
            padding: '12px 16px',
            background: donateState === 'sent' ? `${colors.success}25` : `${colors.fairyGold}18`,
            border: `1px solid ${donateState === 'sent' ? colors.success : colors.fairyGold}55`,
            borderRadius: '12px',
            color: donateState === 'sent' ? colors.success : colors.fairyGold,
            fontSize: '14px',
            fontWeight: 600,
            cursor: donateState === 'sending' ? 'wait' : 'pointer',
            textAlign: 'left',
            opacity: donateState === 'sending' ? 0.7 : 1,
          }}
        >
          {donateState === 'sending' ? t.tonWallet.donateSending
            : donateState === 'sent' ? t.tonWallet.donateSent
            : donateState === 'error' ? t.tonWallet.donateError
            : t.tonWallet.donateCta}
          <div style={{ fontSize: '11px', color: colors.textOnDarkMuted, marginTop: '4px', fontWeight: 400 }}>
            {t.tonWallet.donateHint}
          </div>
        </button>
      )}
    </div>
  )
}
