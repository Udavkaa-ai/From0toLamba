import { prisma } from '../db/prisma'
import { LieTopic, PersonaArchetype, ProjectType } from './types'
import { startAmaSession, sendAmaMessage } from '../ai/openRouterClient'
import type { NpcTruthParams } from './projectUtils'

const MAX_QUESTIONS = 10

export async function startSession(userId: number, projectId: string, model?: string): Promise<{
  sessionId: string
  firstMessage: string
}> {
  const project = await prisma.project.findFirstOrThrow({
    where: { id: projectId, userId },
  })

  // Проверяем нет ли уже сессии
  const existing = await prisma.amaSession.findUnique({ where: { projectId } })
  if (existing) {
    const messages = await prisma.amaMessage.findMany({
      where: { sessionId: existing.id },
      orderBy: { createdAt: 'asc' },
    })
    // Если сессия есть, но сообщений нет — значит AI упал при первом запуске
    // Генерируем первое сообщение заново
    if (messages.length === 0) {
      const firstMessage = await startAmaSession({
        projectId,
        archetype: project.personaArchetype as PersonaArchetype,
        developerName: project.developerName,
        projectName: project.name,
        type: project.type as ProjectType,
        claimedAPY: project.claimedAPY,
        description: project.description,
        lieTopics: project.lieTopics as LieTopic[],
        truthTopics: project.truthTopics as LieTopic[],
        npcTruthParams: project.npcTruthParams as NpcTruthParams | null,
      }, model)
      await prisma.amaMessage.create({
        data: { sessionId: existing.id, role: 'assistant', content: firstMessage },
      })
      return { sessionId: existing.id, firstMessage }
    }
    return { sessionId: existing.id, firstMessage: messages[0].content }
  }

  // Переносим из Inbox в активный статус (не вложение — просто "открыли беседу")
  await prisma.project.update({
    where: { id: projectId },
    data: { isInbox: false },
  })

  const session = await prisma.amaSession.create({
    data: { projectId, userId },
  })

  const firstMessage = await startAmaSession({
    projectId,
    archetype: project.personaArchetype as PersonaArchetype,
    developerName: project.developerName,
    projectName: project.name,
    type: project.type as ProjectType,
    claimedAPY: project.claimedAPY,
    description: project.description,
    lieTopics: project.lieTopics as LieTopic[],
    truthTopics: project.truthTopics as LieTopic[],
    npcTruthParams: project.npcTruthParams as NpcTruthParams | null,
  }, model)

  await prisma.amaMessage.create({
    data: { sessionId: session.id, role: 'assistant', content: firstMessage },
  })

  return { sessionId: session.id, firstMessage }
}

export async function sendMessage(userId: number, projectId: string, userMessage: string, model?: string): Promise<{
  reply: string
  questionCount: number
  isSessionComplete: boolean
}> {
  const session = await prisma.amaSession.findUniqueOrThrow({ where: { projectId } })

  if (session.isComplete) {
    throw new Error('SESSION_COMPLETE')
  }
  if (session.questionCount >= MAX_QUESTIONS) {
    await prisma.amaSession.update({ where: { id: session.id }, data: { isComplete: true } })
    throw new Error('SESSION_COMPLETE')
  }

  const project = await prisma.project.findUniqueOrThrow({ where: { id: projectId } })

  // Сохраняем вопрос пользователя
  await prisma.amaMessage.create({
    data: { sessionId: session.id, role: 'user', content: userMessage },
  })

  // История сессии для контекста AI
  const history = await prisma.amaMessage.findMany({
    where: { sessionId: session.id },
    orderBy: { createdAt: 'asc' },
  })

  let reply: string
  try {
    reply = await sendAmaMessage({
      archetype: project.personaArchetype as PersonaArchetype,
      developerName: project.developerName,
      projectName: project.name,
      type: project.type as ProjectType,
      lieTopics: project.lieTopics as LieTopic[],
      truthTopics: project.truthTopics as LieTopic[],
      npcTruthParams: project.npcTruthParams as NpcTruthParams | null,
      history: history.map(m => ({ role: m.role as 'user' | 'assistant', content: m.content })),
      userMessage,
      questionCount: session.questionCount + 1,
    }, model)
  } catch (err) {
    console.error('[AmaSession] AI reply failed:', err)
    throw err
  }

  await prisma.amaMessage.create({
    data: { sessionId: session.id, role: 'assistant', content: reply },
  })

  const newQuestionCount = session.questionCount + 1
  const isSessionComplete = newQuestionCount >= MAX_QUESTIONS

  await prisma.amaSession.update({
    where: { id: session.id },
    data: {
      questionCount: newQuestionCount,
      isComplete: isSessionComplete,
    },
  })

  return { reply, questionCount: newQuestionCount, isSessionComplete }
}

export async function evaluateIntuition(userId: number, projectId: string, selectedTopics: LieTopic[]): Promise<{
  delta: number
  correctTopics: LieTopic[]
  falseTopics: LieTopic[]
}> {
  const session = await prisma.amaSession.findUniqueOrThrow({ where: { projectId } })

  if (session.isIntuitionEvaluated) {
    throw new Error('ALREADY_EVALUATED')
  }

  const project = await prisma.project.findUniqueOrThrow({ where: { id: projectId } })
  const lieTopics = project.lieTopics as LieTopic[]
  const truthTopics = project.truthTopics as LieTopic[]

  // +1 за верное подозрение, -1 за ложное обвинение
  const correctTopics = selectedTopics.filter(t => lieTopics.includes(t))
  const falseTopics = selectedTopics.filter(t => truthTopics.includes(t))
  const delta = correctTopics.length - falseTopics.length

  await prisma.amaSession.update({
    where: { id: session.id },
    data: {
      isIntuitionEvaluated: true,
      selectedLieTopics: selectedTopics,
      intuitionDelta: delta,
    },
  })

  await prisma.gameState.update({
    where: { userId },
    data: { intuitionScore: { increment: delta } },
  })

  return { delta, correctTopics, falseTopics }
}

export async function getSessionMessages(projectId: string) {
  const session = await prisma.amaSession.findUnique({
    where: { projectId },
    include: { project: { select: { developerName: true } } },
  })
  if (!session) return null

  const messages = await prisma.amaMessage.findMany({
    where: { sessionId: session.id },
    orderBy: { createdAt: 'asc' },
    select: { role: true, content: true, createdAt: true },
  })

  return {
    sessionId: session.id,
    questionCount: session.questionCount,
    isComplete: session.isComplete,
    isIntuitionEvaluated: session.isIntuitionEvaluated,
    selectedLieTopics: session.selectedLieTopics,
    intuitionDelta: session.intuitionDelta,
    developerName: session.project.developerName,
    messages,
  }
}
