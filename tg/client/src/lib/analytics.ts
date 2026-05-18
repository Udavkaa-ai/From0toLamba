import telegramAnalytics from '@telegram-apps/analytics'

/**
 * Регистрирует Stars-инвойс в Telegram Apps Analytics — каталог получает
 * revenue-сигналы для ранжирования. Без этого telegramAnalytics видит только
 * launches и TON Connect события, но не покупки.
 *
 * Вызывать ДО `Telegram.WebApp.openInvoice(...)` — payload приходит с сервера
 * вместе с invoiceLink (`api.payments.createInvoice → analyticsPayload`).
 *
 * Если SDK не инициализирован (нет env-vars VITE_TG_ANALYTICS_TOKEN/_APP) —
 * вызов мягко падает в catch, приложение продолжает работать.
 */
export function registerStarsInvoice(payload?: {
  slug: string
  title: string
  description: string
  payload: string
  currency: string
  prices: { label: string; amount: number }[]
}): void {
  if (!payload) return
  try {
    telegramAnalytics.registerInvoice(payload as any)
  } catch (err) {
    console.warn('[analytics] registerInvoice failed:', err)
  }
}
