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
        "rank.knyaz" to "Князь",

        // Settings
        "settings.title" to "Настройки",
        "settings.nickname.title" to "🧑‍🎤 Прозвище купца",
        "settings.nickname.hint" to "Покажем в шапке главной и в Зале славы. До 20 знаков.",
        "settings.nickname.placeholder" to "Гость",
        "settings.model.title" to "Нейросеть для текста",
        "settings.model.hint" to "Используется для бесед, вестей и генерации имён",
        "settings.minigames.title" to "Мини-игры (бета)",
        "settings.minigames.hint" to "Пока в стороне от инвест-цикла. Скоро будут условием входа в дело.",
        "settings.langTheme.title" to "Язык и тема",
        "settings.lang.title" to "🌐 Язык интерфейса",
        "settings.theme.title" to "🎨 Тема",
        "settings.about.title" to "О приложении",
        "settings.about.version" to "Версия %s · код %d",
        "settings.about.text" to "«Из грязи в князи» — симулятор купца-инвестора в сказочной Руси. Игра — для удовольствия. AI-беседы оплачиваются через OpenRouter.",
        "settings.about.faq" to "❓ ЧАВО — частые вопросы",
        "settings.danger.title" to "Опасная зона",
        "settings.danger.hint" to "Сброс удалит всё: злато, сделки, историю бесед. Игра начнётся заново с нуля.",
        "settings.danger.reset" to "Начать заново",
        "settings.reset.confirmTitle" to "Начать заново?",
        "settings.reset.confirmText" to "Все данные будут удалены. Это действие необратимо.",
        "settings.reset.confirmYes" to "Сбросить всё",
        "settings.faq.title" to "❓ ЧАВО",

        // Inbox
        "inbox.title" to "Входящие грамоты",
        "inbox.empty" to "Новых предложений нет",
        "inbox.empty.hint" to "Они появятся после следующего дня",
        "inbox.cta.minigame" to "🎲 Испытать дельца игрой →",
        "inbox.cta.ad" to "📺  Беседа в кабаке за просмотр рекламы",
        "inbox.investors" to "👥 %s вкладчиков",
        "inbox.ad.title" to "📺 Беседа за просмотр рекламы",
        "inbox.ad.body" to "Пока бесплатно — просмотр рекламы будет позже подключён через AdMob/Yandex. Сейчас просто открываем беседу с дельцом.",
        "inbox.ad.confirm" to "Смотреть и в кабак",

        // Stats
        "stats.title" to "Успехи купца",
        "stats.rank" to "Чин",
        "stats.hof.title" to "🏆 Зал славы",
        "stats.hof.empty" to "Закрой первое дело и заведи связь — здесь появятся твои достижения.",
        "stats.hof.bestDeal" to "Лучшая сделка",
        "stats.hof.worstLoss" to "Худшая потеря",
        "stats.hof.closeFriend" to "Близкий товарищ",
        "stats.hof.streak" to "Серия на ярмарке",
        "stats.feats.header" to "🏅 Подвиги — %d из %d",
        "stats.financial.title" to "Злато",
        "stats.balance.title" to "Ведомость казны",

        // Казна (портфолио)
        "portfolio.title" to "Казна",
        "portfolio.empty.title" to "Казна пуста",
        "portfolio.empty.hint" to "Поговори с Дельцами во Входящих грамотах и вложи гроши",
        "portfolio.section.active" to "Текущие вложения",
        "portfolio.section.closed" to "Летопись сделок",
        "portfolio.card.invested" to "Вложено",
        "portfolio.card.history" to "История стоимости",
        "portfolio.card.investors" to "👥 %s вкладчиков",
        "portfolio.card.locked" to "🔒 Вывод заблокирован — проект испытывает трудности",
        "portfolio.btn.addFunds" to "Довложить",
        "portfolio.btn.withdrawPart" to "Вывести часть",
        "portfolio.btn.leave" to "Покинуть",
        "portfolio.card.fee" to "ⓘ Комиссия 25% с каждого вывода",
        "portfolio.addSheet.title" to "Довложить в проект",
        "portfolio.addSheet.confirm" to "Довложить",
        "portfolio.addSheet.free" to "Свободно: %s",
        "portfolio.addSheet.amountLabel" to "Сумма в грошах",
        "portfolio.withdraw.title" to "Вывести из дела",
        "portfolio.withdraw.confirm" to "Вывести",
        "portfolio.withdraw.warnLong" to "⚠ Лимит: не более 25%% от вложенного за раз (%.0f г)",
        "portfolio.withdraw.warnFee" to "⚠ Комиссия за срочный вывод — 25%. Получишь 75% от суммы.",
        "portfolio.withdraw.netGain" to "Получишь на руки: %.0f г",
        "portfolio.withdraw.availLimit" to "Доступно: %.0f г • Лимит: %.0f г",
        "portfolio.closed.fallback" to "Закрыто",

        // Подробности дела (ProjectDetail)
        "detail.tab.about" to "О деле",
        "detail.tab.news" to "Новости",
        "detail.tab.chat" to "Беседа",
        "detail.section.metrics" to "Показатели",
        "detail.section.story" to "Описание",
        "detail.metric.invested" to "Вложено",
        "detail.metric.current" to "Сейчас стоит",
        "detail.metric.pnl" to "Прибыль",
        "detail.metric.apy" to "Посул (APY)",
        "detail.metric.days" to "Дней в деле",
        "detail.news.empty" to "Пока вестей нет",
        "detail.btn.openChat" to "Открыть беседу"
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
        "rank.knyaz" to "Prince",

        // Settings
        "settings.title" to "Settings",
        "settings.nickname.title" to "🧑‍🎤 Merchant nickname",
        "settings.nickname.hint" to "Shown in the home header and Hall of Fame. Up to 20 characters.",
        "settings.nickname.placeholder" to "Guest",
        "settings.model.title" to "Text AI model",
        "settings.model.hint" to "Used for chats, news and name generation",
        "settings.minigames.title" to "Mini-games (beta)",
        "settings.minigames.hint" to "Currently outside the investment cycle. Soon required to enter a deal.",
        "settings.langTheme.title" to "Language and theme",
        "settings.lang.title" to "🌐 UI language",
        "settings.theme.title" to "🎨 Theme",
        "settings.about.title" to "About",
        "settings.about.version" to "Version %s · code %d",
        "settings.about.text" to "From Mud to Glory — a merchant-investor sim in fairytale Russia. The game is for fun. AI chats run through OpenRouter.",
        "settings.about.faq" to "❓ FAQ — frequent questions",
        "settings.danger.title" to "Danger zone",
        "settings.danger.hint" to "Reset wipes everything: gold, deals, chat history. The game starts from scratch.",
        "settings.danger.reset" to "Start over",
        "settings.reset.confirmTitle" to "Start over?",
        "settings.reset.confirmText" to "All data will be deleted. This is irreversible.",
        "settings.reset.confirmYes" to "Reset everything",
        "settings.faq.title" to "❓ FAQ",

        // Inbox
        "inbox.title" to "Incoming charters",
        "inbox.empty" to "No new offers",
        "inbox.empty.hint" to "They will appear after the next day",
        "inbox.cta.minigame" to "🎲 Test the merchant with a game →",
        "inbox.cta.ad" to "📺  Tavern talk in exchange for an ad",
        "inbox.investors" to "👥 %s investors",
        "inbox.ad.title" to "📺 Talk after watching an ad",
        "inbox.ad.body" to "Free for now — ads will be wired through AdMob/Yandex later. For now we just open the chat with the merchant.",
        "inbox.ad.confirm" to "Watch and head to the tavern",

        // Stats
        "stats.title" to "Merchant feats",
        "stats.rank" to "Rank",
        "stats.hof.title" to "🏆 Hall of Fame",
        "stats.hof.empty" to "Close your first deal and forge a bond — your milestones will appear here.",
        "stats.hof.bestDeal" to "Best deal",
        "stats.hof.worstLoss" to "Worst loss",
        "stats.hof.closeFriend" to "Close friend",
        "stats.hof.streak" to "Streak at the fair",
        "stats.feats.header" to "🏅 Feats — %d of %d",
        "stats.financial.title" to "Gold",
        "stats.balance.title" to "Treasury ledger",

        // Treasury (portfolio)
        "portfolio.title" to "Treasury",
        "portfolio.empty.title" to "Treasury is empty",
        "portfolio.empty.hint" to "Talk to merchants in the Charters and invest some coins",
        "portfolio.section.active" to "Active investments",
        "portfolio.section.closed" to "Deal chronicle",
        "portfolio.card.invested" to "Invested",
        "portfolio.card.history" to "Value history",
        "portfolio.card.investors" to "👥 %s investors",
        "portfolio.card.locked" to "🔒 Withdrawals locked — the project is in trouble",
        "portfolio.btn.addFunds" to "Add funds",
        "portfolio.btn.withdrawPart" to "Withdraw part",
        "portfolio.btn.leave" to "Leave",
        "portfolio.card.fee" to "ⓘ 25% fee on every withdrawal",
        "portfolio.addSheet.title" to "Add to the venture",
        "portfolio.addSheet.confirm" to "Add",
        "portfolio.addSheet.free" to "Free: %s",
        "portfolio.addSheet.amountLabel" to "Amount in coins",
        "portfolio.withdraw.title" to "Withdraw from the venture",
        "portfolio.withdraw.confirm" to "Withdraw",
        "portfolio.withdraw.warnLong" to "⚠ Limit: at most 25%% of invested per withdrawal (%.0f c)",
        "portfolio.withdraw.warnFee" to "⚠ Early-exit fee 25%. You receive 75% of the amount.",
        "portfolio.withdraw.netGain" to "You receive: %.0f c",
        "portfolio.withdraw.availLimit" to "Available: %.0f c • Limit: %.0f c",
        "portfolio.closed.fallback" to "Closed",

        // Project detail
        "detail.tab.about" to "About",
        "detail.tab.news" to "News",
        "detail.tab.chat" to "Chat",
        "detail.section.metrics" to "Metrics",
        "detail.section.story" to "Description",
        "detail.metric.invested" to "Invested",
        "detail.metric.current" to "Current value",
        "detail.metric.pnl" to "Profit",
        "detail.metric.apy" to "Claimed APY",
        "detail.metric.days" to "Days in venture",
        "detail.news.empty" to "No news yet",
        "detail.btn.openChat" to "Open chat"
    )
}
