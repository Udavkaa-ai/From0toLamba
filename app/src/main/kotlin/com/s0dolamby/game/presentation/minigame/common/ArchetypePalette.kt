package com.s0dolamby.game.presentation.minigame.common

import androidx.annotation.DrawableRes
import androidx.compose.ui.graphics.Color
import com.s0dolamby.game.R
import com.s0dolamby.game.domain.model.PersonaArchetype

/**
 * Визуальный паспорт архетипа для мини-игр:
 * - portraitRes — кружок-аватар в шапке
 * - primary / accent / shadow — палитра темы конкретной игры
 * - tagline — приветственная реплика дельца
 * - winPhrase / losePhrase — что говорит после игры
 */
data class ArchetypeStyle(
    @DrawableRes val portraitRes: Int,
    val primary: Color,
    val accent: Color,
    val shadow: Color,
    val tagline: String,
    val winPhrase: String,
    val losePhrase: String
)

object ArchetypePalette {

    operator fun get(archetype: PersonaArchetype): ArchetypeStyle =
        styles.getValue(archetype)

    private val styles = mapOf(
        PersonaArchetype.BURATINO to ArchetypeStyle(
            portraitRes = R.drawable.beseda_buratino,
            primary = Color(0xFFFFD54F),     // золотисто-жёлтый
            accent = Color(0xFFFF8F00),      // тёплая охра
            shadow = Color(0xFF4E2A00),      // тёмная бронза
            tagline = "Глянь, дружок, на мой ключик!",
            winPhrase = "Ну ты глазастый! Узнал моего золотого.",
            losePhrase = "Ха-ха, попался! Ключики-то похожи, да?"
        ),
        PersonaArchetype.BOYARIN to ArchetypeStyle(
            portraitRes = R.drawable.beseda_boyarin,
            primary = Color(0xFFFFB300),     // царское золото
            accent = Color(0xFF8E24AA),      // пышный пурпур
            shadow = Color(0xFF2A0E48),      // глубокий пурпур
            tagline = "Внемли, добрый человек, моим печатям…",
            winPhrase = "Зоркий ты! Печати мои не обманули.",
            losePhrase = "Ай-яй, подсунули тебе подделку!"
        ),
        PersonaArchetype.KOSCHEI to ArchetypeStyle(
            portraitRes = R.drawable.beseda_koschei,
            primary = Color(0xFF80DEEA),     // ледяной голубой
            accent = Color(0xFFCFD8DC),      // костяной серебристый
            shadow = Color(0xFF0E1F2A),      // ледяной чёрный
            tagline = "Запоминай, смертный. Память моя вечна.",
            winPhrase = "Хм. У тебя память не хуже моей.",
            losePhrase = "Что и требовалось доказать. Сгинул бы ты у меня."
        ),
        PersonaArchetype.KOLOBOK to ArchetypeStyle(
            portraitRes = R.drawable.beseda_kolobok,
            primary = Color(0xFFFFB74D),     // солнечный янтарь
            accent = Color(0xFFE65100),      // огненный оранж
            shadow = Color(0xFF3E1F00),      // тёмная корочка
            tagline = "Не догонишь меня, дружок! Я колобок, я хитёр!",
            winPhrase = "Ловок ты, не уйти от тебя.",
            losePhrase = "А вот и не угнался! Колобок укатился, хи-хи."
        ),
        PersonaArchetype.ZOLUSHKA to ArchetypeStyle(
            portraitRes = R.drawable.beseda_zolushka,
            primary = Color(0xFFFFCDD2),     // нежно-розовый
            accent = Color(0xFFEC407A),      // глубокий розовый
            shadow = Color(0xFF2A0F1A),      // тёмная вишня
            tagline = "Помоги, добрый человек, отделить настоящие монеты…",
            winPhrase = "Ой, спасибо тебе! Век тебя помнить буду.",
            losePhrase = "Эх, какое горе… не разглядел добрый человек."
        ),
        PersonaArchetype.BABA_YAGA to ArchetypeStyle(
            portraitRes = R.drawable.beseda_baba_yaga,
            primary = Color(0xFFAED581),     // болотный изумруд
            accent = Color(0xFF558B2F),      // тёмная зелень
            shadow = Color(0xFF1A2E0A),      // лесной чёрный
            tagline = "Запомни-ка рецептик, гость дорогой…",
            winPhrase = "Ну, голубчик, варить умеешь. Не пропадёшь.",
            losePhrase = "Эх, всё перепутал! Зелье-то теперь не моё, а твоё."
        ),
        PersonaArchetype.IVAN_DURAK to ArchetypeStyle(
            portraitRes = R.drawable.beseda_ivan_durak,
            primary = Color(0xFFFFAB91),     // тёплый рыжий
            accent = Color(0xFFD84315),      // огненный медный
            shadow = Color(0xFF2A0F00),      // печной чёрный
            tagline = "Я по третьему разу пробую. Глянь, как у меня?",
            winPhrase = "Молодец! У тебя с первого раза получилось.",
            losePhrase = "Не расстраивайся, я тоже с третьего раза догадался."
        )
    )
}
