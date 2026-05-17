import { prisma } from '../db/prisma'
import { MAX_TIE_LEVEL } from './tiesService'

// ─────────────────────────────────────────────────────────────────────
// СЕЗОННЫЙ АРХИВ
// ─────────────────────────────────────────────────────────────────────
// Окончание сезона = `/snapshot_season <N>` → `/resetall`. Snapshot
// замораживает топ-100 каждого рейтинга в SeasonArchive (JSON-блоб в
// той же форме, что отдают эндпоинты). После /resetall живые данные
// обнуляются, но архив сохраняется.
//
// Переключатель `ARCHIVE_SEASON_VIEW=1` в Railway env заставляет все
// эндпоинты топов отдавать архив сезона N вместо живых вычислений.
// Сброс переменной возвращает живой режим.
// ─────────────────────────────────────────────────────────────────────

export type SeasonCategory = 'WEALTH' | 'TIES' | 'ACHIEVEMENTS' | 'REFERRALS' | 'WEALTH_TODAY'

const ENV_KEY = 'ARCHIVE_SEASON_VIEW'

/** Номер сезона из env var, или null если переменная не задана / не число. */
export function archivedSeasonNumber(): number | null {
  const v = process.env[ENV_KEY]
  if (!v) return null
  const n = parseInt(v, 10)
  return Number.isFinite(n) && n > 0 ? n : null
}

/**
 * Если включён архивный режим — возвращает сохранённый топ. Иначе null
 * (и endpoint считает живые данные как раньше).
 */
export async function getArchivedLeaderboard(
  category: SeasonCategory,
): Promise<{ entries: any[]; totalPlayers: number } | null> {
  const seasonNumber = archivedSeasonNumber()
  if (!seasonNumber) return null
  const row = await prisma.seasonArchive.findUnique({
    where: { seasonNumber_category: { seasonNumber, category } },
  })
  if (!row) return null
  return { entries: row.entries as any[], totalPlayers: row.totalPlayers }
}

/** Поиск своей позиции в архивированных entries по telegramId/userId. */
export function findMyPositionInArchive(
  entries: any[],
  currentUserId: number | null,
  currentTelegramId: string | null,
): number | null {
  if (!entries) return null
  for (let i = 0; i < entries.length; i++) {
    const e = entries[i]
    if (currentUserId != null && e.userId === currentUserId) return i + 1
    if (currentTelegramId != null && e.telegramId === currentTelegramId) return i + 1
  }
  return null
}

// ─────────────────────────────────────────────────────────────────────
// captureSeasonSnapshot — заморозить текущие топы в архив сезона N
// ─────────────────────────────────────────────────────────────────────

const TOKENS_PER_GAMES = 10
const TOKENS_PER_DEALS = 5
const TOP_N = 100

export async function captureSeasonSnapshot(seasonNumber: number): Promise<Record<SeasonCategory, number>> {
  const [
    gameStates,
    activeProjectSums,
    closedCounts,
    charterCounts,
    referralGroups,
    allSessions,
    allInvestedProjects,
    allProjects,
  ] = await Promise.all([
    prisma.gameState.findMany({
      where: { isOnboardingComplete: true },
      include: { user: { select: { id: true, telegramId: true, firstName: true, username: true, nickname: true } } },
    }),
    prisma.project.groupBy({
      by: ['userId'],
      where: { isActive: true },
      _sum: { currentValueRubles: true },
    }),
    prisma.project.groupBy({
      by: ['userId'],
      where: { isClosed: true, investedAmountRubles: { gt: 0 } },
      _count: { _all: true },
    }),
    prisma.amaSession.groupBy({
      by: ['userId'],
      where: { charterSubmittedAt: { not: null } },
      _count: { _all: true },
    }),
    prisma.user.groupBy({
      by: ['referrerId'],
      where: { referrerId: { not: null } },
      _count: { _all: true },
    }),
    prisma.amaSession.findMany({
      where: { charterSubmittedAt: { not: null } },
      select: { userId: true, project: { select: { personaArchetype: true } } },
    }),
    prisma.project.findMany({
      where: { investedAmountRubles: { gt: 0 } },
      select: { userId: true, personaArchetype: true },
    }),
    prisma.project.findMany({ select: { userId: true, personaArchetype: true } }),
  ])

  const sumByUserId    = new Map(activeProjectSums.map(p => [p.userId, p._sum.currentValueRubles ?? 0]))
  const closedByUserId = new Map(closedCounts.map(c => [c.userId, c._count._all]))
  const chartersByUserId = new Map(charterCounts.map(c => [c.userId, c._count._all]))

  // ── 1. WEALTH (топ по общему состоянию) — для /api/leaderboard.
  //    Math.floor на сохранении: UI всё равно показывает целое (см. CLAUDE.md
  //    про .toFixed vs Math.floor). Сортировка по дробному и затем floor
  //    стабильнее, чем floor-then-sort: разница в 0.x не должна менять место.
  const wealthRanked = gameStates
    .map(gs => ({
      userId: gs.userId,
      firstName: gs.user.firstName,
      username: gs.user.username ?? null,
      investorRank: gs.investorRank,
      currentDay: gs.currentDay,
      intuitionScore: gs.intuitionScore,
      totalWealth: Math.floor(gs.balance + (sumByUserId.get(gs.userId) ?? 0)),
    }))
    .sort((a, b) => b.totalWealth - a.totalWealth)

  const wealthTop = wealthRanked.slice(0, TOP_N).map((e, i) => ({ ...e, position: i + 1 }))

  // ── 2. WEALTH_TODAY (для /api/today, иная форма) — top-10 хватит, но
  //    режем по top-100 для общности (клиент возьмёт slice(0,10))
  const todayRanked = gameStates
    .map(gs => ({
      telegramId: gs.user.telegramId,
      firstName: gs.user.firstName,
      username: gs.user.username ?? null,
      nickname: gs.user.nickname ?? null,
      rank: gs.investorRank,
      wealth: Math.floor(gs.balance + (sumByUserId.get(gs.userId) ?? 0)),
    }))
    .sort((a, b) => b.wealth - a.wealth)
    .slice(0, TOP_N)

  // ── 3. TIES — суммарный уровень Завязок (та же логика что в /leaderboard/ties)
  const stats = new Map<number, Record<string, { games: number; deals: number; met: boolean }>>()
  const touch = (uid: number, arch: string) => {
    let m = stats.get(uid)
    if (!m) { m = {}; stats.set(uid, m) }
    let r = m[arch]
    if (!r) { r = { games: 0, deals: 0, met: false }; m[arch] = r }
    return r
  }
  for (const s of allSessions) touch(s.userId, s.project.personaArchetype).games += 1
  for (const p of allInvestedProjects) touch(p.userId, p.personaArchetype).deals += 1
  for (const p of allProjects) touch(p.userId, p.personaArchetype).met = true

  const tiesRanked = gameStates
    .map(gs => {
      const m = stats.get(gs.userId) ?? {}
      let totalLvl = 0
      for (const r of Object.values(m)) {
        const earned = (r.met ? 1 : 0)
          + Math.floor(r.games / TOKENS_PER_GAMES)
          + Math.floor(r.deals / TOKENS_PER_DEALS)
        totalLvl += Math.min(MAX_TIE_LEVEL, earned)
      }
      return {
        userId: gs.userId,
        firstName: gs.user.firstName,
        username: gs.user.username ?? null,
        investorRank: gs.investorRank,
        tiesTotal: totalLvl,
      }
    })
    .filter(e => e.tiesTotal > 0)
    .sort((a, b) => b.tiesTotal - a.tiesTotal)
  const tiesTop = tiesRanked.slice(0, TOP_N).map((e, i) => ({ ...e, position: i + 1 }))

  // ── 4. ACHIEVEMENTS (closed * 3 + charters)
  const achRanked = gameStates
    .map(gs => {
      const closed = closedByUserId.get(gs.userId) ?? 0
      const charters = chartersByUserId.get(gs.userId) ?? 0
      return {
        userId: gs.userId,
        firstName: gs.user.firstName,
        username: gs.user.username ?? null,
        investorRank: gs.investorRank,
        currentDay: gs.currentDay,
        intuitionScore: gs.intuitionScore,
        totalWealth: Math.floor(gs.balance + (sumByUserId.get(gs.userId) ?? 0)),
        achievementScore: closed * 3 + charters,
        closedProjectsCount: closed,
        chartersSubmitted: charters,
      }
    })
    .sort((a, b) => b.achievementScore - a.achievementScore)
  const achTop = achRanked.slice(0, TOP_N).map((e, i) => ({ ...e, position: i + 1 }))

  // ── 5. REFERRALS
  const referrerIds = referralGroups.map(g => g.referrerId as number)
  const referrers = await prisma.user.findMany({
    where: { id: { in: referrerIds } },
    select: { id: true, firstName: true, username: true, gameState: { select: { investorRank: true } } },
  })
  const byId = new Map(referrers.map(r => [r.id, r]))
  const refRanked = referralGroups
    .map(g => {
      const ref = byId.get(g.referrerId as number)
      if (!ref) return null
      return {
        userId: ref.id,
        firstName: ref.firstName,
        username: ref.username ?? null,
        investorRank: ref.gameState?.investorRank ?? 'NEWBIE',
        referralCount: g._count._all,
      }
    })
    .filter((e): e is NonNullable<typeof e> => e !== null)
    .sort((a, b) => b.referralCount - a.referralCount)
  const refTop = refRanked.slice(0, TOP_N).map((e, i) => ({ ...e, position: i + 1 }))

  // Пишем атомарно: для каждой категории upsert по (seasonNumber,category)
  const writes: Array<{ category: SeasonCategory; entries: any[]; totalPlayers: number }> = [
    { category: 'WEALTH',        entries: wealthTop, totalPlayers: wealthRanked.length },
    { category: 'WEALTH_TODAY',  entries: todayRanked, totalPlayers: wealthRanked.length },
    { category: 'TIES',          entries: tiesTop, totalPlayers: tiesRanked.length },
    { category: 'ACHIEVEMENTS',  entries: achTop, totalPlayers: achRanked.length },
    { category: 'REFERRALS',     entries: refTop, totalPlayers: refRanked.length },
  ]

  for (const w of writes) {
    await prisma.seasonArchive.upsert({
      where: { seasonNumber_category: { seasonNumber, category: w.category } },
      create: { seasonNumber, category: w.category, entries: w.entries, totalPlayers: w.totalPlayers },
      update: { entries: w.entries, totalPlayers: w.totalPlayers, capturedAt: new Date() },
    })
  }

  return {
    WEALTH:        writes[0].entries.length,
    WEALTH_TODAY:  writes[1].entries.length,
    TIES:          writes[2].entries.length,
    ACHIEVEMENTS:  writes[3].entries.length,
    REFERRALS:     writes[4].entries.length,
  }
}
