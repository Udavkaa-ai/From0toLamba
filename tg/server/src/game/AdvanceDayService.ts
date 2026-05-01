import { prisma } from '../db/prisma'
import { ProjectFate, FATE_CONFIG, ProjectType, InvestorRank } from './types'
import { computeRank, isRankUp } from './rankService'
import { randomInRange as rng, randomIntInRange as irng } from './projectUtils'
import { generateDailyUpdate, generatePostMortem } from '../ai/openRouterClient'
import { generateProject } from './GenerateProjectService'
import { pickRandomEvent, applyEventEffect, renderEventBody } from './randomEvents'
import {
  pickMafiaOffer, renderMafiaText,
  MAFIA_OFFER_DAYS_BEFORE, MAFIA_OFFER_CHANCE, MAFIA_FORCED_CLOSURE_RETURN_PERCENT,
} from './mafiaOffers'

/** Правильный % прибыли с учётом выводов: (выведено + возврат − вложено) / вложено */
async function computeProfitPercent(projectId: string, investedAmount: number, returned: number): Promise<number> {
  if (investedAmount <= 0) return 0
  const agg = await prisma.transaction.aggregate({
    where: { projectId, type: 'WITHDRAWN' },
    _sum: { amount: true },
  })
  const totalWithdrawn = agg._sum.amount ?? 0
  return ((returned + totalWithdrawn - investedAmount) / investedAmount) * 100
}

const HANDOVER_REASONS_SURVIVOR = [
  'Дело выкупил племянник воеводы — прибыль выплачена 📜',
  'Хозяин уступил дело купеческой артели — расчёт честный',
  'Дело передано зятю Старосты — вложения возвращены с доходом',
  'Купеческая гильдия поглотила дело — прибыль выплачена сполна',
]

const HANDOVER_REASONS_UNICORN = [
  'Удалось ухватить Жар-птицу за хвост — перо обернулось золотом, выплачено сполна 🔥',
  'Столичные купцы выкупили дело — Жар-птица оставила в перьях золото, расчёт честный',
  'Сам государь приметил дело и выкупил с надбавкой — вкладчики получили иксы',
  'Великая артель забрала дело — вкладчикам досталась их доля чистым золотом',
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

/** Итоги закрытия одного дела за этот advance-day — для оверлея «карточки закрытий» */
export interface ClosureSummary {
  id: string
  name: string
  developerName: string
  fate: string                    // ProjectFate enum value
  personaArchetype: string        // PersonaArchetype enum value
  investedAmount: number
  returnedAmount: number
  profitPercent: number
  daysActive: number
  closureReason: string
  bannerImageUrl: string | null   // прокси-URL /api/banner/<id>
  forcedByMafia: boolean          // true если зевнул мафио-предложение
}

export async function advanceDay(userId: number, options: AdvanceDayOptions = {}): Promise<{
  newRank?: InvestorRank
  closures: ClosureSummary[]
}> {
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

  // Предзагруженные дела прошлого дня становятся новым inbox'ом мгновенно.
  // Ограничиваем до NEW_PROJECTS_PER_DAY_MAX — бывали случаи, когда race на
  // /api/game сеял одни и те же preloaded по несколько раз и в итоге в inbox
  // прилетало 6-8 дел. Сейчас лишние preloaded просто удаляем.
  const preloadedToPromote = await prisma.project.findMany({
    where: { userId, isPreloaded: true },
    take: NEW_PROJECTS_PER_DAY_MAX,
    orderBy: { createdAt: 'asc' },
    select: { id: true },
  })
  if (preloadedToPromote.length > 0) {
    await prisma.project.updateMany({
      where: { id: { in: preloadedToPromote.map(p => p.id) } },
      data: { isPreloaded: false, isInbox: true },
    })
  }
  // Все оставшиеся preloaded (если насеялось больше лимита) — выкидываем
  await prisma.project.deleteMany({
    where: { userId, isPreloaded: true },
  })
  const promoted = { count: preloadedToPromote.length }

  const activeProjects = await prisma.project.findMany({
    where: { userId, isActive: true },
  })

  let balanceDelta = 0
  let returnedDelta = 0  // сумма всех автозакрытий за этот день — для totalReturned
  const closures: ClosureSummary[] = []

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

      // Игрок зевнул «предложение от которого нельзя отказаться» — отдаёт половину
      const isProfitable = fate === ProjectFate.SURVIVOR || fate === ProjectFate.UNICORN
      const mafiaForced = isProfitable && project.mafiaOfferIssued

      if (fate === ProjectFate.INSTANT_SCAM) {
        closureReason = 'Хозяин исчез вместе со всеми деньгами 💀'
      } else if (fate === ProjectFate.SLOW_DRAIN) {
        closureReason = 'Дело тихо угасло и закрылось'
      } else if (fate === ProjectFate.HONEST_FAIL) {
        closureReason = 'Хозяин честно признал провал'
      } else if (mafiaForced) {
        closureReason = pickMafiaOffer(project.id).closure
        lossPercent = 1 - MAFIA_FORCED_CLOSURE_RETURN_PERCENT  // 50%
      } else if (fate === ProjectFate.SURVIVOR) {
        closureReason = HANDOVER_REASONS_SURVIVOR[Math.floor(Math.random() * HANDOVER_REASONS_SURVIVOR.length)]
      } else if (fate === ProjectFate.UNICORN) {
        closureReason = HANDOVER_REASONS_UNICORN[Math.floor(Math.random() * HANDOVER_REASONS_UNICORN.length)]
      }

      const returned = updatedValue * (1 - lossPercent)
      balanceDelta += returned
      returnedDelta += returned

      // Генерируем PostMortem
      const profitPercent = await computeProfitPercent(project.id, project.investedAmountRubles, returned)

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

      // Сводка для оверлея «итоги закрытий» — клиент покажет до перехода на новый день
      closures.push({
        id: project.id,
        name: project.name,
        developerName: project.developerName,
        fate: project.fate,
        personaArchetype: project.personaArchetype,
        investedAmount: project.investedAmountRubles,
        returnedAmount: returned,
        profitPercent,
        daysActive: project.daysSinceJoined,
        closureReason,
        bannerImageUrl: project.bannerImageUrl ? `/api/banner/${project.id}` : null,
        forcedByMafia: mafiaForced,
      })

      continue
    }

    // Начисляем доходность: investedAmount × realDailyYield
    if (project.investedAmountRubles > 0) {
      const dailyYield = project.investedAmountRubles * project.realDailyYieldRubles
      updatedValue += dailyYield
    }

    let eventApplied: { newsTitle: string; newsBody: string; kind: 'NEGATIVE' | 'POSITIVE' | 'NEUTRAL' } | null = null

    // Сначала: «Предложение от которого нельзя отказаться» — за 2-3 дня до
    // автозакрытия SURVIVOR/UNICORN с шансом 60%. Один раз на проект.
    // Если выпало — обычный pickRandomEvent НЕ разыгрывается, чтобы не
    // конкурировать за единственный слот вести в день.
    const inMafiaWindow = daysLeft !== null
      && (MAFIA_OFFER_DAYS_BEFORE as readonly number[]).includes(daysLeft)
      && (fate === ProjectFate.SURVIVOR || fate === ProjectFate.UNICORN)
      && !project.mafiaOfferIssued
    if (inMafiaWindow && Math.random() < MAFIA_OFFER_CHANCE) {
      const offer = pickMafiaOffer(project.id)
      eventApplied = {
        newsTitle: 'Предложение, от которого нельзя отказаться',
        newsBody: renderMafiaText(offer.warning, project.name),
        kind: 'NEGATIVE',
      }
      await prisma.project.update({
        where: { id: project.id },
        data: { mafiaOfferIssued: true },
      })
    }

    // Розыгрыш случайного события (15-25% шанс / специфично по типу + судьбе).
    // См. randomEvents.ts. Только если в этот день не выпала мафия.
    if (!eventApplied) {
      const event = pickRandomEvent(project.type as ProjectType, fate)
      if (event) {
        const { newValue, deltaRubles } = applyEventEffect(updatedValue, event.effect)
        updatedValue = newValue
        eventApplied = {
          newsTitle: event.title,
          newsBody: renderEventBody(event.body, project.name, deltaRubles),
          kind: event.kind,
        }
      }
    }

    // Compute userCountDelta based on fate and lifecycle phase
    let userCountDelta = 0
    const totalLife = project.daysSinceJoined + (project.daysUntilCollapse ?? 0)
    const progress = totalLife > 0 ? project.daysSinceJoined / totalLife : 0

    if (fate === ProjectFate.INSTANT_SCAM) {
      // Скам не палится: ровный рост до самого исчезновения
      userCountDelta = irng(3, 18)
    } else if (fate === ProjectFate.SLOW_DRAIN) {
      // Плавный рост (первые 50%) → плавный спад (последние 50%)
      userCountDelta = progress < 0.5 ? irng(2, 10) : -irng(2, 10)
    } else if (fate === ProjectFate.HONEST_FAIL) {
      // Резкий рост (первые 30%) → сильный спад (70%)
      userCountDelta = progress < 0.3 ? irng(15, 30) : -irng(15, 35)
    } else if (fate === ProjectFate.SURVIVOR) {
      // Медленный рост → плато → небольшое снижение
      if (progress < 0.3) userCountDelta = irng(2, 8)
      else if (progress < 0.7) userCountDelta = irng(-3, 3)
      else userCountDelta = -irng(2, 5)
    } else if (fate === ProjectFate.UNICORN) {
      // Медленный рост → плато → резкий взлёт
      if (progress < 0.4) userCountDelta = irng(2, 8)
      else if (progress < 0.7) userCountDelta = irng(-2, 5)
      else userCountDelta = irng(20, 50)
    }

    // Событийная дельта вкладчиков: позитив +3-5%, негатив −3-7%
    if (eventApplied?.kind === 'POSITIVE') {
      userCountDelta += Math.round(project.currentUserCount * rng(0.03, 0.05))
    } else if (eventApplied?.kind === 'NEGATIVE') {
      userCountDelta -= Math.round(project.currentUserCount * rng(0.03, 0.07))
    }

    const newUserCount = Math.max(0, project.currentUserCount + userCountDelta)

    // Закрытие из-за исхода вкладчиков (только если было вложение)
    if (newUserCount <= 0 && project.investedAmountRubles > 0) {
      const abandonLoss = rng(fateCfg.lossRange[0], fateCfg.lossRange[1])
      const returned = updatedValue * (1 - abandonLoss)
      balanceDelta += returned
      returnedDelta += returned

      const profitPct = await computeProfitPercent(project.id, project.investedAmountRubles, returned)
      const amaSessionAbandoned = await prisma.amaSession.findUnique({ where: { projectId: project.id } })
      generatePostMortem({
        projectId: project.id, userId,
        archetype: project.personaArchetype,
        fate: project.fate,
        lieTopics: project.lieTopics,
        investedAmount: project.investedAmountRubles,
        returnedAmount: returned,
        profitPercent: profitPct,
        daysActive: project.daysSinceJoined,
        intuitionDelta: amaSessionAbandoned?.intuitionDelta ?? 0,
      }).catch(console.error)

      await prisma.project.update({
        where: { id: project.id },
        data: {
          isActive: false, isClosed: true,
          closureReason: 'Все вкладчики разбежались — дело рухнуло',
          currentValueRubles: returned,
          currentUserCount: 0,
          userCountHistory: [...project.userCountHistory, 0].slice(-30),
        },
      })
      await prisma.transaction.create({
        data: {
          userId, projectId: project.id,
          projectName: project.name,
          type: 'RETURNED', amount: returned,
          day: gameState.currentDay + 1,
        },
      }).catch(console.error)

      closures.push({
        id: project.id, name: project.name,
        developerName: project.developerName,
        fate: project.fate,
        personaArchetype: project.personaArchetype,
        investedAmount: project.investedAmountRubles,
        returnedAmount: returned,
        profitPercent: profitPct,
        daysActive: project.daysSinceJoined,
        closureReason: 'Все вкладчики разбежались — дело рухнуло',
        bannerImageUrl: project.bannerImageUrl ? `/api/banner/${project.id}` : null,
        forcedByMafia: false,
      })
      continue
    }

    // Determine payoutStatus
    let payoutStatus = 'NORMAL'
    // INSTANT_SCAM — никаких сигналов, выплаты «нормальные» до самого исчезновения
    if (daysLeft !== null && daysLeft <= 3 && fate === ProjectFate.SLOW_DRAIN) {
      payoutStatus = 'DELAYED'
    } else if (fate === ProjectFate.UNICORN && project.daysSinceJoined > 0) {
      payoutStatus = Math.random() < 0.3 ? 'BOOSTED' : 'NORMAL'
    }
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

    // Генерируем весть для проекта (кроме INSTANT_SCAM — он молчит до самого исчезновения).
    // Если выпало случайное событие — кладём его текст мгновенно как DailyUpdate
    // и НЕ зовём AI. Иначе — обычный плейсхолдер + AI-генерация поверх.
    if (fate !== ProjectFate.INSTANT_SCAM || eventApplied) {
      if (eventApplied) {
        await prisma.dailyUpdate.create({
          data: {
            projectId: project.id,
            userId,
            day: project.daysSinceJoined + 1,
            title: eventApplied.newsTitle,
            body: eventApplied.newsBody,
            redFlags: [],
            payoutStatus,
            eventKind: eventApplied.kind,
            userCountDelta,
          },
        }).catch(err => console.error('[Event news] insert failed:', err))
      } else if (fate !== ProjectFate.INSTANT_SCAM) {
        generateDailyUpdate(project.id, userId, project, userCountDelta, payoutStatus, gameState.preferredModel, gameState.preferredLanguage ?? 'ru').catch(console.error)
      }
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
  // 180 точек = ~полгода активной игры — клиент даёт переключатель «30 / 90 / Всё»
  const balanceHistory = [...gameState.balanceHistory, newBalance].slice(-180)
  const investedHistory = [...gameState.investedHistory, totalWealth - newBalance].slice(-180)

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
      // Автозакрытия (SURVIVOR/UNICORN/SLOW_DRAIN/HONEST_FAIL/INSTANT_SCAM)
      // тоже считаются как «возвращённые рубли» — иначе на Главной выглядит
      // как сплошной убыток, хотя жирные авто-выплаты от прибыльных дел
      // прошли мимо счётчика.
      totalReturned: returnedDelta > 0 ? { increment: returnedDelta } : undefined,
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

  return { newRank: rankUp ? newRank : undefined, closures }
}
