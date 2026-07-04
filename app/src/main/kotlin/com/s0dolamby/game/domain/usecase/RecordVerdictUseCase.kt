package com.s0dolamby.game.domain.usecase

import com.s0dolamby.game.domain.model.PlayerVerdict
import com.s0dolamby.game.domain.repository.AmaRepository
import com.s0dolamby.game.domain.repository.ProjectRepository
import javax.inject.Inject

/**
 * «Верю — не верю»: записать прогноз игрока по делу.
 *
 * Правила:
 *  - одна ставка на дело, не меняется (защита и на уровне SQL);
 *  - только по открытому делу — по закрытому это не прогноз, а некролог;
 *  - нужна информация: либо вложенные гроши (риск — сам по себе допуск),
 *    либо хотя бы один вопрос дельцу в беседе. Это отсекает фарм слепыми
 *    ставками по всем входящим подряд.
 */
class RecordVerdictUseCase @Inject constructor(
    private val projectRepository: ProjectRepository,
    private val amaRepository: AmaRepository
) {
    suspend operator fun invoke(projectId: String, verdict: PlayerVerdict): Result<Unit> = runCatching {
        val project = projectRepository.getProjectById(projectId)
            ?: error("Дело не найдено")
        require(!project.isClosed) { "Дело уже закрыто — чуйка опоздала" }
        require(project.playerVerdict == null) { "Чуйка уже записана" }

        val informed = project.investedAmountRubles > 0 ||
            (amaRepository.getSessionByProjectId(projectId)?.questionCount ?: 0) > 0
        require(informed) { "Сначала расспроси дельца — чуйке нужна пища" }

        val written = projectRepository.setPlayerVerdict(projectId, verdict)
        require(written) { "Чуйка уже записана" }
    }
}
