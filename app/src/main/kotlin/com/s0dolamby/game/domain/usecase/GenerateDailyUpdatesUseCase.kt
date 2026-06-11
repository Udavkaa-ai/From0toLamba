package com.s0dolamby.game.domain.usecase

import com.s0dolamby.game.data.registry.NewsTemplateBank
import com.s0dolamby.game.domain.model.*
import com.s0dolamby.game.domain.repository.UpdateRepository
import java.util.UUID
import javax.inject.Inject
import kotlin.random.Random

/**
 * Ежедневные вести — целиком из локальных шаблонов NewsTemplateBank.
 * LLM не используется (экономия токенов, мгновенный отклик).
 *
 * Логика:
 * 1. Если задано [event] — берём шаблон из EVENT_TEMPLATES по типу события.
 * 2. Иначе детерминированно выбираем PayoutStatus по судьбе дела.
 *    Затем pick категории по (payout, fate, type).
 * 3. userCountDelta тоже формируем по судьбе: SURVIVOR/UNICORN — рост,
 *    SLOW_DRAIN/INSTANT_SCAM — отток.
 */
class GenerateDailyUpdatesUseCase @Inject constructor(
    private val updateRepository: UpdateRepository
) {
    suspend operator fun invoke(
        project: Project,
        event: AnnouncementType? = null
    ): Result<DailyUpdate> = runCatching {
        val sample = NewsTemplateBank.pick(project, event)
        val payoutStatus = computePayoutStatus(project, event)
        val userCountDelta = computeUserCountDelta(project, event)

        val update = DailyUpdate(
            id = UUID.randomUUID().toString(),
            projectId = project.id,
            projectName = project.claimedName,
            day = project.daysSinceJoined,
            title = sample.title,
            body = sample.body,
            userCountDelta = userCountDelta,
            payoutStatus = payoutStatus,
            announcement = event,
            redFlags = sample.redFlags
        )
        updateRepository.saveUpdate(update)
        update
    }

    private fun computePayoutStatus(project: Project, event: AnnouncementType?): PayoutStatus {
        return when (event) {
            AnnouncementType.CRIMINAL_CASE, AnnouncementType.HACK -> PayoutStatus.DELAYED
            AnnouncementType.LISTING, AnnouncementType.VIP_COLLAB -> PayoutStatus.BOOSTED
            else -> NewsTemplateBank.pickPayoutStatus(project)
        }
    }

    private fun computeUserCountDelta(project: Project, event: AnnouncementType?): Int {
        // Сильные события ярко влияют на отток/приток
        when (event) {
            AnnouncementType.LISTING, AnnouncementType.VIP_COLLAB ->
                return Random.nextInt(20, 60)
            AnnouncementType.CRIMINAL_CASE, AnnouncementType.HACK ->
                return -Random.nextInt(15, 50)
            AnnouncementType.BAD_RUMOR ->
                return -Random.nextInt(5, 18)
            AnnouncementType.NEW_SEASON, AnnouncementType.COLLAB, AnnouncementType.AUDIT ->
                return Random.nextInt(-3, 8)
            null -> Unit
        }
        // Обычный день — направление зависит от судьбы
        return when (project.fate) {
            ProjectFate.UNICORN -> Random.nextInt(8, 22)
            ProjectFate.SURVIVOR -> Random.nextInt(-2, 6)
            ProjectFate.HONEST_FAIL -> Random.nextInt(-4, 3)
            ProjectFate.SLOW_DRAIN -> Random.nextInt(-10, 2)
            ProjectFate.INSTANT_SCAM -> Random.nextInt(-18, -2)
        }
    }
}
