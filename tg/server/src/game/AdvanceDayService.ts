import { prisma } from '../db/prisma'
import { ProjectFate, FATE_CONFIG, InvestorRank } from './types'
import { computeRank, isRankUp } from './rankService'
import { randomInRange as rng, randomIntInRange as irng } from './projectUtils'
import { generateDailyUpdate, generatePostMortem } from '../ai/openRouterClient'
import { generateProject } from './GenerateProjectService'

const HANDOVER_REASONS_SURVIVOR = [
  'Дело выкупил племянник воеводы — прибыль выплачена 📜',
  'Хозяин уступил дело купеческой артели — расчёт честный',
  'Дело передано зятю Старосты — вложения возвращены с доходом',
  'Купеческая гильдия поглотила дело — прибыль выплачена сполна',
]

const HANDOVER_REASONS_UNICORN = [
  'Столичные купцы выкупили дело — вложения приумножены в разы 🏆',
  'Дело приглянулось самому воеводе — честный выкуп произведён 🦄',
  'Хозяин уплыл за море, оставив расчёт всем вкладчикам честно',
  'Великая артель купила дело — вкладчики получили свою долю сполна',
]

const NEW_PROJECTS_PER_DAY_MIN = 1
const NEW_PROJECTS_PER_DAY_MAX = 3

/** 2 часа реального времени между пачками «Следующий день» */
export const ADVANCE_COOLDOWN_MS = 2 * 60 * 60 * 1000
/** Сколько дней подряд можно пройти без ожидания / рекламы */
export const MAX_CONSECUTIVE_ADVANCES = 7

export interface AdvanceDayOptions {
  /** Если true — пропускает проверку кулдауна (используется крон-jobом и заглушкой рекламы) */
  bypassCooldown?: boolean
}

export async function advanceDay(userId: number, options: AdvanceDayOptions = {}): Promise<{ newRank?: InvestorRank }> {
  const gameState = await prisma.gameState.findUniqueOrThrow({ where: { userId } })

  // Кулдаун: после пачки в MAX_CONSECUTIVE_ADVANCES дней должно пройти ADVANCE_COOLDOWN_MS
  const sinceLastMs = gameState.lastAdvancedAt ? Date.now() - gameState.lastAdvancedAt.getTime() : Infinity
  const cooldownPassed = sinceLastMs >= ADVANCE_COOLDOWN_MS
  if (!options.bypassCooldown && !cooldownPassed && gameState.consecutiveAdvances >= MAX_CONSECUTIVE_ADVANCES) {
    throw new Error('ADVANCE_TOO_SOON')
  }

  // Новая пачка стартует после: 2ч ожидания, просмотра рекламы, или первого перехода
  const startingNewBucket = cooldownPassed || options.bypassCooldown
  const newConsecutive = startingNewBucket ? 1 : gameState.consecutiveAdvances + 1

  // Истекают все входящие грамоты (живут только один день)
  await prisma.project.updateMany({
    where: { userId, isInbox: true },
    data: { isInbox: false, isClosed: true, closureReason: 'Грамота истекла' },
  })

  // Предзагруженные дела прошлого дня становятся новым inbox'ом мгновенно
  const promoted = await prisma.project.updateMany({
    where: { userId, isPreloaded: true },
    data: { isPreloaded: false, isInbox: true },
  })

  const activeProjects = await prisma.project.findMany({
    where: { userId, isActive: true },
  })

  let balanceDelta = 0

  for (const project of activeProjects) {
    const fate = project.fate as ProjectFate
    const fateCfg = FATE_CONFIG[fate]

    let updatedValue = project.currentValueRubles
    let shouldClose = false
    let lossPercent = 0
    let closureReason = ''

    const daysLeft = project.daysUntilCollapse

    // За 2 дня до медленного слива — блокируем вывод (тихий сигнал тревоги)
    // INSTANT_SCAM ничего не сигналит — исчезает внезапно
    if (daysLeft !== null && daysLeft === 2 && fate === ProjectFate.SLOW_DRAIN) {
      await prisma.project.update({
        where: { id: project.id },
        data: { isWithdrawalLocked: true },
      })
    }

    // Закрытие проекта
    if (daysLeft !== null && daysLeft <= 0) {
      shouldClose = true
      lossPercent = rng(fateCfg.lossRange[0], fateCfg.lossRange[1])

      if (fate === ProjectFate.INSTANT_SCAM) {
        closureReason = 'Хозяин исчез вместе со всеми деньгами 💀'
      } else if (fate === ProjectFate.SLOW_DRAIN) {
        closureReason = 'Дело тихо угасло и закрылось'
      } else if (fate === ProjectFate.HONEST_FAIL) {
        closureReason = 'Хозяин честно признал провал'
      } else if (fate === ProjectFate.SURVIVOR) {
        closureReason = HANDOVER_REASONS_SURVIVOR[Math.floor(Math.random() * HANDOVER_REASONS_SURVIVOR.length)]
      } else if (fate === ProjectFate.UNICORN) {
        closureReason = HANDOVER_REASONS_UNICORN[Math.floor(Math.random() * HANDOVER_REASONS_UNICORN.length)]
      }

      const returned = updatedValue * (1 - lossPercent)
      balanceDelta += returned

      // Генерируем PostMortem
      const profitPercent = project.investedAmountRubles > 0
        ? ((returned - project.investedAmountRubles) / project.investedAmountRubles) * 100
        : 0

      const amaSession = await prisma.amaSession.findUnique({ where: { projectId: project.id } })

      generatePostMortem({
        projectId: project.id,
        userId,
        archetype: project.personaArchetype,
        fate: project.fate,
        lieTopics: project.lieTopics,
        investedAmount: project.investedAmountRubles,
        returnedAmount: returned,
        profitPercent,
        daysActive: project.daysSinceJoined,
        intuitionDelta: amaSession?.intuitionDelta ?? 0,
      }).catch(console.error)

      await prisma.project.update({
        where: { id: project.id },
        data: {
          isActive: false,
          isClosed: true,
          closureReason,
          currentValueRubles: returned,
        },
      })

      await prisma.transaction.create({
        data: {
          userId,
          projectId: project.id,
          projectName: project.name,
          type: 'RETURNED',
          amount: returned,
          day: gameState.currentDay + 1,
        },
      }).catch(console.error)

      continue
    }

    // Начисляем доходность: investedAmount × realDailyYield
    if (project.investedAmountRubles > 0) {
      const dailyYield = project.investedAmountRubles * project.realDailyYieldRubles
      updatedValue += dailyYield

      // 10% шанс случайного события
      if (Math.random() < 0.1) {
        const eventMultiplier = rng(0.85, 1.2)
        updatedValue *= eventMultiplier
      }
    }

    // Compute userCountDelta based on fate
    let userCountDelta = 0
    if (fate === ProjectFate.INSTANT_SCAM) {
      // Скам ничего не сигналит: вкладчики «прибывают» как и в нормальных делах
      userCountDelta = irng(3, 20)
    } else if (fate === ProjectFate.SLOW_DRAIN) {
      const daysLeft2 = project.daysUntilCollapse ?? 0
      // More users leave as collapse approaches
      userCountDelta = -irng(2, 15) * (daysLeft2 < 5 ? 3 : 1)
    } else if (fate === ProjectFate.UNICORN) {
      userCountDelta = irng(5, 30)
    } else if (fate === ProjectFate.SURVIVOR) {
      userCountDelta = irng(-2, 8)
    } else {
      userCountDelta = irng(-5, 3)
    }

    // Determine payoutStatus
    let payoutStatus = 'NORMAL'
    // INSTANT_SCAM — никаких сигналов, выплаты «нормальные» до самого исчезновения
    if (daysLeft !== null && daysLeft <= 3 && fate === ProjectFate.SLOW_DRAIN) {
      payoutStatus = 'DELAYED'
    } else if (fate === ProjectFate.UNICORN && project.daysSinceJoined > 0) {
      payoutStatus = Math.random() < 0.3 ? 'BOOSTED' : 'NORMAL'
    }

    const newUserCount = Math.max(0, project.currentUserCount + userCountDelta)
    const apparentAPY = project.investedAmountRubles > 0
      ? ((updatedValue - project.investedAmountRubles) / project.investedAmountRubles) * 365 / Math.max(1, project.daysSinceJoined) * 100
      : project.claimedAPY
    const newUserCountHistory = [...project.userCountHistory, newUserCount].slice(-30)
    const newApyHistory = [...project.apyHistory, Math.round(apparentAPY)].slice(-30)
    const newValueHistory = [...project.valueHistory, Math.round(updatedValue)].slice(-30)

    await prisma.project.update({
      where: { id: project.id },
      data: {
        currentValueRubles: updatedValue,
        daysSinceJoined: { increment: 1 },
        daysUntilCollapse: daysLeft !== null ? daysLeft - 1 : null,
        currentUserCount: newUserCount,
        userCountHistory: newUserCountHistory,
        apyHistory: newApyHistory,
        valueHistory: newValueHistory,
      },
    })

    // Генерируем весть для проекта (кроме INSTANT_SCAM — он молчит до самого исчезновения)
    if (fate !== ProjectFate.INSTANT_SCAM) {
      generateDailyUpdate(project.id, userId, project, userCountDelta, payoutStatus).catch(console.error)
    }
  }

  // Обновляем баланс и GameState
  const newBalance = gameState.balance + balanceDelta
  const newDay = gameState.currentDay + 1
  const newStreak = gameState.dayStreak + 1

  // Считаем totalWealth для ранга
  const updatedActiveProjects = await prisma.project.findMany({
    where: { userId, isActive: true },
    select: { currentValueRubles: true },
  })
  const totalWealth = newBalance + updatedActiveProjects.reduce((s, p) => s + p.currentValueRubles, 0)

  const newRank = computeRank({
    currentDay: newDay,
    totalWealth,
    intuitionScore: gameState.intuitionScore,
  })

  const oldRank = gameState.investorRank as InvestorRank
  const rankChanged = newRank !== oldRank
  const rankUp = rankChanged && isRankUp(oldRank, newRank)

  // История (храним последние 30 точек)
  const balanceHistory = [...gameState.balanceHistory, newBalance].slice(-30)
  const investedHistory = [...gameState.investedHistory, totalWealth - newBalance].slice(-30)

  await prisma.gameState.update({
    where: { userId },
    data: {
      balance: newBalance,
      currentDay: newDay,
      dayStreak: newStreak,
      investorRank: newRank,
      balanceHistory,
      investedHistory,
      pendingRankUp: rankUp ? newRank : null,
      lastAdvancedAt: new Date(),
      // Сбрасываем флаг — крон должен снова отправить уведомление через 2 часа
      nextDayNotified: false,
      consecutiveAdvances: newConsecutive,
    },
  })

  // Предзагружаем дела на следующий день в фоне — AI успевает сгенерить имена/описания
  // за время между advance-day'ями (обычно минимум 2 часа кулдауна)
  const preloadCount = irng(NEW_PROJECTS_PER_DAY_MIN, NEW_PROJECTS_PER_DAY_MAX)
  for (let i = 0; i < preloadCount; i++) {
    generateProject(userId, undefined, undefined, { preloaded: true }).catch(console.error)
  }

  // Fallback: если из предзагрузки ничего не пришло (первый advance-day игрока),
  // запускаем обычную синхронную генерацию прямо в inbox как раньше — хоть что-то да появится
  if (promoted.count === 0) {
    for (let i = 0; i < preloadCount; i++) {
      generateProject(userId).catch(console.error)
    }
  }

  return rankUp ? { newRank } : {}
}
