package com.s0dolamby.game.domain.usecase

import com.s0dolamby.game.data.logging.AppLogger
import com.s0dolamby.game.domain.model.DailyUpdate
import com.s0dolamby.game.domain.model.PayoutStatus
import com.s0dolamby.game.domain.model.PlayerVerdict
import com.s0dolamby.game.domain.model.isScamFate
import com.s0dolamby.game.domain.repository.GameStateRepository
import com.s0dolamby.game.domain.repository.ProjectRepository
import com.s0dolamby.game.domain.repository.UpdateRepository
import java.util.UUID
import javax.inject.Inject
import kotlin.math.abs

/**
 * Сверка прогнозов «Верю — не верю» с судьбой: пробегает по закрытым делам
 * с неразрешённой ставкой, начисляет очки чуйки и пишет весть-развязку.
 *
 * Вызывается из AdvanceDayUseCase (после закрытий дня и очистки инбокса —
 * так разрешаются и ставки по пропущенным делам) и из ExitProjectUseCase
 * (ручной выход — итог сразу виден в разборе старца).
 */
class ResolveVerdictsUseCase @Inject constructor(
    private val projectRepository: ProjectRepository,
    private val gameStateRepository: GameStateRepository,
    private val updateRepository: UpdateRepository
) {
    suspend operator fun invoke(): List<DailyUpdate> {
        val pending = projectRepository.getUnresolvedVerdictProjects()
        if (pending.isEmpty()) return emptyList()

        val updates = mutableListOf<DailyUpdate>()
        for (project in pending) {
            val verdict = project.playerVerdict ?: continue
            val wasScam = project.fate.isScamFate
            val correct = (verdict == PlayerVerdict.SCAM) == wasScam

            projectRepository.setVerdictResolved(project.id, correct)
            val delta = gameStateRepository.applyChuykaResult(correct)
            AppLogger.i(
                "Chuyka",
                "resolved ${project.claimedName}: verdict=$verdict scam=$wasScam correct=$correct delta=$delta"
            )

            val fateWord = if (wasScam) "обманом" else "честным делом"
            val betWord = if (verdict == PlayerVerdict.SCAM) "обман" else "честное дело"
            val update = DailyUpdate(
                id = UUID.randomUUID().toString(),
                projectId = project.id,
                projectName = project.claimedName,
                day = project.daysSinceJoined,
                title = if (correct) "🔮 Чуйка не подвела" else "🔮 Чуйка дала маху",
                body = if (correct) {
                    "«${project.claimedName}» оказалось $fateWord — ты ставил на $betWord и был прав. " +
                        "+$delta к чуйке."
                } else {
                    "«${project.claimedName}» оказалось $fateWord, а ты ставил на $betWord. " +
                        "−${abs(delta)} к чуйке — наука на будущее."
                },
                userCountDelta = 0,
                payoutStatus = PayoutStatus.NORMAL,
                announcement = null,
                redFlags = emptyList(),
                eventKind = null
            )
            updateRepository.saveUpdate(update)
            updates += update
        }
        return updates
    }
}
