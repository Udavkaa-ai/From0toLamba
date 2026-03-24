import { create } from 'zustand'
import type { GameStateDTO } from '@/api/client'

interface GameStore {
  gameState: GameStateDTO | null
  setGameState: (state: GameStateDTO) => void
  updateBalance: (delta: number) => void
  clearPendingRankUp: () => void
}

export const useGameStore = create<GameStore>(set => ({
  gameState: null,

  setGameState: (state) => set({ gameState: state }),

  updateBalance: (delta) => set(s => ({
    gameState: s.gameState ? { ...s.gameState, balance: s.gameState.balance + delta } : null,
  })),

  clearPendingRankUp: () => set(s => ({
    gameState: s.gameState ? { ...s.gameState, pendingRankUp: null } : null,
  })),
}))
