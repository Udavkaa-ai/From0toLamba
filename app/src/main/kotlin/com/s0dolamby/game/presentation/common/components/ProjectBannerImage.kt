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
import coil.request.CachePolicy
import coil.request.ImageRequest

@Composable
fun ProjectBannerImage(
    bannerUrl: String?,
    projectName: String,
    modifier: Modifier = Modifier
) {
    val shape = RoundedCornerShape(12.dp)

    if (bannerUrl != null) {
        var loadFailed by remember(bannerUrl) { mutableStateOf(false) }
        if (loadFailed) {
            BannerPlaceholder(projectName = projectName, modifier = modifier, shape = shape)
        } else {
            AsyncImage(
                model = ImageRequest.Builder(LocalContext.current)
                    .data(bannerUrl)
                    .diskCachePolicy(CachePolicy.ENABLED)
                    .memoryCachePolicy(CachePolicy.ENABLED)
                    .crossfade(true)
                    .build(),
                contentDescription = "Баннер $projectName",
                contentScale = ContentScale.Crop,
                onError = { loadFailed = true },
                modifier = modifier
                    .fillMaxWidth()
                    .height(180.dp)
                    .clip(shape)
            )
        }
    } else {
        BannerPlaceholder(projectName = projectName, modifier = modifier, shape = shape)
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
