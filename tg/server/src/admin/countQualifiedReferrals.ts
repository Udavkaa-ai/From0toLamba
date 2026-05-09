/**
 * Подсчёт «квалифицированных» рефералов для топ-N сватов.
 * Квалифицированный = referralBonusGranted=true (реферал набрал ≥10 чуйки и бонус уже начислен).
 *
 * Запуск (из tg/server/):
 *   DATABASE_URL="postgresql://..." npx tsx src/admin/countQualifiedReferrals.ts
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  // Все рефералы сгруппированные по ссыльному
  const allGroups = await prisma.user.groupBy({
    by: ['referrerId'],
    where: { referrerId: { not: null } },
    _count: { _all: true },
  })

  // Квалифицированные рефералы (bonusGranted=true)
  const qualifiedGroups = await prisma.user.groupBy({
    by: ['referrerId'],
    where: { referrerId: { not: null }, referralBonusGranted: true },
    _count: { _all: true },
  })
  const qualifiedMap = new Map(qualifiedGroups.map(g => [g.referrerId, g._count._all]))

  const referrerIds = allGroups.map(g => g.referrerId as number)
  const referrers = await prisma.user.findMany({
    where: { id: { in: referrerIds } },
    select: { id: true, firstName: true, username: true, gameState: { select: { investorRank: true } } },
  })
  const byId = new Map(referrers.map(r => [r.id, r]))

  const ranked = allGroups
    .map(g => {
      const ref = byId.get(g.referrerId as number)
      if (!ref) return null
      return {
        username: ref.username ? `@${ref.username}` : ref.firstName,
        rank: ref.gameState?.investorRank ?? 'NEWBIE',
        total: g._count._all,
        qualified: qualifiedMap.get(g.referrerId as number) ?? 0,
      }
    })
    .filter((e): e is NonNullable<typeof e> => e !== null)
    .sort((a, b) => b.total - a.total)
    .slice(0, 5)

  console.log('\nТоп-5 сватов | всего → квалифицированных (≥10 чуйки):')
  console.log('─'.repeat(55))
  ranked.forEach((e, i) => {
    const pct = e.total > 0 ? Math.round((e.qualified / e.total) * 100) : 0
    console.log(`#${i + 1}  ${e.username.padEnd(30)} ${e.total} → ${e.qualified} (${pct}%)`)
  })
  console.log('─'.repeat(55))
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
