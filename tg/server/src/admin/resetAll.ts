/**
 * Глобальный сброс прогресса всех игроков.
 *
 * Запуск (из tg/server/):
 *   npx tsx src/admin/resetAll.ts
 *
 * Что сохраняется:
 *   - referrerId            — связь «кто пригласил» остаётся
 *   - preferredModel        — выбор модели AI
 *
 * Что сбрасывается:
 *   - referralBonusGranted → false  (бонус можно получить повторно,
 *     когда реферал наберёт 10 очков чуйки)
 *   - весь игровой прогресс: баланс, день, чин, чуйка, проекты, сделки
 *
 * После сброса каждому игроку генерируется стартовый проект (онбординг).
 */

import { PrismaClient } from '@prisma/client'
import { generateOnboardingProject } from '../game/GenerateProjectService'

const prisma = new PrismaClient()

async function resetAll() {
  const users = await prisma.user.findMany({
    include: { gameState: true },
  })

  console.log(`Сброс ${users.length} игроков…`)

  for (const user of users) {
    if (!user.gameState) {
      console.log(`  [skip] userId=${user.id} — нет gameState`)
      continue
    }

    const preferredModel = user.gameState.preferredModel ?? 'deepseek/deepseek-v4-flash'
    const preferredLanguage = user.gameState.preferredLanguage ?? 'ru'

    // Удаляем все проекты (cascade: AmaSession, AmaMessage, DailyUpdate, PostMortem)
    await prisma.project.deleteMany({ where: { userId: user.id } })
    // Удаляем все транзакции
    await prisma.transaction.deleteMany({ where: { userId: user.id } })

    // Сбрасываем User: очищаем pendingReferral, сбрасываем referralBonusGranted
    // (чтобы бонус можно было получить повторно после набора 10 чуйки)
    await prisma.user.update({
      where: { id: user.id },
      data: {
        pendingReferralParam: null,
        referralBonusGranted: false,
      },
    })

    // Сбрасываем GameState
    await prisma.gameState.update({
      where: { userId: user.id },
      data: {
        balance: 50, // STARTING_GIFT
        currentDay: 0,
        investorRank: 'NEWBIE',
        intuitionScore: 0,
        dayStreak: 0,
        isOnboardingComplete: false,
        totalInvested: 0,
        totalReturned: 0,
        balanceHistory: [],
        investedHistory: [],
        pendingRankUp: null,
        lastAdvancedAt: null,
        nextDayNotified: true,
        consecutiveAdvances: 0,
        weekStartWealth: 0,
        weekStartAt: null,
        preferredModel,
      },
    })

    // Генерируем стартовый проект
    generateOnboardingProject(user.id, preferredModel, preferredLanguage).catch(e =>
      console.error(`  [warn] userId=${user.id} onboarding error:`, e),
    )

    console.log(`  [ok] @${user.username ?? user.telegramId} (id=${user.id})`)
  }

  console.log('Готово.')
  await prisma.$disconnect()
}

resetAll().catch(e => {
  console.error(e)
  process.exit(1)
})
