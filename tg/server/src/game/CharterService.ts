import { prisma } from '../db/prisma'
import { ProjectFate, LieTopic, ProjectPublicDTO } from './types'
import { toPublicDTO } from './projectUtils'
import { recomputeRank } from './rankService'

const GRID_SIZE = 24
const MAX_FORGERIES = GRID_SIZE - 1

// С версии 3.3 таймер Купеческой грамоты (BOYARIN) фиксирован — 15 секунд для всех
// чинов. Прочие архетипы запускают свои мини-игры (тоже на 15 сек), сервер этот
// таймер для них не использует, но шлёт согласованное значение в DTO.
const CHARTER_TIME_LIMIT_SECONDS = 15

/** Сила мутации подделок — чем честнее дело, тем тоньше мутации */
export type CharterDifficulty = 'EASY' | 'MEDIUM' | 'HARD'

/** Сколько подделок в грамоте на основе lieTopics.length + fate-bonus.
 *  INSTANT_SCAM и UNICORN зафиксированы в диапазоне 4-5 — намеренно одинаково,
 *  чтобы игрок не мог отличить скам от жар-птицы по мини-игре визуально. */
function computeForgeryCount(lieCount: number, fate: ProjectFate): number {
  if (fate === ProjectFate.INSTANT_SCAM || fate === ProjectFate.UNICORN) {
    return 4 + (lieCount % 2) // 4 или 5, детерминировано из lieCount
  }
  const extra = fate === ProjectFate.SLOW_DRAIN ? 1 : 0
  const raw = lieCount + extra
  return Math.max(0, Math.min(MAX_FORGERIES, raw))
}

function difficultyFromFate(fate: ProjectFate): CharterDifficulty {
  if (fate === ProjectFate.INSTANT_SCAM || fate === ProjectFate.HONEST_FAIL) return 'EASY'
  if (fate === ProjectFate.SLOW_DRAIN) return 'MEDIUM'
  return 'HARD' // SURVIVOR, UNICORN
}

/** Случайный seed-токен */
function randomSeed(): string {
  return Math.random().toString(36).slice(2, 12) + Date.now().toString(36)
}

/** Детерминированный выбор N различных индексов из [0, size) по seed */
function pickIndices(seed: string, size: number, n: number): number[] {
  const picked: number[] = []
  const taken = new Set<number>()
  let state = 0
  for (let i = 0; i < seed.length; i++) state = (state * 31 + seed.charCodeAt(i)) >>> 0
  let counter = 0
  while (picked.length < n && taken.size < size) {
    state = (state * 1664525 + 1013904223 + counter++) >>> 0
    const idx = state % size
    if (!taken.has(idx)) {
      taken.add(idx)
      picked.push(idx)
    }
  }
  return picked.sort((a, b) => a - b)
}

export interface CharterPublicView {
  sessionId: string
  gridSeed: string
  gridSize: number
  difficulty: CharterDifficulty
  timeLimitSeconds: number
  forgedIndices: number[]  // клиент должен знать, какие клетки рисовать мутированными
  isSubmitted: boolean
  project: ProjectPublicDTO  // публичные данные дела, чтобы клиенту не надо было искать в gameState
  result?: {
    selectedIndices: number[]
    truePositives: number[]
    falsePositives: number[]
    falseNegatives: number[]
    delta: number
  }
}

/** Создать или вернуть существующую сессию-грамоту.
 *  `rank` оставлен для обратной совместимости вызовов, но больше не влияет на таймер. */
export async function startCharter(userId: number, projectId: string, _rank = 'NEWBIE'): Promise<CharterPublicView> {
  const project = await prisma.project.findFirstOrThrow({ where: { id: projectId, userId } })

  // Грамота закрыта (истекла или дело завершилось) — новую сессию не создаём,
  // но старую (по которой игрок уже что-то сделал) можно вернуть для просмотра результата
  const existing = await prisma.amaSession.findUnique({ where: { projectId } })
  if (project.isClosed) {
    throw new Error('CHARTER_EXPIRED')
  }
  if (existing && existing.gridSeed) {
    return toPublicView(existing, project)
  }

  const fate = project.fate as ProjectFate
  const lieCount = (project.lieTopics as LieTopic[]).length
  const forgeryCount = computeForgeryCount(lieCount, fate)
  const gridSeed = randomSeed()
  const forgedIndices = pickIndices(gridSeed, GRID_SIZE, forgeryCount)
  const difficulty = difficultyFromFate(fate)

  // НЕ трогаем isInbox здесь — иначе игрок, открывший карточку и вышедший, теряет её из
  // инбокса, не сыграв мини-игру. Inbox-флаг снимется при submit (или при advance-day).

  const session = existing
    ? await prisma.amaSession.update({
        where: { id: existing.id },
        data: { gridSeed, gridSize: GRID_SIZE, difficulty, forgedIndices },
      })
    : await prisma.amaSession.create({
        data: {
          projectId,
          userId,
          gridSeed,
          gridSize: GRID_SIZE,
          difficulty,
          forgedIndices,
        },
      })

  return toPublicView(session, project)
}

export async function getCharter(userId: number, projectId: string, _rank = 'NEWBIE'): Promise<CharterPublicView | null> {
  const session = await prisma.amaSession.findUnique({ where: { projectId } })
  if (!session || session.userId !== userId || !session.gridSeed) return null
  const project = await prisma.project.findUnique({ where: { id: projectId } })
  if (!project) return null
  // Дело уже закрылось (advance-day откатил грамоту) — сигнализируем клиенту отдельным кодом
  if (project.isClosed) throw new Error('CHARTER_EXPIRED')
  return toPublicView(session, project)
}

export interface SubmitCharterResult {
  forgedIndices: number[]
  selectedIndices: number[]
  truePositives: number[]
  falsePositives: number[]
  falseNegatives: number[]
  delta: number
}

export async function submitCharter(
  userId: number,
  projectId: string,
  selectedIndices: number[],
): Promise<SubmitCharterResult> {
  const session = await prisma.amaSession.findUniqueOrThrow({ where: { projectId } })
  if (session.userId !== userId) throw new Error('FORBIDDEN')
  if (!session.gridSeed) throw new Error('NO_CHARTER')
  if (session.charterSubmittedAt) throw new Error('ALREADY_SUBMITTED')

  // Санитизация: уникальные индексы в допустимом диапазоне
  const clean = Array.from(new Set(selectedIndices)).filter(
    i => Number.isInteger(i) && i >= 0 && i < session.gridSize,
  )

  const forgedSet = new Set(session.forgedIndices)
  const selectedSet = new Set(clean)

  const truePositives  = [...selectedSet].filter(i => forgedSet.has(i)).sort((a, b) => a - b)
  const falsePositives = [...selectedSet].filter(i => !forgedSet.has(i)).sort((a, b) => a - b)
  const falseNegatives = [...forgedSet].filter(i => !selectedSet.has(i)).sort((a, b) => a - b)

  // Формула: +1 за каждую найденную подделку, −1 за каждую ложную, −2 за каждую пропущенную
  let delta = truePositives.length - falsePositives.length - 2 * falseNegatives.length
  // Бонус за «чистую грамоту»: подделок не было и игрок никого не обвинил
  if (forgedSet.size === 0 && falsePositives.length === 0) {
    delta = 2
  }

  await prisma.$transaction([
    prisma.amaSession.update({
      where: { id: session.id },
      data: {
        charterSelectedIndices: clean,
        charterSubmittedAt: new Date(),
        isIntuitionEvaluated: true,
        intuitionDelta: delta,
      },
    }),
    prisma.gameState.update({
      where: { userId },
      data: { intuitionScore: { increment: delta } },
    }),
    // Только сейчас — когда игрок действительно разобрал грамоту — убираем её из инбокса
    prisma.project.update({
      where: { id: projectId },
      data: { isInbox: false },
    }),
  ])

  // Чуйка изменилась — пересчитать ранг, чтобы он не «прилипал» до advance-day
  await recomputeRank(userId)

  return {
    forgedIndices: [...forgedSet].sort((a, b) => a - b),
    selectedIndices: clean,
    truePositives,
    falsePositives,
    falseNegatives,
    delta,
  }
}

/** При идеальной игре (won && perfect) раскрываем игроку «шёпот чуйки» — короткий
 *  намёк о реальном характере дела на основе скрытого fate. */
function buildPerfectInsight(fate: ProjectFate): string {
  switch (fate) {
    case ProjectFate.INSTANT_SCAM:
      return 'Чуйка кричит: чистый обман, сгорит за пару дней.'
    case ProjectFate.SLOW_DRAIN:
      return 'Дело будет тихо высасывать гроши — выйди заранее.'
    case ProjectFate.HONEST_FAIL:
      return 'Хозяин честный, но затея шаткая — большой прибыли не жди.'
    case ProjectFate.SURVIVOR:
      return 'Дело надёжное — продержится дольше большинства.'
    case ProjectFate.UNICORN:
      return 'Чую жар-птицу: редкое дело с огнём прибыли.'
    default:
      return ''
  }
}

/** Сабмит результата мини-игры (не-BOYARIN архетипы). Победа = +3 интуиции, поражение = 0.
 *  В отличие от submitCharter, не сверяет индексы — доверяет клиенту (мини-игра идёт в реальном
 *  времени, серверной валидации нет). При `perfect=true` (победа без единой ошибки) возвращает
 *  раскрывающий намёк об истинном характере дела. */
export async function submitMiniGame(
  userId: number,
  projectId: string,
  won: boolean,
  perfect: boolean,
): Promise<{ delta: number; perfectInsight: string | null }> {
  const session = await prisma.amaSession.findUniqueOrThrow({ where: { projectId } })
  if (session.userId !== userId) throw new Error('FORBIDDEN')
  if (!session.gridSeed) throw new Error('NO_CHARTER')
  if (session.charterSubmittedAt) throw new Error('ALREADY_SUBMITTED')

  const project = await prisma.project.findUniqueOrThrow({ where: { id: projectId } })
  const delta = won ? 3 : 0

  await prisma.$transaction([
    prisma.amaSession.update({
      where: { id: session.id },
      data: {
        charterSubmittedAt: new Date(),
        isIntuitionEvaluated: true,
        intuitionDelta: delta,
      },
    }),
    prisma.gameState.update({
      where: { userId },
      data: { intuitionScore: { increment: delta } },
    }),
    prisma.project.update({
      where: { id: projectId },
      data: { isInbox: false },
    }),
  ])

  await recomputeRank(userId)

  const perfectInsight = won && perfect ? buildPerfectInsight(project.fate as ProjectFate) : null
  return { delta, perfectInsight: perfectInsight || null }
}

function toPublicView(
  session: {
    id: string
    gridSeed: string | null
    gridSize: number
    difficulty: string | null
    charterSubmittedAt: Date | null
    charterSelectedIndices: number[]
    forgedIndices: number[]
    intuitionDelta: number
  },
  project: Parameters<typeof toPublicDTO>[0],
): CharterPublicView {
  const isSubmitted = !!session.charterSubmittedAt
  const base: CharterPublicView = {
    sessionId: session.id,
    gridSeed: session.gridSeed ?? '',
    gridSize: session.gridSize,
    difficulty: (session.difficulty as CharterDifficulty) ?? 'MEDIUM',
    timeLimitSeconds: CHARTER_TIME_LIMIT_SECONDS,
    forgedIndices: session.forgedIndices,
    isSubmitted,
    project: toPublicDTO(project),
  }

  if (!isSubmitted) return base

  const forgedSet = new Set(session.forgedIndices)
  const selectedSet = new Set(session.charterSelectedIndices)
  const truePositives  = [...selectedSet].filter(i => forgedSet.has(i)).sort((a, b) => a - b)
  const falsePositives = [...selectedSet].filter(i => !forgedSet.has(i)).sort((a, b) => a - b)
  const falseNegatives = [...forgedSet].filter(i => !selectedSet.has(i)).sort((a, b) => a - b)

  return {
    ...base,
    result: {
      selectedIndices: session.charterSelectedIndices,
      truePositives,
      falsePositives,
      falseNegatives,
      delta: session.intuitionDelta,
    },
  }
}
