package com.s0dolamby.game.presentation.common.theme

import androidx.compose.runtime.compositionLocalOf
import androidx.compose.ui.graphics.Color
import com.s0dolamby.game.domain.model.ThemeMode

/**
 * Палитра, через которую все экраны получают свои цвета.
 *
 * Две темы концептуально РАЗНЫЕ, не просто перекрашенные:
 *  - DARK_FAIRY: фиолетово-сапфировая ночь. Карточки ТЁМНЫЕ, текст БЕЛЫЙ.
 *  - WARM_FAIRY: «сказочно-русская ярмарка». Фон — медовое дерево, но
 *    КАРТОЧКИ-СВИТКИ светлые пергаментные, текст — тёмная сепия.
 *
 * Поэтому каждая палитра несёт свои `cardTop/Mid/Bottom` и `onCard*`-цвета.
 * FairyCard читает их из [LocalAppPalette] (а LocalContentColor —
 * провайдится в onCard, чтобы Text-ы без явного `color =` подхватывали
 * правильный по теме).
 */
data class AppPalette(
    val fairyGold: Color,
    val enchantedPurple: Color,
    val nightBlue: Color,
    val success: Color,
    val error: Color,
    val warning: Color,
    val accent: Color,
    val ranks: RankPalette,
    // Градиент поверхности карточки (top → bottom).
    val cardTop: Color,
    val cardMid: Color,
    val cardBottom: Color,
    // Рамки карточки.
    val cardBorder: Color,
    val cardBorderBright: Color,
    // Цвета текста на карточке — белый на тёмной, тёмная сепия на пергаменте.
    val onCard: Color,
    val onCardSecondary: Color,
    val onCardMuted: Color,
    /**
     * Акцентный «золотой» цвет ДЛЯ ТЕКСТА на карточке: в тёмной — обычное
     * #FFB800 (классическое золото на фиолете); в тёплой — глубокий
     * бронзово-янтарный, чтобы заголовки/числа выделялись, но не сливались
     * с пергаментом как обычный FairyGold.
     */
    val accentOnCard: Color,
    // Фон экрана: тёмный градиент над bg-картинкой в DARK, тёплый янтарный
    // ореол + виньетка в WARM (картинка bg должна просвечивать).
    val screenBgTop: Color,
    val screenBgMid: Color,
    val screenBgBottom: Color
)

data class RankPalette(
    val bronze: Color,
    val silver: Color,
    val gold: Color,
    val platinum: Color
)

private val SharedRankPalette = RankPalette(
    bronze = Color(0xFFCD7F32),
    silver = Color(0xFFC8D0DA),
    gold = Color(0xFFFFB800),
    platinum = Color(0xFFE5E4E2)
)

val DarkFairyPalette = AppPalette(
    fairyGold = Color(0xFFFFB800),
    enchantedPurple = Color(0xFF2A1960),
    nightBlue = Color(0xFF0D1735),
    success = Color(0xFF4CAF50),
    error = Color(0xFFFF5252),
    warning = Color(0xFFFFC107),
    accent = Color(0xFF7B5EA7),
    ranks = SharedRankPalette,
    cardTop = Color(0xE02A1960),                    // EnchantedPurple, 88%
    cardMid = Color(0xEB22104A),                    // глубокий фиолет, 92%
    cardBottom = Color(0xF50D1735),                 // NightBlue, 96%
    cardBorder = Color(0x1FFFB800),                 // золото 12%
    cardBorderBright = Color(0x59FFB800),           // золото 35%
    onCard = Color(0xFFFFFFFF),
    onCardSecondary = Color(0xB3FFFFFF),            // 70%
    onCardMuted = Color(0x73FFFFFF),                // 45%
    accentOnCard = Color(0xFFFFB800),               // золото на тёмном фоне
    screenBgTop = Color(0xD9060412),
    screenBgMid = Color(0xBF0A0818),
    screenBgBottom = Color(0xF0060412)
)

val WarmFairyPalette = AppPalette(
    fairyGold = Color(0xFFFFB800),
    enchantedPurple = Color(0xFF6E4422),            // дуб медового тона
    nightBlue = Color(0xFF3A1F0A),                  // глубокое дерево
    success = Color(0xFF2E8B57),                    // изумруд (на светлом нужен темнее)
    error = Color(0xFFB02828),                      // карминовая печать
    warning = Color(0xFFC58000),                    // тёплый янтарь
    accent = Color(0xFFD4A017),
    ranks = SharedRankPalette,
    // Пергамент: светлая бумага под рукой — карточка ВЫПРЫГИВАЕТ из тёмного дерева.
    cardTop = Color(0xFCF5E6C3),                    // светлый пергамент
    cardMid = Color(0xFFE8D5A8),                    // основной пергамент
    cardBottom = Color(0xFFD9C28A),                 // плотный пергамент снизу
    cardBorder = Color(0xD9784C24),                 // тёмная деревянная рамка
    cardBorderBright = Color(0xFFD4A03C),           // золотой кант (активная)
    onCard = Color(0xFF1A0E04),                     // почти чёрная сепия — главный текст
    onCardSecondary = Color(0xEB1A0E04),            // 92%
    onCardMuted = Color(0xC71A0E04),                // 78%
    accentOnCard = Color(0xFF8B5A00),               // тёмная бронза, читается на пергаменте
    // Тёплый янтарный ореол + виньетка по краям — bg-картинка должна
    // просвечивать («ярмарка в золотое полуденное время»).
    screenBgTop = Color(0x385A3818),                // 22%
    screenBgMid = Color(0x255A3818),                // 14%
    screenBgBottom = Color(0x59523418)              // 35%
)

val LocalAppPalette = compositionLocalOf { DarkFairyPalette }

/** Текущая тема — нужен помощникам выбора _LIGHT/_DARK ресурсов вне Material. */
val LocalThemeMode = compositionLocalOf { ThemeMode.DARK_FAIRY }

/**
 * Цвет для второстепенного текста на карточке (под заголовком, метаданные).
 * В DARK — белый с alpha 0.7; в WARM — тёмная сепия с alpha 0.9, иначе
 * на пергаменте сливается с фоном.
 *
 * Использовать ВМЕСТО `LocalContentColor.current.copy(alpha = 0.55..0.7)`
 * для надёжной читаемости на пергаменте.
 */
val LocalContentColorSecondary = compositionLocalOf {
    androidx.compose.ui.graphics.Color(0xB3FFFFFF)  // 70% white по умолчанию
}

/**
 * Цвет для совсем приглушённого текста — подписи, дисклеймеры, единицы.
 * В DARK — белый с alpha 0.5; в WARM — тёмная сепия с alpha 0.75.
 */
val LocalContentColorMuted = compositionLocalOf {
    androidx.compose.ui.graphics.Color(0x80FFFFFF)  // 50% white
}

/**
 * «Золотой» акцент для текста ВНУТРИ FairyCard — в тёмной теме это
 * #FFB800, в тёплой — глубокий бронзово-янтарный (читается на пергаменте).
 * Используется для заголовков секций («О приложении», «Язык и тема»),
 * чисел типа баланса или ROI, и т.п.
 *
 * Использовать ВМЕСТО прямого `FairyGold`/`color = FairyGold` в местах,
 * где текст лежит на cardTop/Mid/Bottom фоне.
 */
val LocalAccentOnCard = compositionLocalOf {
    androidx.compose.ui.graphics.Color(0xFFFFB800)  // классическое золото по умолчанию
}
