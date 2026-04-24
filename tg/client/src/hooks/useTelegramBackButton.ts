import { useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

/**
 * Перехватывает системный «назад» в Telegram Mini App, чтобы не закрывать
 * WebApp целиком, а возвращаться на предыдущий экран.
 *
 * Использует Telegram.WebApp.BackButton (стрелку в шапке Mini App).
 * На корневом пути (/) прячем кнопку — оттуда системный «назад» закроет
 * Mini App, и это ожидаемо.
 */
export function useTelegramBackButton() {
  const { pathname } = useLocation()
  const navigate = useNavigate()

  useEffect(() => {
    const tg = (window as any).Telegram?.WebApp
    const back = tg?.BackButton
    if (!back) return

    const isRoot = pathname === '/'
    const handler = () => navigate(-1)

    if (isRoot) {
      back.hide?.()
    } else {
      back.show?.()
      back.onClick?.(handler)
    }
    return () => {
      back.offClick?.(handler)
    }
  }, [pathname, navigate])
}
