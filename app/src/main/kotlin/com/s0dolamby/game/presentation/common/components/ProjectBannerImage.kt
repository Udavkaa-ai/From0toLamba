package com.s0dolamby.game.presentation.common.components

import android.content.Context
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import coil.compose.AsyncImage
import coil.request.CachePolicy
import coil.request.ImageRequest
import com.s0dolamby.game.data.logging.AppLogger
import com.s0dolamby.game.domain.model.PersonaArchetype
import com.s0dolamby.game.domain.model.Project
import com.s0dolamby.game.domain.model.ProjectType
import kotlin.math.abs

/**
 * Подбирает обложку для дела из бандл-стока (assets/banners/, 278 webp).
 * Файлы: `<ARCHETYPE>_<TYPE>_<NN>.webp`, BOYARIN в стоке = TSAR_GOROKH.
 * Выбор детерминирован projectId — у одного дела всегда одна картинка.
 */
@Composable
fun rememberBannerUrl(
    archetype: PersonaArchetype,
    type: ProjectType,
    projectId: String
): String? {
    val ctx = LocalContext.current
    return remember(archetype, type, projectId) { resolveBanner(ctx, archetype, type, projectId) }
}

private fun resolveBanner(
    ctx: Context,
    archetype: PersonaArchetype,
    type: ProjectType,
    projectId: String
): String? {
    val prefix = "${archetype.assetPrefix()}_${type.name}_"
    val all = runCatching { ctx.assets.list(ASSET_DIR).orEmpty().toList() }.getOrDefault(emptyList())
    val variants = all.filter { it.startsWith(prefix) && it.endsWith(".webp") }.sorted()
    if (variants.isEmpty()) return null
    val pick = variants[abs(projectId.hashCode()) % variants.size]
    return "file:///android_asset/$ASSET_DIR/$pick"
}

private fun PersonaArchetype.assetPrefix(): String = when (this) {
    PersonaArchetype.BOYARIN -> "TSAR_GOROKH"
    else -> name
}

private const val ASSET_DIR = "banners"

/**
 * Обложка дела. Источник — только сток в `assets/banners/`. Старое значение
 * `project.bannerImageUrl` из БД игнорируется (если только не указывает на
 * ассет через `file:`-схему) — раньше там мог быть URL внешней генерации.
 */
@Composable
fun ProjectBannerImage(
    project: Project,
    modifier: Modifier = Modifier
) {
    val shape = RoundedCornerShape(12.dp)
    val stockUrl = rememberBannerUrl(project.personaArchetype, project.type, project.id)
    val effectiveUrl = stockUrl
        ?: project.bannerImageUrl?.takeIf { it.startsWith("file:") }

    if (effectiveUrl == null) {
        BannerPlaceholder(project.claimedName, modifier, shape)
        return
    }
    var failed by remember(effectiveUrl) { mutableStateOf(false) }
    if (failed) {
        BannerPlaceholder(project.claimedName, modifier, shape)
        return
    }
    AsyncImage(
        model = ImageRequest.Builder(LocalContext.current)
            .data(effectiveUrl)
            .diskCachePolicy(CachePolicy.ENABLED)
            .memoryCachePolicy(CachePolicy.ENABLED)
            .crossfade(true)
            .build(),
        contentDescription = "Баннер ${project.claimedName}",
        contentScale = ContentScale.Crop,
        onError = { err ->
            AppLogger.e("BannerImage", "Coil failed url=$effectiveUrl err=${err.result.throwable}")
            failed = true
        },
        modifier = modifier
            .fillMaxWidth()
            .aspectRatio(1408f / 768f)
            .clip(shape)
    )
}

@Composable
private fun BannerPlaceholder(
    projectName: String,
    modifier: Modifier,
    shape: RoundedCornerShape
) {
    Box(
        modifier = modifier
            .fillMaxWidth()
            .aspectRatio(1408f / 768f)
            .clip(shape)
            .background(MaterialTheme.colorScheme.surfaceVariant),
        contentAlignment = Alignment.Center
    ) {
        Text(
            text = projectName.take(2).uppercase(),
            style = MaterialTheme.typography.headlineLarge,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )
    }
}
