import { computeArchetypeTokens } from './tokenService'

/**
 * Завязки — уровни отношений с дельцами разных архетипов.
 *
 * Механика:
 *   • Каждый ПОЛУЧЕННЫЙ за всю игру жетон у архетипа = +1 уровень завязок
 *     (lifetime earned, не balance — потратив жетон на 10⭐-выкуп связь
 *     не теряется).
 *   • Уровни от 0 до MAX_TIE_LEVEL (10).
 *   • На каждом уровне бонус доходности +1% в день у дел с этим архетипом.
 *   • После 10 уровня прокачка останавливается — потолок +10%/день.
 *
 * Применяется в AdvanceDayService для активных дел (не для VIP /
 * SPONSOR_FIXED — у них своя линейная траектория). Бонус прибавляется
 * к realDailyYieldRubles в одной формуле дневной доходности.
 */

export const MAX_TIE_LEVEL = 10
export const TIE_BONUS_PER_LEVEL = 0.01   // +1% в день за уровень

/** Уровень завязок по архетипу = min(MAX_TIE_LEVEL, earned). */
export function tieLevelFromEarned(earned: number): number {
  return Math.max(0, Math.min(MAX_TIE_LEVEL, Math.floor(earned)))
}

/** Карта архетип → уровень завязок. Берётся из tokenService.computeArchetypeTokens. */
export async function computeTieLevels(userId: number): Promise<Record<string, number>> {
  const tokens = await computeArchetypeTokens(userId)
  const out: Record<string, number> = {}
  for (const [arch, info] of Object.entries(tokens)) {
    out[arch] = tieLevelFromEarned(info.earned)
  }
  return out
}

/** Дневной коэффициент бонуса по архетипу: 0 = нет связи, 0.10 = максимум. */
export function tieBonusFromLevel(level: number): number {
  const clamped = Math.max(0, Math.min(MAX_TIE_LEVEL, level))
  return clamped * TIE_BONUS_PER_LEVEL
}

/** Суммарное число уровней завязок по всем архетипам — для рейтинга «Связи». */
export function totalTies(levels: Record<string, number>): number {
  let total = 0
  for (const lvl of Object.values(levels)) total += lvl
  return total
}
