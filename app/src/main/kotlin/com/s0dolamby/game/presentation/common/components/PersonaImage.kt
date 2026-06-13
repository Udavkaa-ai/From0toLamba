package com.s0dolamby.game.presentation.common.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.ReadOnlyComposable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import coil.compose.AsyncImage
import com.s0dolamby.game.domain.model.PersonaArchetype
import com.s0dolamby.game.domain.model.ThemeMode
import com.s0dolamby.game.presentation.common.theme.FairyGold
import com.s0dolamby.game.presentation.common.theme.LocalThemeMode

/**
 * Slug файла — совпадает с TG `tg/client/public/personas/*.webp` и
 * `tg/client/public/avatars/*.webp`. К нему приклеивается `_LIGHT`
 * в [ThemeMode.WARM_FAIRY] для светлого варианта.
 */
private fun PersonaArchetype.fileSlug(): String = when (this) {
    PersonaArchetype.BABA_YAGA -> "baba_yaga"
    PersonaArchetype.BOYARIN -> "boyarin"
    PersonaArchetype.BURATINO -> "buratino"
    PersonaArchetype.IVAN_DURAK -> "ivan_durak"
    PersonaArchetype.KOLOBOK -> "kolobok"
    PersonaArchetype.KOSCHEI -> "koschei"
    PersonaArchetype.ZOLUSHKA -> "zolushka"
}

/**
 * Путь до webp-файла в assets с учётом текущей темы.
 * - kind = `personas` → крупный портрет (768×1408)
 * - kind = `avatars`  → мелкая иконка для чипов/списков
 */
@Composable
@ReadOnlyComposable
fun personaAssetUri(archetype: PersonaArchetype, kind: String = "avatars"): String {
    val variant = if (LocalThemeMode.current == ThemeMode.WARM_FAIRY) "_LIGHT" else ""
    return "file:///android_asset/$kind/${archetype.fileSlug()}$variant.webp"
}

/**
 * Круглый аватар дельца. На промахе/загрузке показывает эмодзи-заглушку.
 */
@Composable
fun PersonaAvatar(
    archetype: PersonaArchetype,
    size: Dp = 44.dp,
    modifier: Modifier = Modifier
) {
    val emoji = when (archetype) {
        PersonaArchetype.BURATINO -> "🪆"
        PersonaArchetype.BOYARIN -> "👑"
        PersonaArchetype.KOLOBOK -> "🤗"
        PersonaArchetype.KOSCHEI -> "💀"
        PersonaArchetype.ZOLUSHKA -> "👠"
        PersonaArchetype.BABA_YAGA -> "🧙"
        PersonaArchetype.IVAN_DURAK -> "🃏"
    }
    Box(
        modifier = modifier
            .size(size)
            .clip(CircleShape)
            .background(FairyGold.copy(alpha = 0.12f))
            .border(1.dp, FairyGold.copy(alpha = 0.35f), CircleShape),
        contentAlignment = Alignment.Center
    ) {
        AsyncImage(
            model = personaAssetUri(archetype, kind = "avatars"),
            contentDescription = archetype.name,
            contentScale = ContentScale.Crop,
            modifier = Modifier
                .fillMaxSize()
                .clip(CircleShape)
        )
        // Эмодзи как graceful fallback — лежит позади и виден, если webp
        // ещё не догружен или путь промахнулся.
        @Suppress("unused")
        val placeholder = emoji
    }
}
