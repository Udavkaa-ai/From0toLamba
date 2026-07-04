package com.s0dolamby.game.domain.achievements

import com.s0dolamby.game.domain.model.InvestorRank
import com.s0dolamby.game.domain.model.PersonaArchetype
import com.s0dolamby.game.domain.model.ProjectFate
import com.s0dolamby.game.domain.model.ProjectType

/**
 * Статический каталог подвигов. Условия — чистые функции от текущего
 * состояния игры. Перерасчёт делается в [com.s0dolamby.game.domain.
 * repository.GameStateRepository.recomputeAchievements] после каждой
 * значимой операции (advance-day, invest, exit).
 *
 * Каталог покрывает все 6 категорий из TG. Справочные подвиги
 * (bestiary.type/archetype/fate) несут [RevealTopic] — при разблокировке
 * открывают игроку запись «летописи» о породе/личине/судьбе.
 */
object AchievementCatalog {

    val ALL: List<Achievement> = buildList {
        // ─── 📜 Грамоты — закрытые/активные дела с участием в беседе ───────
        add(Achievement(
            id = "charters.first",
            category = AchievementCategory.CHARTERS,
            title = "Первая грамота",
            description = "Разобрал свою первую купеческую грамоту",
            emoji = "✍️"
        ) { _, projects -> projects.any { it.investedAmountRubles > 0 || it.isClosed } })
        add(Achievement(
            id = "charters.ten",
            category = AchievementCategory.CHARTERS,
            title = "Бывалый грамотей",
            description = "Разобрал 10 купеческих грамот",
            emoji = "📚"
        ) { _, projects -> projects.count { it.investedAmountRubles > 0 || it.isClosed } >= 10 })
        add(Achievement(
            id = "charters.fifty",
            category = AchievementCategory.CHARTERS,
            title = "Книжник-летописец",
            description = "Разобрал 50 купеческих грамот",
            emoji = "📖"
        ) { _, projects -> projects.count { it.investedAmountRubles > 0 || it.isClosed } >= 50 })

        // ─── ⚖️ Дела — закрытые ─────────────────────────────────────────────
        add(Achievement(
            id = "ventures.first",
            category = AchievementCategory.VENTURES,
            title = "Купец-новичок",
            description = "Закрыл первое дело",
            emoji = "🔔"
        ) { _, p -> p.count { it.isClosed && it.investedAmountRubles > 0 } >= 1 })
        add(Achievement(
            id = "ventures.five",
            category = AchievementCategory.VENTURES,
            title = "Купец-делец",
            description = "Закрыл 5 дел",
            emoji = "📦"
        ) { _, p -> p.count { it.isClosed && it.investedAmountRubles > 0 } >= 5 })
        add(Achievement(
            id = "ventures.twenty",
            category = AchievementCategory.VENTURES,
            title = "Купец-опытник",
            description = "Закрыл 20 дел",
            emoji = "🏪"
        ) { _, p -> p.count { it.isClosed && it.investedAmountRubles > 0 } >= 20 })
        add(Achievement(
            id = "ventures.profitable_five",
            category = AchievementCategory.VENTURES,
            title = "Удачливый делец",
            description = "Закрыл 5 дел в плюс",
            emoji = "📈"
        ) { _, p -> p.count { it.isClosed && it.currentValueRubles > it.investedAmountRubles && it.investedAmountRubles > 0 } >= 5 })
        add(Achievement(
            id = "ventures.unicorn",
            category = AchievementCategory.VENTURES,
            title = "Поймал единорога",
            description = "Закрыл дело-Жар-птицу в плюс",
            emoji = "🦄"
        ) { _, p -> p.any { it.isClosed && it.fate == ProjectFate.UNICORN && it.currentValueRubles > it.investedAmountRubles } })

        // ─── 💰 Богатство — баланс / совокупное состояние ────────────────────
        add(Achievement(
            id = "wealth.100",
            category = AchievementCategory.WEALTH,
            title = "Кошель полон",
            description = "Накопил 100 грошей в казне",
            emoji = "🪙"
        ) { s, _ -> s.balance + s.activeProjects.sumOf { it.currentValueRubles } >= 100.0 })
        add(Achievement(
            id = "wealth.1k",
            category = AchievementCategory.WEALTH,
            title = "Калита налита",
            description = "Накопил 1 000 грошей в казне",
            emoji = "💼"
        ) { s, _ -> s.balance + s.activeProjects.sumOf { it.currentValueRubles } >= 1_000.0 })
        add(Achievement(
            id = "wealth.10k",
            category = AchievementCategory.WEALTH,
            title = "Сундук червонцев",
            description = "Накопил 10 000 грошей в казне",
            emoji = "🏺"
        ) { s, _ -> s.balance + s.activeProjects.sumOf { it.currentValueRubles } >= 10_000.0 })
        add(Achievement(
            id = "wealth.100k",
            category = AchievementCategory.WEALTH,
            title = "Боярская казна",
            description = "Накопил 100 000 грошей в казне",
            emoji = "🪙"
        ) { s, _ -> s.balance + s.activeProjects.sumOf { it.currentValueRubles } >= 100_000.0 })

        // ─── 🏆 Чин — каждый купеческий ранг ─────────────────────────────────
        InvestorRank.values().filter { it != InvestorRank.NEWBIE }.forEach { rank ->
            add(Achievement(
                id = "rank.${rank.name.lowercase()}",
                category = AchievementCategory.RANK,
                title = rank.displayName,
                description = "Достиг чина «${rank.displayName}»",
                emoji = when (rank) {
                    InvestorRank.AMBASSADOR -> "🎭"
                    InvestorRank.ANALYST -> "📚"
                    InvestorRank.SHARK -> "🦈"
                    InvestorRank.LAMBO_SENSEI -> "👑"
                    InvestorRank.NEWBIE -> "🎪"
                }
            ) { s, _ -> s.investorRank.ordinal >= rank.ordinal })
        }

        // ─── 🤝 Связи — сумма уровней связи с дельцами ───────────────────────
        add(Achievement(
            id = "ties.first",
            category = AchievementCategory.TIES,
            title = "Первое знакомство",
            description = "Завёл связь хотя бы с одним дельцом",
            emoji = "🤝"
        ) { s, _ -> s.tieLevels.values.sum() >= 1 })
        add(Achievement(
            id = "ties.five",
            category = AchievementCategory.TIES,
            title = "В кругу своих",
            description = "Сумма уровней связи ≥ 5",
            emoji = "🍻"
        ) { s, _ -> s.tieLevels.values.sum() >= 5 })
        add(Achievement(
            id = "ties.twenty",
            category = AchievementCategory.TIES,
            title = "Свой на ярмарке",
            description = "Сумма уровней связи ≥ 20",
            emoji = "🎉"
        ) { s, _ -> s.tieLevels.values.sum() >= 20 })
        add(Achievement(
            id = "ties.fifty",
            category = AchievementCategory.TIES,
            title = "Купеческий клан",
            description = "Сумма уровней связи ≥ 50",
            emoji = "🏛️"
        ) { s, _ -> s.tieLevels.values.sum() >= 50 })

        // ─── 🗂️ Бестиарий — увидеть все архетипы / типы дел / судьбы ────────
        PersonaArchetype.values().forEach { arch ->
            val emoji = when (arch) {
                PersonaArchetype.BURATINO -> "🪆"
                PersonaArchetype.BOYARIN -> "👑"
                PersonaArchetype.KOLOBOK -> "🤗"
                PersonaArchetype.KOSCHEI -> "💀"
                PersonaArchetype.ZOLUSHKA -> "👠"
                PersonaArchetype.BABA_YAGA -> "🧙"
                PersonaArchetype.IVAN_DURAK -> "🃏"
            }
            val name = when (arch) {
                PersonaArchetype.BURATINO -> "Буратино"
                PersonaArchetype.BOYARIN -> "Боярин"
                PersonaArchetype.KOLOBOK -> "Колобок"
                PersonaArchetype.KOSCHEI -> "Кощей"
                PersonaArchetype.ZOLUSHKA -> "Золушка"
                PersonaArchetype.BABA_YAGA -> "Баба-Яга"
                PersonaArchetype.IVAN_DURAK -> "Иван-дурак"
            }
            add(Achievement(
                id = "bestiary.archetype.${arch.name.lowercase()}",
                category = AchievementCategory.BESTIARY,
                title = "Знакомец: $name",
                description = "Встретил архетип «$name»",
                emoji = emoji,
                revealTopic = RevealTopic(RevealKind.ARCHETYPE, arch.name)
            ) { _, p -> p.any { it.personaArchetype == arch && (it.investedAmountRubles > 0 || it.isClosed) } })
        }

        // ─── 🗂️ Бестиарий: породы дел — раскрывают запись летописи ──────────
        val typeMeta = mapOf(
            ProjectType.CARD_GAME to Triple("🎴", "Картёжный стол", "Закрой дело с породой «Азартная игра»"),
            ProjectType.TREASURE_HUNT to Triple("🗺️", "Тропой кладоискателя", "Закрой дело с породой «Поиск клада»"),
            ProjectType.POTION_BREW to Triple("🧪", "Котёл зельевара", "Закрой дело с породой «Зелейное дело»"),
            ProjectType.GUILD_SCHEME to Triple("⚙️", "Артельный подмастерье", "Закрой дело с породой «Артель»"),
            ProjectType.HONEST_TRADE to Triple("🤝", "Ряды ярмарочные", "Закрой дело с породой «Честная торговля»")
        )
        typeMeta.forEach { (type, meta) ->
            val (emoji, title, desc) = meta
            add(Achievement(
                id = "bestiary.type.${type.name.lowercase()}",
                category = AchievementCategory.BESTIARY,
                title = title,
                description = desc,
                emoji = emoji,
                revealTopic = RevealTopic(RevealKind.TYPE, type.name)
            ) { _, p -> p.any { it.type == type && it.isClosed && it.investedAmountRubles > 0 } })
        }

        // ─── 🗂️ Бестиарий: судьбы дел — раскрывают запись летописи ──────────
        val fateMeta = mapOf(
            ProjectFate.INSTANT_SCAM to Triple("💀", "Укус вора", "Переживи внезапное бегство хозяина с казной"),
            ProjectFate.SLOW_DRAIN to Triple("🌫️", "Тихий закат", "Увидь как дело медленно истлевает"),
            ProjectFate.HONEST_FAIL to Triple("😔", "Без удачи, но с честью", "Столкнись с честным провалом"),
            ProjectFate.SURVIVOR to Triple("⚓", "Крепкий якорь", "Доведи дело-долгожителя до достойного закрытия"),
            ProjectFate.UNICORN to Triple("🔥", "Поймал Жар-птицу за хвост", "Застань редчайшее дело, которое приумножает гроши в разы")
        )
        fateMeta.forEach { (fate, meta) ->
            val (emoji, title, desc) = meta
            add(Achievement(
                id = "bestiary.fate.${fate.name.lowercase()}",
                category = AchievementCategory.BESTIARY,
                title = title,
                description = desc,
                emoji = emoji,
                revealTopic = RevealTopic(RevealKind.FATE, fate.name)
            ) { _, p -> p.any { it.fate == fate && it.isClosed && it.investedAmountRubles > 0 } })
        }
        add(Achievement(
            id = "bestiary.all_fates",
            category = AchievementCategory.BESTIARY,
            title = "Все 5 судеб",
            description = "Закрыл дело каждой из пяти судеб — от мгновенного скама до Жар-птицы",
            emoji = "🎰"
        ) { _, p ->
            val seenFates = p.filter { it.isClosed && it.investedAmountRubles > 0 }
                .map { it.fate }.toSet()
            ProjectFate.values().all { it in seenFates }
        })
        add(Achievement(
            id = "bestiary.all_types",
            category = AchievementCategory.BESTIARY,
            title = "Все 5 видов дел",
            description = "Участвовал во всех типах: игра, клад, зелье, артель, торговля",
            emoji = "🧰"
        ) { _, p ->
            val seenTypes = p.filter { it.investedAmountRubles > 0 || it.isClosed }
                .map { it.type }.toSet()
            ProjectType.values().all { it in seenTypes }
        })
    }
}
