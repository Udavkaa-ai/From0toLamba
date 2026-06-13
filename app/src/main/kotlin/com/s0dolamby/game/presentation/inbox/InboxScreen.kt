package com.s0dolamby.game.presentation.inbox

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.slideInVertically
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material3.*
import androidx.compose.runtime.*
import kotlinx.coroutines.delay
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil.compose.AsyncImage
import com.s0dolamby.game.presentation.common.components.rememberBannerUrl
import androidx.hilt.navigation.compose.hiltViewModel
import com.s0dolamby.game.R
import com.s0dolamby.game.domain.model.Project
import com.s0dolamby.game.domain.model.ProjectType
import com.s0dolamby.game.presentation.common.components.FairyCard
import com.s0dolamby.game.presentation.common.components.OrnamentDivider
import com.s0dolamby.game.presentation.common.components.ScreenBackground
import com.s0dolamby.game.presentation.common.i18n.Strings
import com.s0dolamby.game.presentation.common.theme.FairyGold

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun InboxScreen(
    onBack: () -> Unit,
    /** Основной вход в дело — мини-игра дельца. */
    onPlayMinigame: (archetypeName: String, projectId: String) -> Unit,
    /** Альтернативный — «беседа за рекламу» (пока бесплатно, потом rewarded ad). */
    onChatAfterAd: (projectId: String) -> Unit,
    /** Прямой проход в AMA — для уже пройденной мини-игры. */
    onContinueToAma: (projectId: String) -> Unit = {},
    viewModel: InboxViewModel = hiltViewModel()
) {
    val projects by viewModel.inboxProjects.collectAsState()
    val unlocks by viewModel.unlockOutcomes.collectAsState()
    var adPromptForProjectId by remember { mutableStateOf<String?>(null) }

    ScreenBackground(R.drawable.inbox_bg) {
    Scaffold(
        containerColor = Color.Transparent,
        topBar = {
            TopAppBar(
                title = {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(6.dp)
                    ) {
                        Text("✦", color = FairyGold, fontSize = 12.sp)
                        Text(Strings.t("inbox.title"), fontWeight = FontWeight.Bold)
                        Text("✦", color = FairyGold, fontSize = 12.sp)
                    }
                },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.Default.ArrowBack, "Назад")
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = Color.Transparent)
            )
        }
    ) { padding ->
        LazyColumn(
            modifier = Modifier.fillMaxSize().padding(padding),
            contentPadding = PaddingValues(start = 16.dp, end = 16.dp, top = 16.dp, bottom = 90.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            if (projects.isEmpty()) {
                item {
                    FairyCard(modifier = Modifier.fillMaxWidth()) {
                        Column(
                            modifier = Modifier.fillMaxWidth().padding(vertical = 32.dp),
                            horizontalAlignment = Alignment.CenterHorizontally,
                            verticalArrangement = Arrangement.spacedBy(12.dp)
                        ) {
                            Text("📭", fontSize = 32.sp)
                            Text(
                                Strings.t("inbox.empty"),
                                style = MaterialTheme.typography.titleMedium,
                                color = Color.White,
                                fontWeight = FontWeight.SemiBold,
                                textAlign = TextAlign.Center
                            )
                            Text(
                                Strings.t("inbox.empty.hint"),
                                style = MaterialTheme.typography.bodyMedium,
                                color = Color.White.copy(alpha = 0.55f),
                                textAlign = TextAlign.Center
                            )
                        }
                    }
                }
            }
            itemsIndexed(projects) { index, project ->
                var visible by remember(project.id) { mutableStateOf(false) }
                LaunchedEffect(project.id) {
                    delay(index * 70L)
                    visible = true
                }
                AnimatedVisibility(
                    visible = visible,
                    enter = slideInVertically(
                        animationSpec = tween(320),
                        initialOffsetY = { it / 2 }
                    ) + fadeIn(tween(280))
                ) {
                    val unlock = unlocks[project.id]
                    InboxProjectCard(
                        project = project,
                        unlocked = unlock?.isWin == true,
                        perfect = unlock?.isPerfect == true,
                        onPlayMinigame = {
                            if (unlock?.isWin == true) {
                                // Уже сыграно — сразу в беседу, мини-игру повторно не предлагаем.
                                onContinueToAma(project.id)
                            } else {
                                onPlayMinigame(project.personaArchetype.name, project.id)
                            }
                        },
                        onChatAfterAd = { adPromptForProjectId = project.id }
                    )
                }
            }
        }
    }
    // Заглушка «реклама» — пока без реальных rewarded-ads. Согласие = переход в Ama.
    adPromptForProjectId?.let { pid ->
        AlertDialog(
            onDismissRequest = { adPromptForProjectId = null },
            title = { Text(Strings.t("inbox.ad.title")) },
            text = { Text(Strings.t("inbox.ad.body")) },
            confirmButton = {
                TextButton(onClick = {
                    adPromptForProjectId = null
                    onChatAfterAd(pid)
                }) { Text(Strings.t("inbox.ad.confirm"), color = FairyGold) }
            },
            dismissButton = {
                TextButton(onClick = { adPromptForProjectId = null }) { Text(Strings.t("btn.cancel")) }
            }
        )
    }
    } // ScreenBackground
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun InboxProjectCard(
    project: Project,
    unlocked: Boolean = false,
    perfect: Boolean = false,
    onPlayMinigame: () -> Unit,
    onChatAfterAd: () -> Unit
) {
    // Тап по карточке = основной вход = мини-игра. Альтернативный вход —
    // «беседа за рекламу» — на отдельной полупрозрачной кнопке снизу.
    FairyCard(onClick = onPlayMinigame, modifier = Modifier.fillMaxWidth()) {
        // Обложка дела из стока (как в TG: 120dp, скруглённая).
        // Берётся напрямую из assets через rememberBannerUrl — даже у старых дел
        // в БД без bannerImageUrl всё равно подберётся картинка.
        val bannerUrl = rememberBannerUrl(project.personaArchetype, project.type, project.id)
        if (bannerUrl != null) {
            AsyncImage(
                model = bannerUrl,
                contentDescription = project.claimedName,
                contentScale = ContentScale.Crop,
                modifier = Modifier
                    .fillMaxWidth()
                    .height(120.dp)
                    .clip(MaterialTheme.shapes.medium)
            )
            Spacer(Modifier.height(10.dp))
        }
        // Заголовок: имя дела + тип, бейдж «N% посул» справа
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.Top
        ) {
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    project.claimedName,
                    color = FairyGold,
                    fontSize = 15.sp,
                    fontWeight = FontWeight.Bold
                )
                Text(
                    project.type.displayWithEmoji(),
                    color = Color.White.copy(alpha = 0.55f),
                    fontSize = 11.sp,
                    modifier = Modifier.padding(top = 2.dp)
                )
            }
            Spacer(Modifier.width(8.dp))
            Surface(
                color = FairyGold.copy(alpha = 0.13f),
                shape = MaterialTheme.shapes.small,
                border = androidx.compose.foundation.BorderStroke(1.dp, FairyGold.copy(alpha = 0.4f))
            ) {
                Text(
                    "${project.claimedAPY.toInt()}% посул",
                    color = FairyGold,
                    fontSize = 12.sp,
                    fontWeight = FontWeight.Bold,
                    modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp)
                )
            }
        }

        OrnamentDivider()

        Text(
            project.description.take(160) + if (project.description.length > 160) "..." else "",
            style = MaterialTheme.typography.bodySmall,
            fontStyle = FontStyle.Italic,
            color = Color.White.copy(alpha = 0.7f),
            lineHeight = 18.sp
        )

        Spacer(Modifier.height(10.dp))

        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween
        ) {
            Text(
                "👤 ${project.developerName}",
                color = Color.White.copy(alpha = 0.55f),
                fontSize = 11.sp
            )
            Text(
                "👥 ${formatCount(project.claimedUserCount)} вкладчиков",
                color = Color.White.copy(alpha = 0.55f),
                fontSize = 11.sp
            )
        }

        Spacer(Modifier.height(10.dp))

        // Если мини-игра уже пройдена — главная CTA меняется на «Вложить»
        // и подсказывает результат. Альтернативную «беседу за рекламу»
        // прячем — она была обходным путём.
        val mainText = when {
            perfect -> "✨ Идеал — подробности раскрыты, к беседе"
            unlocked -> "💰 Можно вкладываться — к беседе"
            else -> Strings.t("inbox.cta.minigame")
        }
        Surface(
            modifier = Modifier.fillMaxWidth(),
            color = FairyGold.copy(alpha = 0.18f),
            shape = MaterialTheme.shapes.small,
            border = androidx.compose.foundation.BorderStroke(1.dp, FairyGold.copy(alpha = 0.5f)),
            onClick = onPlayMinigame
        ) {
            Text(
                mainText,
                color = FairyGold,
                fontSize = 13.sp,
                fontWeight = FontWeight.SemiBold,
                textAlign = TextAlign.Center,
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(vertical = 10.dp)
            )
        }
        if (!unlocked) {
            Spacer(Modifier.height(6.dp))
            // Альтернатива — беседа за просмотр рекламы (rewarded ad)
            Surface(
                modifier = Modifier.fillMaxWidth(),
                color = Color.White.copy(alpha = 0.06f),
                shape = MaterialTheme.shapes.small,
                border = androidx.compose.foundation.BorderStroke(
                    1.dp, Color.White.copy(alpha = 0.20f)
                ),
                onClick = onChatAfterAd
            ) {
                Text(
                    Strings.t("inbox.cta.ad"),
                    color = Color.White.copy(alpha = 0.78f),
                    fontSize = 12.sp,
                    textAlign = TextAlign.Center,
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(vertical = 9.dp)
                )
            }
        }
    }
}

private fun ProjectType.displayWithEmoji(): String = when (this) {
    ProjectType.CARD_GAME -> "🃏 Азартная игра"
    ProjectType.TREASURE_HUNT -> "🗺 Поиск клада"
    ProjectType.POTION_BREW -> "🧪 Зелейное дело"
    ProjectType.GUILD_SCHEME -> "⚙ Артель"
    ProjectType.HONEST_TRADE -> "🤝 Честная торговля"
}

private fun formatCount(count: Int): String = when {
    count >= 1_000_000 -> "%.1fM".format(count / 1_000_000.0)
    count >= 1_000 -> "%.0fK".format(count / 1_000.0)
    else -> "$count"
}
