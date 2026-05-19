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
  /** Глобальные visibility/blur/viewportChanged-слушатели музыки. По
   *  хронологии коммитов (17 мая 2026: одновременно music-resume-fix и
   *  начало эпохи мерцания) это подозреваемый виновник: на resume Android
   *  WebView дёргает 4 события подряд → 4× audio.play() → возможно
   *  GPU recomposit. Выключение убивает auto-resume музыки, зато можно
   *  проверить эту гипотезу. */
  disableMusicHandlers: boolean
  /** Транзитный флаг — выставляется на время открытия fullscreen-модалок
   *  (Настройки сейчас, в будущем возможно FAQ/Reset). Когда true —
   *  ScreenBackground прячет sparkles и mist ПОЛНОСТЬЮ. На Android WebView
   *  при нажатии кнопок внутри модалки появляются временные composit-слои
   *  (whileTap, TonConnect modal popup и т.п.), через которые могут
   *  проблескивать sparkles/mist — единичные «вспышки». Прячем их вообще
   *  пока модалка открыта — нечему мерцать. Не persist'ится. */
  modalOpen: boolean
  setDisableSparkles: (v: boolean) => void
  setDisableMist: (v: boolean) => void
  setDisableBgImage: (v: boolean) => void
  setDisableMusicHandlers: (v: boolean) => void
  setModalOpen: (v: boolean) => void
  /** Eco-mode — выключает всё разом. Удобно как «попробовать всё». */
  setEcoAll: (v: boolean) => void
}

export const useFxStore = create<FxStore>()(
  persist(
    (set) => ({
      disableSparkles: false,
      disableMist: false,
      disableBgImage: false,
      disableMusicHandlers: false,
      modalOpen: false,
      setDisableSparkles: (v) => set({ disableSparkles: v }),
      setDisableMist: (v) => set({ disableMist: v }),
      setDisableBgImage: (v) => set({ disableBgImage: v }),
      setDisableMusicHandlers: (v) => set({ disableMusicHandlers: v }),
      setModalOpen: (v) => set({ modalOpen: v }),
      setEcoAll: (v) => set({
        disableSparkles: v,
        disableMist: v,
        disableBgImage: v,
        disableMusicHandlers: v,
      }),
    }),
    {
      name: 'game-fx',
      // modalOpen — транзитный, не нужен в localStorage.
      partialize: (s) => ({
        disableSparkles: s.disableSparkles,
        disableMist: s.disableMist,
        disableBgImage: s.disableBgImage,
        disableMusicHandlers: s.disableMusicHandlers,
      }),
    },
  ),
)
