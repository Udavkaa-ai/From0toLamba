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
import com.s0dolamby.game.presentation.common.components.AppBg
import com.s0dolamby.game.presentation.common.components.ScreenBackground
import com.s0dolamby.game.presentation.common.components.WobblyEmoji
import com.s0dolamby.game.presentation.common.i18n.Strings
import com.s0dolamby.game.presentation.common.theme.FairyGold
import com.s0dolamby.game.presentation.common.theme.LocalContentColorMuted
import com.s0dolamby.game.presentation.common.theme.LocalContentColorSecondary
import com.s0dolamby.game.presentation.common.theme.LocalAccentOnCard

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
    val investState by viewModel.investState.collectAsState()
    val freeBalance by viewModel.freeBalance.collectAsState()
    val activity = androidx.activity.compose.LocalActivity.current
    var adPromptForProjectId by remember { mutableStateOf<String?>(null) }
    val snackbarHostState = remember { SnackbarHostState() }

    ScreenBackground(AppBg.INBOX) {
    Scaffold(
        containerColor = Color.Transparent,
        snackbarHost = { com.s0dolamby.game.presentation.common.components.FairySnackbarHost(snackbarHostState) },
        topBar = {
            TopAppBar(
                title = {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(6.dp)
                    ) {
                        // TopAppBar лежит на тёмном фоне экрана в ОБЕИХ темах —
                        // фиксированное золото, не карточная локаль.
                        Text("✦", color = FairyGold, fontSize = 12.sp)
                        Text(Strings.t("inbox.title"), fontWeight = FontWeight.Bold)
                        Text("✦", color = FairyGold, fontSize = 12.sp)
                    }
                },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.Default.ArrowBack, Strings.t("btn.back"))
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
                            WobblyEmoji("📭", fontSize = 32.sp)
                            Text(
                                Strings.t("inbox.empty"),
                                style = MaterialTheme.typography.titleMedium,
                                color = LocalContentColor.current,
                                fontWeight = FontWeight.SemiBold,
                                textAlign = TextAlign.Center
                            )
                            Text(
                                Strings.t("inbox.empty.hint"),
                                style = MaterialTheme.typography.bodyMedium,
                                color = LocalContentColorMuted.current,
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
                        played = unlock != null,
                        unlocked = unlock?.isWin == true,
                        perfect = unlock?.isPerfect == true,
                        onPlayMinigame = {
                            if (unlock != null) {
                                // Сыграно (как угодно) — сразу к вложению, без чата.
                                viewModel.openInvestSheet(project.id)
                            } else {
                                onPlayMinigame(project.personaArchetype.name, project.id)
                            }
                        },
                        onChat = { onContinueToAma(project.id) },
                        onChatAfterAd = { adPromptForProjectId = project.id }
                    )
                }
            }
        }
    }
    // Шит вложения прямо из грамот — в чат заходить не обязательно
    if (investState.sheetProjectId != null) {
        com.s0dolamby.game.presentation.common.components.InvestSheet(
            freeBalance = freeBalance,
            ugovorPercent = investState.ugovorPercent,
            onDismiss = viewModel::closeInvestSheet,
            onInvest = { amount -> viewModel.invest(amount) }
        )
    }
    investState.extraSlotOfferAmount?.let { pendingAmount ->
        com.s0dolamby.game.presentation.common.components.ExtraSlotDialog(
            pendingAmount = pendingAmount,
            freeBalance = freeBalance,
            onConfirm = viewModel::investWithExtraSlot,
            onDismiss = viewModel::dismissExtraSlotOffer
        )
    }
    investState.investedAmount?.let { amount ->
        val msg = Strings.t("ama.snack.invested", "%.0f г".format(amount))
        LaunchedEffect(amount) {
            snackbarHostState.showSnackbar(msg)
            viewModel.clearInvestResult()
        }
    }
    investState.error?.let { err ->
        val msg = err.ifBlank { Strings.t("ama.err.unknown") }
        LaunchedEffect(err) {
            snackbarHostState.showSnackbar(msg)
            viewModel.clearError()
        }
    }

    // «Беседа за рекламу»: при включённой рекламе (ADS_ENABLED) показываем
    // rewarded-ролик Яндекса и пускаем в Ama по награде; при выключенной —
    // просто пропускаем (как раньше). Игрока реклама не блокирует.
    adPromptForProjectId?.let { pid ->
        AlertDialog(
            onDismissRequest = { adPromptForProjectId = null },
            title = { Text(Strings.t("inbox.ad.title")) },
            text = { Text(Strings.t("inbox.ad.body")) },
            confirmButton = {
                TextButton(onClick = {
                    adPromptForProjectId = null
                    val proceed = { onChatAfterAd(pid) }
                    if (activity != null) {
                        viewModel.watchRewardedThen(activity, proceed)
                    } else {
                        proceed()
                    }
                    // Дефолтный AlertDialog — тёмный Material-surface в обеих
                    // темах: фиксированное золото, не карточная локаль.
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
    /** Мини-игра сыграна (с любым исходом) — вложение доступно. */
    played: Boolean = false,
    unlocked: Boolean = false,
    perfect: Boolean = false,
    onPlayMinigame: () -> Unit,
    onChat: () -> Unit = {},
    onChatAfterAd: () -> Unit
) {
    // Тап по карточке = основной вход = мини-игра. Альтернативный вход —
    // «беседа за рекламу» — на отдельной полупрозрачной кнопке снизу.
    // Обложка дела из стока (как в TG: 120dp, full-bleed от края до края).
    // Берётся напрямую из assets через rememberBannerUrl — даже у старых дел
    // в БД без bannerImageUrl всё равно подберётся картинка.
    val bannerUrl = rememberBannerUrl(project.personaArchetype, project.type, project.id)
    FairyCard(
        onClick = onPlayMinigame,
        modifier = Modifier.fillMaxWidth(),
        headerContent = if (bannerUrl != null) {
            {
                AsyncImage(
                    model = bannerUrl,
                    contentDescription = project.claimedName,
                    contentScale = ContentScale.Crop,
                    modifier = Modifier
                        .fillMaxWidth()
                        .aspectRatio(1408f / 768f)  // родная пропорция баннера, без обрезки
                )
            }
        } else null
    ) {
        // Заголовок: имя дела + тип, бейдж «N% посул» справа
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.Top
        ) {
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    project.claimedName,
                    color = LocalAccentOnCard.current,
                    fontSize = 15.sp,
                    fontWeight = FontWeight.Bold
                )
                // Тип дела раскрываем ТОЛЬКО после успешной мини-игры (хоть
                // с одной ошибкой). До игры — у игрока нет ни типа, ни посула.
                if (unlocked) {
                    Text(
                        project.type.displayWithEmojiI18n(),
                        color = LocalContentColorMuted.current,
                        fontSize = 11.sp,
                        modifier = Modifier.padding(top = 2.dp)
                    )
                }
            }
            Spacer(Modifier.width(8.dp))
            // Заявленный посул (APY) — только при ИДЕАЛЕ. Делец сам проболтался
            // про обещанный годовой прибыток только после безошибочного прохождения.
            if (perfect) {
                Surface(
                    color = LocalAccentOnCard.current.copy(alpha = 0.13f),
                    shape = MaterialTheme.shapes.small,
                    border = androidx.compose.foundation.BorderStroke(1.dp, FairyGold.copy(alpha = 0.4f))
                ) {
                    Text(
                        Strings.t("inbox.apy", project.claimedAPY.toInt()),
                        color = LocalAccentOnCard.current,
                        fontSize = 12.sp,
                        fontWeight = FontWeight.Bold,
                        modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp)
                    )
                }
            }
        }

        OrnamentDivider()

        Text(
            project.description.take(160) + if (project.description.length > 160) "..." else "",
            style = MaterialTheme.typography.bodySmall,
            fontStyle = FontStyle.Italic,
            color = LocalContentColorSecondary.current,
            lineHeight = 18.sp
        )

        Spacer(Modifier.height(10.dp))

        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween
        ) {
            Text(
                "👤 ${project.developerName}",
                color = LocalContentColorMuted.current,
                fontSize = 11.sp
            )
            Text(
                Strings.t("inbox.investors", formatCount(project.claimedUserCount)),
                color = LocalContentColorMuted.current,
                fontSize = 11.sp
            )
        }

        Spacer(Modifier.height(10.dp))

        // После игры (любой исход) главная CTA — «Вложить» прямо здесь,
        // чат опционален и вынесен на вторую кнопку с «уговором»-заманухой.
        // Провал = второго испытания нет, вложение «вслепую».
        val mainText = when {
            perfect -> Strings.t("inbox.cta.perfect")
            unlocked -> Strings.t("inbox.cta.unlocked")
            played -> Strings.t("inbox.cta.blind")
            else -> Strings.t("inbox.cta.minigame")
        }
        Surface(
            modifier = Modifier.fillMaxWidth(),
            color = LocalAccentOnCard.current.copy(alpha = 0.18f),
            shape = MaterialTheme.shapes.small,
            border = androidx.compose.foundation.BorderStroke(1.dp, FairyGold.copy(alpha = 0.5f)),
            onClick = onPlayMinigame
        ) {
            Text(
                mainText,
                color = LocalAccentOnCard.current,
                fontSize = 13.sp,
                fontWeight = FontWeight.SemiBold,
                textAlign = TextAlign.Center,
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(vertical = 10.dp)
            )
        }
        Spacer(Modifier.height(6.dp))
        if (played) {
            // Беседа — по желанию: каждый вопрос дельцу = +1% к вложению
            Surface(
                modifier = Modifier.fillMaxWidth(),
                color = LocalContentColor.current.copy(alpha = 0.06f),
                shape = MaterialTheme.shapes.small,
                border = androidx.compose.foundation.BorderStroke(
                    1.dp, LocalContentColor.current.copy(alpha = 0.20f)
                ),
                onClick = onChat
            ) {
                Text(
                    Strings.t("inbox.cta.chat"),
                    color = LocalContentColor.current.copy(alpha = 0.78f),
                    fontSize = 12.sp,
                    textAlign = TextAlign.Center,
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(vertical = 9.dp)
                )
            }
        } else {
            // Альтернатива — беседа за просмотр рекламы (rewarded ad)
            Surface(
                modifier = Modifier.fillMaxWidth(),
                color = LocalContentColor.current.copy(alpha = 0.06f),
                shape = MaterialTheme.shapes.small,
                border = androidx.compose.foundation.BorderStroke(
                    // На пергаменте тёплой темы белая рамка невидима —
                    // берём цвет контента карточки.
                    1.dp, LocalContentColor.current.copy(alpha = 0.20f)
                ),
                onClick = onChatAfterAd
            ) {
                Text(
                    Strings.t("inbox.cta.ad"),
                    color = LocalContentColor.current.copy(alpha = 0.78f),
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

@Composable
@androidx.compose.runtime.ReadOnlyComposable
private fun ProjectType.displayWithEmojiI18n(): String = when (this) {
    ProjectType.CARD_GAME -> Strings.t("type.cardGame")
    ProjectType.TREASURE_HUNT -> Strings.t("type.treasureHunt")
    ProjectType.POTION_BREW -> Strings.t("type.potionBrew")
    ProjectType.GUILD_SCHEME -> Strings.t("type.guildScheme")
    ProjectType.HONEST_TRADE -> Strings.t("type.honestTrade")
}

private fun formatCount(count: Int): String = when {
    count >= 1_000_000 -> "%.1fM".format(count / 1_000_000.0)
    count >= 1_000 -> "%.0fK".format(count / 1_000.0)
    else -> "$count"
}
