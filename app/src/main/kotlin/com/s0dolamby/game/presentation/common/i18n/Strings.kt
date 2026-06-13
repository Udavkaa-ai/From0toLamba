package com.s0dolamby.game.presentation.common.i18n

import androidx.compose.runtime.Composable
import androidx.compose.runtime.ReadOnlyComposable
import androidx.compose.runtime.compositionLocalOf

/**
 * Лёгкая in-memory i18n: одна @Composable `t(...)` функция читает
 * активный язык из [LocalLanguage] и достаёт строку из RU/EN-словаря.
 *
 * Покрывает топ-50 самых заметных строк (главная, BottomNav, Сегодня,
 * ключевые кнопки). Не покрытые ключи возвращают сами себя — это даёт
 * нашему UI gracefully дегенерироваться до русского, если кто-то
 * добавит новую строку без перевода.
 */

val LocalLanguage = compositionLocalOf { "ru" }

object Strings {
    @Composable
    @ReadOnlyComposable
    fun t(key: String, vararg args: Any): String {
        val lang = LocalLanguage.current
        val raw = (if (lang == "en") EN else RU)[key] ?: key
        return if (args.isEmpty()) raw else raw.format(*args)
    }

    private val RU: Map<String, String> = mapOf(
        // BottomNav
        "nav.home" to "Главная",
        "nav.inbox" to "Грамоты",
        "nav.portfolio" to "Казна",
        "nav.stats" to "Успехи",
        "nav.today" to "Сегодня",

        // Главная
        "home.title" to "Из грязи в князи",
        "home.subtitle" to "✦ %s ✦",
        "home.subtitle.day" to "День %d · %s",
        "home.subtitle.nickedDay" to "%s · День %d · %s",
        "home.balance.free" to "Свободные гроши",
        "home.metric.invested" to "Вложено",
        "home.metric.received" to "Получено",
        "home.metric.total" to "Итог",
        "home.metric.dealsTaken" to "Дел взято",
        "home.section.active" to "✦ Активные дела (%d)",
        "home.section.inbox" to "✦ Входящие грамоты (%d)",
        "home.inbox.empty" to "Казна пуста",
        "home.inbox.empty.hint" to "Открой Грамоты — там ждут новые дельцы. Поговори с каждым и реши, достойно ли дело твоих грошей.",
        "home.inbox.openCharters" to "Открыть грамоты",
        "home.relations.title" to "🤝  Отношения с дельцами",
        "home.letopis" to "Летопись",
        "home.nextDay" to "🌅  Следующий день",
        "home.nextDay.loading" to "⏳  Течёт время...",
        "home.inboxPromo" to "Новые предложения ждут тебя",
        "home.inboxPromo.sub" to "Открой и поговори с хозяевами →",

        // Сегодня
        "today.title" to "Сегодня",
        "today.subtitle" to "Дневной ритуал, награды за серию и купеческий рейтинг",
        "today.youAtFair" to "Ты на ярмарке",
        "today.dayOne" to "день подряд",
        "today.dayMany" to "дней подряд",
        "today.claim" to "🎁  Забрать %d г",
        "today.claimed" to "✅ Награда сегодня уже забрана",
        "today.claimed.hint" to "Возвращайся завтра — серия не оборвётся, если зайдёшь до конца следующего дня.",
        "today.ladder" to "Лестница серии",
        "today.leaderboard" to "👑 Купеческий рейтинг",
        "today.soon" to "скоро",

        // Отношения
        "rel.title" to "Отношения с дельцами",
        "rel.subtitle" to "Уровни связи (0..%d) растут от закрытия дел дельца в плюс. Жетоны — мини-валюта архетипа: позже можно будет пропустить мини-игру.",
        "rel.sumTies" to "🎯 Сумма связей",
        "rel.knownOf" to "Знаком с %d из %d типажей",
        "rel.bonusPerLevel" to "Бонус за уровень",
        "rel.bonusPerDay" to "+%d%% / день",

        // Общие кнопки
        "btn.back" to "Назад",
        "btn.cancel" to "Отмена",
        "btn.gotIt" to "Понятно",
        "btn.continue" to "Продолжить",

        // Чины
        "rank.skomoroh" to "Скоморох",
        "rank.kupec" to "Купец",
        "rank.mudrec" to "Мудрец",
        "rank.boyarin" to "Боярин",
        "rank.knyaz" to "Князь"
    )

    private val EN: Map<String, String> = mapOf(
        // BottomNav
        "nav.home" to "Home",
        "nav.inbox" to "Charters",
        "nav.portfolio" to "Treasury",
        "nav.stats" to "Feats",
        "nav.today" to "Today",

        // Home
        "home.title" to "From Mud to Glory",
        "home.subtitle" to "✦ %s ✦",
        "home.subtitle.day" to "Day %d · %s",
        "home.subtitle.nickedDay" to "%s · Day %d · %s",
        "home.balance.free" to "Free coins",
        "home.metric.invested" to "Invested",
        "home.metric.received" to "Received",
        "home.metric.total" to "Total",
        "home.metric.dealsTaken" to "Deals taken",
        "home.section.active" to "✦ Active ventures (%d)",
        "home.section.inbox" to "✦ Incoming charters (%d)",
        "home.inbox.empty" to "Treasury is empty",
        "home.inbox.empty.hint" to "Open Charters — new merchants await. Talk to each one and decide whether their venture deserves your coins.",
        "home.inbox.openCharters" to "Open charters",
        "home.relations.title" to "🤝  Merchant relations",
        "home.letopis" to "Chronicle",
        "home.nextDay" to "🌅  Next day",
        "home.nextDay.loading" to "⏳  Time flows...",
        "home.inboxPromo" to "New offers await you",
        "home.inboxPromo.sub" to "Open and talk to the owners →",

        // Today
        "today.title" to "Today",
        "today.subtitle" to "Daily ritual, streak rewards and merchant ranking",
        "today.youAtFair" to "You at the fair",
        "today.dayOne" to "day in a row",
        "today.dayMany" to "days in a row",
        "today.claim" to "🎁  Claim %d c",
        "today.claimed" to "✅ Today's reward already claimed",
        "today.claimed.hint" to "Come back tomorrow — the streak survives if you show up before the next day ends.",
        "today.ladder" to "Streak ladder",
        "today.leaderboard" to "👑 Merchant ranking",
        "today.soon" to "soon",

        // Relationships
        "rel.title" to "Merchant relations",
        "rel.subtitle" to "Bond levels (0..%d) grow from closing the merchant's ventures in profit. Tokens are the archetype's mini-currency: later you'll be able to skip their mini-game.",
        "rel.sumTies" to "🎯 Total bonds",
        "rel.knownOf" to "Met %d of %d archetypes",
        "rel.bonusPerLevel" to "Bonus per level",
        "rel.bonusPerDay" to "+%d%% / day",

        // Common
        "btn.back" to "Back",
        "btn.cancel" to "Cancel",
        "btn.gotIt" to "Got it",
        "btn.continue" to "Continue",

        // Ranks
        "rank.skomoroh" to "Jester",
        "rank.kupec" to "Merchant",
        "rank.mudrec" to "Sage",
        "rank.boyarin" to "Boyar",
        "rank.knyaz" to "Prince"
    )
}
