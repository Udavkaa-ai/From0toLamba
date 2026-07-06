package com.s0dolamby.game.presentation.onboarding

import androidx.compose.runtime.mutableStateMapOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Rect
import androidx.compose.ui.layout.boundsInRoot
import androidx.compose.ui.layout.onGloballyPositioned

/**
 * Блоки интерфейса, которые тур подсвечивает спотлайтом. Тур сам открывает
 * нужную страницу и подсвечивает на ней конкретный блок.
 */
enum class TourTarget {
    HOME_MAIN,        // казна/чин на Главной
    NEXT_DAY,         // кнопка «Следующий день»
    FEEDBACK,         // язычок «Тестерам»
    INBOX_MAIN,       // грамота-предложение
    PORTFOLIO_MAIN,   // карточка вложения
    STATS_MAIN,       // чин/подвиги/наука
    TODAY_MAIN,       // награда дня / рейтинг
    SETTINGS_PREFS,   // язык, тема, звук, музыка
    SETTINGS_RESET    // сброс прогресса
}

/**
 * Живой реестр экранных координат подсвечиваемых элементов. Каждый элемент
 * через [tourAnchor] пишет сюда свои границы в координатах корня, а оверлей
 * тура рисует «дыру» в затемнении ровно по этим границам — подсвечивается
 * настоящий элемент, а не его макет. mutableStateMap — оверлей сам
 * перерисуется, когда границы посчитаются/изменятся.
 */
object TourAnchors {
    val bounds = mutableStateMapOf<TourTarget, Rect>()

    /**
     * Блок, который тур подсвечивает прямо сейчас. Экраны могут на это
     * реагировать — например, прокрутить свой список так, чтобы нужный
     * элемент оказался на виду (кнопка «Следующий день» внизу Главной).
     */
    val activeTarget = mutableStateOf<TourTarget?>(null)
}

/** Пометить композуемый элемент якорем тура — он сообщит свои координаты. */
fun Modifier.tourAnchor(target: TourTarget): Modifier =
    this.onGloballyPositioned { TourAnchors.bounds[target] = it.boundsInRoot() }
