package com.s0dolamby.game.data.banners

import android.content.Context
import com.s0dolamby.game.domain.model.PersonaArchetype
import com.s0dolamby.game.domain.model.ProjectType
import dagger.hilt.android.qualifiers.ApplicationContext
import javax.inject.Inject
import javax.inject.Singleton
import kotlin.math.abs

/**
 * Резолвер обложек дел из бандл-ассетов (assets/banners/, 278 webp).
 * Файлы: <ARCHETYPE>_<TYPE>_<NN>.webp, по 6-8 вариантов на комбинацию.
 *
 * Обложка детерминирована projectId — у одного дела всегда одна картинка,
 * никакой сети и AI. Coil грузит file:///android_asset/... напрямую.
 *
 * Особенность стока: BOYARIN в TG-версии переименован в «Царя Гороха»,
 * файлы лежат с префиксом TSAR_GOROKH.
 */
@Singleton
class BannerAssets @Inject constructor(
    @ApplicationContext context: Context
) {
    // Карта «ARCH_TYPE» → список имён файлов; строится один раз с диска,
    // чтобы переживать неполные комбинации (где-то 8 вариантов, где-то 6)
    private val byCombo: Map<String, List<String>> by lazy {
        val files = context.assets.list(ASSET_DIR)?.toList().orEmpty()
        files
            .filter { it.endsWith(".webp") }
            .groupBy { it.substringBeforeLast('_') }   // BABA_YAGA_CARD_GAME_03.webp → BABA_YAGA_CARD_GAME
            .mapValues { (_, names) -> names.sorted() }
    }

    /** file:///android_asset/-URL обложки для дела, либо null если комбинации нет в стоке. */
    fun bannerUrl(archetype: PersonaArchetype, type: ProjectType, projectId: String): String? {
        val prefix = "${archetype.assetPrefix()}_${type.name}"
        val variants = byCombo[prefix] ?: return null
        if (variants.isEmpty()) return null
        val pick = variants[abs(projectId.hashCode()) % variants.size]
        return "file:///android_asset/$ASSET_DIR/$pick"
    }

    private fun PersonaArchetype.assetPrefix(): String = when (this) {
        PersonaArchetype.BOYARIN -> "TSAR_GOROKH"
        else -> name
    }

    private companion object {
        const val ASSET_DIR = "banners"
    }
}
