import { useEffect, useRef } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

/**
 * Управление Telegram.WebApp.BackButton. Хранит текущий handler в
 * module-scope, чтобы разные компоненты могли корректно overriding друг
 * друга и не оставляли двух-трёх listener'ов на кнопке.
 */

let currentHandler: (() => void) | null = null

function applyBack(next: (() => void) | null) {
  const back = (window as any).Telegram?.WebApp?.BackButton
  if (!back) return
  if (currentHandler) {
    try { back.offClick?.(currentHandler) } catch {}
  }
  currentHandler = next
  if (next) {
    back.show?.()
    back.onClick?.(next)
  } else {
    back.hide?.()
  }
}

/**
 * Глобальное поведение (вешаем один раз в AppShell): на корневой `/`
 * кнопка скрыта, на остальных — показываем и ведём navigate(-1).
 */
export function useTelegramBackButton() {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  useEffect(() => {
    const isRoot = pathname === '/'
    applyBack(isRoot ? null : () => navigate(-1))
  }, [pathname, navigate])
}

/**
 * Локальный override: страница перехватывает системный «назад» (и нашу
 * кнопку в шапке, если её навесить на тот же handler) своим колбэком.
 * При unmount handler очищается, глобальный хук ставит стандартный.
 */
export function useTelegramBackHandler(handler: () => void) {
  const ref = useRef(handler)
  ref.current = handler
  useEffect(() => {
    const wrapped = () => ref.current?.()
    applyBack(wrapped)
    return () => {
      // Только снимаем если это наш handler (глобальный потом поставит свой).
      if (currentHandler === wrapped) applyBack(null)
    }
  }, [])
}
