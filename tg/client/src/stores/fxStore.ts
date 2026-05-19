import { create } from 'zustand'
import { persist } from 'zustand/middleware'

/**
 * Диагностический store для отлова мерцания. На некоторых Android WebView
 * после сворачивания/восстановления Mini App страница начинает мерцать
 * много раз в секунду — кажется, что один из «живых» эффектов (canvas-rAF
 * SparklesOverlay, CSS-keyframes mist-layer, position:fixed фоновое
 * изображение) после resume входит в ломаное composit-состояние.
 *
 * Игрок в Настройках может выключить эффекты по одному и сам найти
 * виновника. Все флаги начинаются в false (всё включено). Состояние
 * persist'ится в localStorage — выживает перезапуск.
 */
interface FxStore {
  disableSparkles: boolean
  disableMist: boolean
  disableBgImage: boolean
  setDisableSparkles: (v: boolean) => void
  setDisableMist: (v: boolean) => void
  setDisableBgImage: (v: boolean) => void
  /** Eco-mode — выключает всё разом. Удобно как «попробовать всё». */
  setEcoAll: (v: boolean) => void
}

export const useFxStore = create<FxStore>()(
  persist(
    (set) => ({
      disableSparkles: false,
      disableMist: false,
      disableBgImage: false,
      setDisableSparkles: (v) => set({ disableSparkles: v }),
      setDisableMist: (v) => set({ disableMist: v }),
      setDisableBgImage: (v) => set({ disableBgImage: v }),
      setEcoAll: (v) => set({ disableSparkles: v, disableMist: v, disableBgImage: v }),
    }),
    { name: 'game-fx' },
  ),
)
