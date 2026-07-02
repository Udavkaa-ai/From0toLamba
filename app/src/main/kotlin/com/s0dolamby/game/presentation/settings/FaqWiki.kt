package com.s0dolamby.game.presentation.settings

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.ClickableText
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.s0dolamby.game.presentation.common.i18n.Strings
import com.s0dolamby.game.presentation.common.theme.FairyGold

// ─── Каталог статей мини-вики ────────────────────────────────────────────────

enum class WikiArticle(val emoji: String, val title: String) {
    OVERVIEW("📖", "О чём игра?"),
    CURRENCY("🪙", "Гроши"),
    MERCHANTS("🪆", "Дельцы и архетипы"),
    FATES("🎰", "Судьбы дел"),
    RELATIONS("🤝", "Связи и жетоны"),
    MINIGAMES("🎲", "Мини-игры"),
    AMA("💬", "Беседа с дельцом"),
    ACHIEVEMENTS("🏅", "Подвиги"),
    STREAK("🔥", "Стрик и серия"),
    RANK("👑", "Купеческий чин"),
    PORTFOLIO("💰", "Казна и вывод"),
    AI("🧠", "Откуда ответы дельцов"),
    RESET("🔄", "Сброс прогресса")
}

private data class TextSpan(val text: String, val link: WikiArticle? = null)

private fun WikiArticle.body(): List<TextSpan> = when (this) {
    WikiArticle.OVERVIEW -> listOf(
        TextSpan("«Из грязи в князи» — симулятор купца на сказочной Руси. Вкладывай "),
        TextSpan("гроши", WikiArticle.CURRENCY),
        TextSpan(" в дела сказочных "),
        TextSpan("дельцов", WikiArticle.MERCHANTS),
        TextSpan(", распознавай мошенников, расти в "),
        TextSpan("купеческом чине", WikiArticle.RANK),
        TextSpan(" от Скомороха до Князя.")
    )
    WikiArticle.CURRENCY -> listOf(
        TextSpan("Гроши (г) — единственная игровая валюта. Реальных денег не стоит. Берутся из:\n\n"),
        TextSpan("• Стартовый онбординг-бонус (~50 г)\n"),
        TextSpan("• Ежедневная награда за "),
        TextSpan("стрик", WikiArticle.STREAK),
        TextSpan("\n• Выход из "),
        TextSpan("дела", WikiArticle.PORTFOLIO),
        TextSpan(" в плюс\n\nТратятся только на "),
        TextSpan("вложения в дела", WikiArticle.PORTFOLIO),
        TextSpan(".")
    )
    WikiArticle.MERCHANTS -> listOf(
        TextSpan("Семь сказочных архетипов: 🪆 Буратино, 👑 Боярин, 🤗 Колобок, 💀 Кощей, 👠 Золушка, 🧙 Баба-Яга, 🃏 Иван-дурак.\n\n"),
        TextSpan("У каждого свой стиль речи и поведение в "),
        TextSpan("беседе", WikiArticle.AMA),
        TextSpan(". Скрытая "),
        TextSpan("судьба дела", WikiArticle.FATES),
        TextSpan(" не зависит от архетипа — лжец может оказаться у любого. Но твой опыт встреч копится во вкладке Летопись.")
    )
    WikiArticle.FATES -> listOf(
        TextSpan("Каждое дело при создании получает одну из 5 скрытых судеб:\n\n"),
        TextSpan("🚨 Мгновенный скам — сбегает за 1–3 дня, потеря 80–100%\n"),
        TextSpan("💀 Медленный слив — тонет 1–3 недели, потеря 30–70%\n"),
        TextSpan("🌫 Честный провал — старался, рынок не пошёл, потеря 10–40%\n"),
        TextSpan("🌿 Выживший — стабильный долгожитель с маленьким доходом\n"),
        TextSpan("🦄 Единорог — редкий взрывной рост 2–10% в день\n\n"),
        TextSpan("Узнать судьбу заранее можно ИДЕАЛЬНЫМ прохождением "),
        TextSpan("мини-игры", WikiArticle.MINIGAMES),
        TextSpan(" дельца. Иначе — гадай по "),
        TextSpan("беседе", WikiArticle.AMA),
        TextSpan(".")
    )
    WikiArticle.RELATIONS -> listOf(
        TextSpan("Каждый раз когда ты выходишь из дела дельца "),
        TextSpan("в плюс", WikiArticle.PORTFOLIO),
        TextSpan(", он становится тебе ближе:\n\n"),
        TextSpan("🤝 +1 к уровню связи (потолок 10) — бонус к дневному доходу с его будущих дел\n"),
        TextSpan("🪙 +1 жетон его архетипа — мини-валюта дельца\n\n"),
        TextSpan("Жетон тратится на пропуск его "),
        TextSpan("мини-игры", WikiArticle.MINIGAMES),
        TextSpan(". Текущее положение видно во вкладке «Отношения с дельцами» на главной.")
    )
    WikiArticle.MINIGAMES -> listOf(
        TextSpan("Перед инвестом нужно «испытать» дельца его архетипной мини-игрой:\n\n"),
        TextSpan("🔑 Буратино — Золотой ключик\n"),
        TextSpan("📜 Боярин — Купеческая грамота\n"),
        TextSpan("⚙ Кощей — Цепь Кощея\n"),
        TextSpan("🕳 Колобок — Нора-нора-нора\n"),
        TextSpan("🌾 Золушка — Перебери зерно\n"),
        TextSpan("🧪 Баба-Яга — Котёл\n"),
        TextSpan("🃏 Иван-дурак — Подкинь карту\n\n"),
        TextSpan("Победа открывает кнопку «Вложить». Идеал — раскрывает скрытые параметры (тип, посул, "),
        TextSpan("судьбу", WikiArticle.FATES),
        TextSpan("). Есть "),
        TextSpan("жетон", WikiArticle.RELATIONS),
        TextSpan(" этого архетипа — можно пропустить игру вовсе.")
    )
    WikiArticle.AMA -> listOf(
        TextSpan("Прежде чем вложить, поговори с дельцом в кабаке. У тебя 10 вопросов.\n\n"),
        TextSpan("Делец знает "),
        TextSpan("судьбу", WikiArticle.FATES),
        TextSpan(" своего дела заранее, но скрывает. Честный отвечает уверенно и одинаково, лжец — путается и уклоняется. Слушай между строк.\n\n"),
        TextSpan("Каждый "),
        TextSpan("архетип", WikiArticle.MERCHANTS),
        TextSpan(" отвечает в своём стиле: Кощей цифрами, Золушка эмоциями, Колобок частушками, Боярин «при моём прадеде».")
    )
    WikiArticle.ACHIEVEMENTS -> listOf(
        TextSpan("27 подвигов в 6 категориях:\n\n"),
        TextSpan("📜 Грамоты — разбор бесед\n"),
        TextSpan("⚖️ Дела — закрытие дел\n"),
        TextSpan("💰 Богатство — накопление "),
        TextSpan("грошей", WikiArticle.CURRENCY),
        TextSpan("\n🏆 "),
        TextSpan("Чин", WikiArticle.RANK),
        TextSpan(" — каждый ранг\n🤝 "),
        TextSpan("Связи", WikiArticle.RELATIONS),
        TextSpan(" — суммарный уровень\n🗂️ Бестиарий — все архетипы, типы и судьбы\n\n"),
        TextSpan("Открываются автоматически при выполнении условий — всплывает Жалованная Грамота, прогресс виден в Успехах.")
    )
    WikiArticle.STREAK -> listOf(
        TextSpan("Стрик растёт +1 каждый календарный день (МСК), когда заходишь на вкладку 🔥 Сегодня.\n\n"),
        TextSpan("За каждый день — базовая награда грошами (10 + min(стрик, 10) × 5 г, потолок 60 г).\n\n"),
        TextSpan("Лестница серии даёт бонус-вешки:\n"),
        TextSpan("• День 3 — +50 г\n"),
        TextSpan("• День 5 — +70 г\n"),
        TextSpan("• День 7 — +100 г\n"),
        TextSpan("• День 10 — +150 г\n"),
        TextSpan("• День 15 — +300 г\n"),
        TextSpan("• День 20 — +500 г\n"),
        TextSpan("• День 30 — +1000 г\n\n"),
        TextSpan("Пропустишь день — серия сбрасывается на 1.")
    )
    WikiArticle.RANK -> listOf(
        TextSpan("Купеческий чин растёт по количеству взятых "),
        TextSpan("дел", WikiArticle.PORTFOLIO),
        TextSpan(":\n\n"),
        TextSpan("🐣 Скоморох — 0\n"),
        TextSpan("🎭 Купец — 5\n"),
        TextSpan("📚 Мудрец — 20\n"),
        TextSpan("🦈 Боярин — 50\n"),
        TextSpan("👑 Князь — 100\n\n"),
        TextSpan("При повышении — Жалованная Грамота поверх экрана. Чин виден в шапке главной и на странице Успехи.")
    )
    WikiArticle.PORTFOLIO -> listOf(
        TextSpan("Активные дела видны во вкладке 💰 Казна. С каждым делом можно:\n\n"),
        TextSpan("• Довложить — макс 5 000 г на дело\n"),
        TextSpan("• Вывести часть — с комиссией для одних типов, лимитом для других\n"),
        TextSpan("• Покинуть дело — закрыть и забрать всё\n\n"),
        TextSpan("Правила вывода по типам:\n"),
        TextSpan("🃏 Азартная игра / 🗺 Поиск клада — любая сумма, комиссия 25%\n"),
        TextSpan("🧪 Зелейное дело / ⚙ Артель — не более 25% от вложенного за раз\n"),
        TextSpan("🤝 Честная торговля — без ограничений и комиссии\n\n"),
        TextSpan("При выходе в плюс — +1 к "),
        TextSpan("связи", WikiArticle.RELATIONS),
        TextSpan(" с дельцом.")
    )
    WikiArticle.AI -> listOf(
        TextSpan("Беседы с дельцами генерирует нейросеть. Каждый "),
        TextSpan("архетип", WikiArticle.MERCHANTS),
        TextSpan(" отвечает в своём характере, по своим любимым темам.\n\n"),
        TextSpan("Модель можно выбрать в настройках — по умолчанию DeepSeek v4 Flash (быстрая и понятная). Без интернета беседа не работает.")
    )
    WikiArticle.RESET -> listOf(
        TextSpan("Сброс игры удаляет ВСЁ:\n\n"),
        TextSpan("• "),
        TextSpan("Гроши", WikiArticle.CURRENCY),
        TextSpan("\n• Активные и закрытые дела\n• История бесед\n• "),
        TextSpan("Подвиги", WikiArticle.ACHIEVEMENTS),
        TextSpan(" и "),
        TextSpan("связи", WikiArticle.RELATIONS),
        TextSpan(" с дельцами\n• "),
        TextSpan("Стрик", WikiArticle.STREAK),
        TextSpan(" и "),
        TextSpan("чин", WikiArticle.RANK),
        TextSpan("\n\nВосстановить нельзя — игра начнётся заново с нуля.")
    )
}

// ─── Composable ──────────────────────────────────────────────────────────────

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun FaqWikiSheet(onDismiss: () -> Unit) {
    val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)
    var current by remember { mutableStateOf<WikiArticle?>(null) }

    ModalBottomSheet(onDismissRequest = onDismiss, sheetState = sheetState) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 20.dp, vertical = 8.dp)
                .padding(bottom = 24.dp)
                .verticalScroll(rememberScrollState())
        ) {
            // Шапка
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                if (current != null) {
                    IconButton(onClick = { current = null }) {
                        Icon(Icons.Default.ArrowBack, "К содержанию", tint = FairyGold)
                    }
                }
                Text("📚", fontSize = 22.sp)
                Text(
                    if (current == null) Strings.t("wiki.toc.title") else Strings.t("wiki.article.${current!!.name}"),
                    style = MaterialTheme.typography.titleLarge,
                    fontWeight = FontWeight.Bold,
                    color = FairyGold
                )
            }
            Spacer(Modifier.height(8.dp))
            HorizontalDivider(color = FairyGold.copy(alpha = 0.2f))
            Spacer(Modifier.height(12.dp))

            if (current == null) {
                WikiToc(onSelect = { current = it })
            } else {
                WikiArticleView(article = current!!, onNavigate = { current = it })
            }
        }
    }
}

@Composable
private fun WikiToc(onSelect: (WikiArticle) -> Unit) {
    // Шит рисуется на тёмном surface в обеих темах — фиксированный светлый.
    Text(
        Strings.t("wiki.toc.hint"),
        style = MaterialTheme.typography.labelMedium,
        color = Color.White.copy(alpha = 0.7f)
    )
    Spacer(Modifier.height(8.dp))
    WikiArticle.entries.forEach { article ->
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(vertical = 4.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            TextButton(
                onClick = { onSelect(article) },
                modifier = Modifier.fillMaxWidth(),
                contentPadding = PaddingValues(vertical = 10.dp, horizontal = 4.dp)
            ) {
                Text(article.emoji, fontSize = 18.sp)
                Spacer(Modifier.width(10.dp))
                Text(
                    Strings.t("wiki.article.${article.name}"),
                    style = MaterialTheme.typography.bodyLarge,
                    color = MaterialTheme.colorScheme.onSurface,
                    modifier = Modifier.weight(1f)
                )
                Text("›", color = FairyGold, fontSize = 18.sp)
            }
        }
    }
}

@Composable
private fun WikiArticleView(article: WikiArticle, onNavigate: (WikiArticle) -> Unit) {
    val annotated = remember(article) {
        buildAnnotatedString {
            article.body().forEach { span ->
                if (span.link != null) {
                    pushStringAnnotation(tag = "wiki", annotation = span.link.name)
                    withStyle(SpanStyle(
                        color = FairyGold,
                        textDecoration = TextDecoration.Underline,
                        fontWeight = FontWeight.SemiBold
                    )) {
                        append(span.text)
                    }
                    pop()
                } else {
                    append(span.text)
                }
            }
        }
    }
    val textColor = MaterialTheme.colorScheme.onSurface
    ClickableText(
        text = annotated,
        style = TextStyle(
            color = textColor,
            fontSize = 14.sp,
            lineHeight = 22.sp
        ),
        onClick = { offset ->
            annotated.getStringAnnotations(tag = "wiki", start = offset, end = offset)
                .firstOrNull()?.let { ann ->
                    onNavigate(WikiArticle.valueOf(ann.item))
                }
        }
    )
    Spacer(Modifier.height(16.dp))
    Text(
        Strings.t("wiki.related"),
        style = MaterialTheme.typography.labelSmall,
        color = Color.White.copy(alpha = 0.7f)
    )
    Spacer(Modifier.height(4.dp))
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        val related = article.body().mapNotNull { it.link }.distinct().take(4)
        related.forEach { other ->
            AssistChip(
                onClick = { onNavigate(other) },
                label = { Text("${other.emoji} ${Strings.t("wiki.article.${other.name}")}", fontSize = 11.sp) },
                colors = AssistChipDefaults.assistChipColors(
                    containerColor = FairyGold.copy(alpha = 0.15f),
                    labelColor = FairyGold
                )
            )
        }
    }
}
