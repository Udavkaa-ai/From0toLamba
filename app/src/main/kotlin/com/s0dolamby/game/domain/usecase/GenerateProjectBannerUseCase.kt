package com.s0dolamby.game.domain.usecase

import com.s0dolamby.game.data.banners.BannerAssets
import com.s0dolamby.game.data.logging.AppLogger
import com.s0dolamby.game.domain.model.Project
import com.s0dolamby.game.domain.repository.ProjectRepository
import javax.inject.Inject

/**
 * Подбирает обложку дела из стратегического запаса в assets/banners/
 * (278 заранее сгенерированных webp по архетипу × типу дела).
 *
 * Раньше тут была двухступенчатая AI-генерация (DeepSeek-концепт →
 * Pollinations/FLUX) — медленно, требовала сеть и иногда давала мусор.
 * Теперь: мгновенно, оффлайн, бесплатно и стилистически однородно.
 */
class GenerateProjectBannerUseCase @Inject constructor(
    private val bannerAssets: BannerAssets,
    private val projectRepository: ProjectRepository
) {
    suspend operator fun invoke(project: Project): Result<String> = runCatching {
        val url = bannerAssets.bannerUrl(project.personaArchetype, project.type, project.id)
            ?: run {
                AppLogger.i("GenerateProjectBannerUseCase",
                    "No stock banner for ${project.personaArchetype}/${project.type}")
                return@runCatching ""
            }
        projectRepository.updateBannerUrl(project.id, url, "stock-asset")
        AppLogger.i("GenerateProjectBannerUseCase", "Stock banner set for ${project.claimedName}")
        url
    }
}
