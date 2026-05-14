import { prisma } from '../db/prisma'

/**
 * Жетоны хозяев — внутриигровая мини-валюта по архетипам.
 *
 * Заработок (для каждого архетипа отдельно):
 *   +1 жетон-подарок за первое знакомство (любой проект с этим хозяином,
 *      даже в инбоксе, даже не сыгранный — приветственный подарок)
 *   +1 жетон за каждые 10 сыгранных мини-игр с этим хозяином
 *   +1 жетон за каждые 5 взятых дел этого хозяина (investedAmountRubles>0)
 *
 * Заработок считается на лету; в БД храним только архетип-счётчик
 * потраченных жетонов (archetypeTokensSpent на GameState).
 *
 * Тратится на:
 *   ama_unlock — бесплатная беседа с этим хозяином (вместо 10 Stars)
 *   minigame_bypass — раскрытие дела при провале мини-игры (вместо 10 Stars)
 */

const TOKENS_PER_GAMES = 10
const TOKENS_PER_DEALS = 5

/** Карта потраченных жетонов из JSON-поля */
function parseSpent(raw: unknown): Record<string, number> {
  if (!raw || typeof raw !== 'object') return {}
  const out: Record<string, number> = {}
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof v === 'number' && v >= 0) out[k] = Math.floor(v)
  }
  return out
}

/** Полная статистика по жетонам — заработано / потрачено / доступно. */
export async function computeArchetypeTokens(userId: number): Promise<Record<string, {
  earned: number
  spent: number
  balance: number
  gamesPlayed: number
  dealsTaken: number
  /** Получен ли подарок за первое знакомство */
  welcomeBonus: boolean
}>> {
  const [gameState, sessions, projects, allProjects] = await Promise.all([
    prisma.gameState.findUniqueOrThrow({ where: { userId } }),
    prisma.amaSession.findMany({
      where: { userId, charterSubmittedAt: { not: null } },
      select: { project: { select: { personaArchetype: true } } },
    }),
    prisma.project.findMany({
      where: { userId, investedAmountRubles: { gt: 0 } },
      select: { personaArchetype: true },
    }),
    // Все проекты пользователя — даже в инбоксе, даже закрытые. Любой =
    // факт первого знакомства, даёт welcome-жетон по этому архетипу.
    prisma.project.findMany({
      where: { userId },
      select: { personaArchetype: true },
    }),
  ])

  const spent = parseSpent(gameState.archetypeTokensSpent)
  const result: Record<string, { earned: number; spent: number; balance: number; gamesPlayed: number; dealsTaken: number; welcomeBonus: boolean }> = {}

  // Подсчёт игр по архетипу
  const games: Record<string, number> = {}
  for (const s of sessions as Array<{ project: { personaArchetype: string } }>) {
    const a = s.project.personaArchetype
    games[a] = (games[a] ?? 0) + 1
  }

  // Подсчёт дел по архетипу
  const deals: Record<string, number> = {}
  for (const p of projects as Array<{ personaArchetype: string }>) {
    const a = p.personaArchetype
    deals[a] = (deals[a] ?? 0) + 1
  }

  // Знакомства — любой проект (включая инбокс / закрытые)
  const encountered = new Set<string>()
  for (const p of allProjects as Array<{ personaArchetype: string }>) {
    encountered.add(p.personaArchetype)
  }

  // Объединяем все встреченные архетипы
  const allArchetypes = new Set<string>([...encountered, ...Object.keys(games), ...Object.keys(deals), ...Object.keys(spent)])
  for (const arch of allArchetypes) {
    const gamesPlayed = games[arch] ?? 0
    const dealsTaken = deals[arch] ?? 0
    const welcomeBonus = encountered.has(arch)
    const earned = (welcomeBonus ? 1 : 0)
      + Math.floor(gamesPlayed / TOKENS_PER_GAMES)
      + Math.floor(dealsTaken / TOKENS_PER_DEALS)
    const archSpent = spent[arch] ?? 0
    const balance = Math.max(0, earned - archSpent)
    result[arch] = { earned, spent: archSpent, balance, gamesPlayed, dealsTaken, welcomeBonus }
  }
  return result
}

/** Списать 1 жетон у архетипа. Бросает ошибку если не хватает. */
export async function spendArchetypeToken(userId: number, archetype: string): Promise<void> {
  const tokens = await computeArchetypeTokens(userId)
  const cur = tokens[archetype]
  if (!cur || cur.balance < 1) throw new Error('NO_TOKENS')
  // Атомарно увеличиваем счётчик потраченных. Используем сырой Update + JSON merge.
  const gameState = await prisma.gameState.findUniqueOrThrow({ where: { userId } })
  const spent = parseSpent(gameState.archetypeTokensSpent)
  spent[archetype] = (spent[archetype] ?? 0) + 1
  await prisma.gameState.update({
    where: { userId },
    data: { archetypeTokensSpent: spent },
  })
}

/** Сколько надо ещё игр или дел до следующего жетона. Для UI-прогресса. */
export function nextTokenProgress(gamesPlayed: number, dealsTaken: number): {
  nextFromGames: number
  nextFromDeals: number
} {
  return {
    nextFromGames: TOKENS_PER_GAMES - (gamesPlayed % TOKENS_PER_GAMES),
    nextFromDeals: TOKENS_PER_DEALS - (dealsTaken % TOKENS_PER_DEALS),
  }
}
