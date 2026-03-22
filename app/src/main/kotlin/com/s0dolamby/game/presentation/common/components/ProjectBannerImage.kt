package com.s0dolamby.game.presentation.common.components

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
import coil.network.HttpException
import coil.request.CachePolicy
import coil.request.ImageRequest
import com.s0dolamby.game.data.logging.AppLogger

/** Strips &nologo=true&key=... and ?key=... from a Pollinations URL */
private fun urlWithoutKey(url: String): String =
    url.replace(Regex("&nologo=true&key=[^&]+"), "")
       .replace(Regex("[?&]key=[^&]+"), "")

@Composable
fun ProjectBannerImage(
    bannerUrl: String?,
    projectName: String,
    modifier: Modifier = Modifier
) {
    val shape = RoundedCornerShape(12.dp)

    if (bannerUrl != null) {
        // null = loading/first try, true = key-url failed, false = placeholder needed
        var keyFailed  by remember(bannerUrl) { mutableStateOf(false) }
        var allFailed  by remember(bannerUrl) { mutableStateOf(false) }

        val activeUrl = if (keyFailed) urlWithoutKey(bannerUrl) else bannerUrl

        when {
            allFailed -> BannerPlaceholder(projectName, modifier, shape)
            else -> AsyncImage(
                model = ImageRequest.Builder(LocalContext.current)
                    .data(activeUrl)
                    .diskCachePolicy(CachePolicy.ENABLED)
                    .memoryCachePolicy(CachePolicy.ENABLED)
                    .crossfade(true)
                    .build(),
                contentDescription = "Баннер $projectName",
                contentScale = ContentScale.Crop,
                onError = { err ->
                    val is402 = (err.result.throwable as? HttpException)?.response?.code == 402
                    if (!keyFailed && is402) {
                        AppLogger.i("BannerImage", "402 with key → retry without key: $activeUrl")
                        keyFailed = true
                    } else {
                        AppLogger.e("BannerImage", "Coil failed url=$activeUrl err=${err.result.throwable}")
                        allFailed = true
                    }
                },
                modifier = modifier
                    .fillMaxWidth()
                    .height(180.dp)
                    .clip(shape)
            )
        }
    } else {
        BannerPlaceholder(projectName, modifier, shape)
    }
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
            .height(180.dp)
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
