package com.s0dolamby.game.domain.usecase

import com.s0dolamby.game.data.logging.AppLogger
import com.s0dolamby.game.data.registry.PostMortemScribe
import com.s0dolamby.game.domain.model.PostMortemReport
import com.s0dolamby.game.domain.repository.AmaRepository
import com.s0dolamby.game.domain.repository.ProjectRepository
import javax.inject.Inject

/**
 * «Разбор сделки» от старца-наставника после закрытия дела.
 *
 * Раньше текст писал LLM (1 сетевой вызов на каждое закрытое дело);
 * теперь его собирает [PostMortemScribe] из локальных блоков — все факты
 * (судьба, архетип, P&L, задавал ли игрок вопросы) известны без сети.
 * Разбор мгновенный и работает офлайн.
 *
 * Идемпотентна: если PostMortem уже есть в БД, возвращает существующий.
 */
class GeneratePostMortemUseCase @Inject constructor(
    private val amaRepository: AmaRepository,
    private val projectRepository: ProjectRepository
) {
    suspend operator fun invoke(projectId: String): Result<PostMortemReport> = runCatching {
        amaRepository.getPostMortem(projectId)?.let { return@runCatching it }

        val project = projectRepository.getProjectById(projectId)
            ?: error("Дело не найдено: $projectId")
        val session = amaRepository.getSessionByProjectId(projectId)
        val questionCount = session?.questionCount ?: 0

        AppLogger.i("PostMortem", "compose project=${project.claimedName} fate=${project.fate}")
        val analysis = PostMortemScribe.compose(project, questionCount)

        val pnl = project.currentValueRubles - project.investedAmountRubles
        val report = PostMortemReport(
            projectId = project.id,
            projectName = project.claimedName,
            revealedArchetype = project.personaArchetype,
            fate = project.fate,
            redFlagsFound = emptyList(),
            redFlagsMissed = emptyList(),
            profitLossRubles = pnl,
            analysis = analysis
        )
        amaRepository.savePostMortem(report)
        report
    }.onFailure { AppLogger.e("PostMortem", "compose failed", it) }
}
