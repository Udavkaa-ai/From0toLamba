import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type Lang = 'ru' | 'en'

interface LangStore {
  lang: Lang
  setLang: (l: Lang) => void
}

export const useLangStore = create<LangStore>()(
  persist(
    (set) => ({
      lang: 'ru',
      setLang: (lang) => set({ lang }),
    }),
    { name: 'game-lang' },
  ),
)

export function getLang(): Lang {
  return useLangStore.getState().lang
}
