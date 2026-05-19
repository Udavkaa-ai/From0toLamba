import { create } from 'zustand'

/**
 * Транзитный store для GPU-friendly UI: когда открыта fullscreen-модалка
 * (сейчас — Настройки), ScreenBackground прячет SparklesOverlay и mist-layer.
 *
 * Зачем: на Android WebView полупрозрачные backdrop'ы или временные
 * composit-слои (whileTap-анимация, TonConnect popup) поверх постоянно
 * перерисовываемых слоёв (canvas-rAF + CSS-keyframes) вызывают GPU
 * re-composit storm — заметные «вспышки» при тапах внутри модалки.
 * Решение: пока модалка открыта, sparkles/mist вообще не в дереве,
 * GPU нечего пересобирать.
 *
 * Не persist'ится — на следующий запуск всегда false.
 */
interface FxStore {
  modalOpen: boolean
  setModalOpen: (v: boolean) => void
}

export const useFxStore = create<FxStore>(set => ({
  modalOpen: false,
  setModalOpen: (modalOpen) => set({ modalOpen }),
}))
