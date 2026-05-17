import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export const TOUR_TOTAL = 11
// Bump → v2: тур переписан в 4.3.0 (11 шагов вместо 13, новый состав
// и порядок). Старые игроки, у которых был сохранён mid-state, получают
// чистое состояние; повторный просмотр доступен из Настроек.
const LS_KEY = 'ui-tour-v2'

interface TourStore {
  step: number | null  // null = тур не активен
  start: () => void
  next: () => void
  dismiss: () => void
  markDone: () => void
}

export const useTourStore = create<TourStore>()(
  persist(
    (set, get) => ({
      step: null,
      start: () => set({ step: 0 }),
      next: () => {
        const s = get().step
        if (s === null) return
        if (s >= TOUR_TOTAL - 1) {
          localStorage.setItem('ui-tour-v1-done', '1')
          set({ step: null })
        } else {
          set({ step: s + 1 })
        }
      },
      dismiss: () => {
        localStorage.setItem('ui-tour-v1-done', '1')
        set({ step: null })
      },
      markDone: () => {
        localStorage.setItem('ui-tour-v1-done', '1')
        set({ step: null })
      },
    }),
    { name: LS_KEY },
  ),
)

export function isTourDone(): boolean {
  return !!localStorage.getItem('ui-tour-v1-done')
}
