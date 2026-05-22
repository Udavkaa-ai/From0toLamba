import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type Lang = 'ru' | 'en'

interface LangStore {
  lang: Lang
  setLang: (l: Lang) => void
}

// Дефолт = EN (требование Telegram Apps Center: English должен быть
// дефолтным языком). При первом запуске main.tsx прочитает
// Telegram.WebApp.initDataUnsafe.user.language_code и переключит на 'ru'
// если Telegram-клиент игрока на русском. См. main.tsx detectInitialLang().
export const useLangStore = create<LangStore>()(
  persist(
    (set) => ({
      lang: 'en',
      setLang: (lang) => set({ lang }),
    }),
    { name: 'game-lang' },
  ),
)

export function getLang(): Lang {
  return useLangStore.getState().lang
}
