package com.s0dolamby.game.presentation.settings

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material.icons.filled.Info
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import com.s0dolamby.game.presentation.onboarding.TourTarget
import com.s0dolamby.game.presentation.onboarding.tourAnchor
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import com.s0dolamby.game.BuildConfig
import com.s0dolamby.game.R
import com.s0dolamby.game.presentation.common.components.FairyCard
import com.s0dolamby.game.presentation.common.components.fairyOnCardTextFieldColors
import com.s0dolamby.game.presentation.common.i18n.Strings
import com.s0dolamby.game.presentation.common.components.OrnamentDivider
import com.s0dolamby.game.presentation.common.components.AppBg
import com.s0dolamby.game.presentation.common.components.ScreenBackground
import com.s0dolamby.game.presentation.common.theme.Error
import com.s0dolamby.game.presentation.common.theme.FairyGold
import com.s0dolamby.game.presentation.common.theme.LocalContentColorMuted
import com.s0dolamby.game.presentation.common.theme.LocalContentColorSecondary
import com.s0dolamby.game.presentation.common.theme.LocalAccentOnCard

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SettingsScreen(
    onBack: () -> Unit,
    onResetDone: () -> Unit,
    onTryGoldenKey: () -> Unit = {},
    onTryKoscheiMemory: () -> Unit = {},
    onTryKolobokNora: () -> Unit = {},
    onTryZolushkaCoins: () -> Unit = {},
    onTryBabaYagaCauldron: () -> Unit = {},
    onTryBoyarinCharter: () -> Unit = {},
    onTryIvanDurakMap: () -> Unit = {},
    viewModel: SettingsViewModel = hiltViewModel()
) {
    val uiState by viewModel.uiState.collectAsState()
    var showResetDialog by remember { mutableStateOf(false) }
    var showFaqDialog by remember { mutableStateOf(false) }

    LaunchedEffect(uiState.resetDone) {
        if (uiState.resetDone) {
            viewModel.resetDoneHandled()
            onResetDone()
        }
    }

    ScreenBackground(AppBg.SETTINGS) {
        Scaffold(
            containerColor = Color.Transparent,
            topBar = {
                TopAppBar(
                    title = {
                        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                            // TopAppBar лежит на тёмном фоне экрана в обеих
                            // темах — фиксированное золото, не карточная локаль.
                            Text("✦", color = FairyGold, fontSize = 12.sp)
                            Text(Strings.t("settings.title"), fontWeight = FontWeight.Bold)
                            Text("✦", color = FairyGold, fontSize = 12.sp)
                        }
                    },
                    navigationIcon = {
                        IconButton(onClick = onBack) { Icon(Icons.Default.ArrowBack, Strings.t("btn.back")) }
                    },
                    colors = TopAppBarDefaults.topAppBarColors(containerColor = Color.Transparent)
                )
            }
        ) { padding ->
            if (uiState.isLoading) {
                Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    CircularProgressIndicator(color = FairyGold)
                }
                return@Scaffold
            }

            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(padding)
                    .padding(horizontal = 16.dp)
                    .verticalScroll(rememberScrollState()),
                verticalArrangement = Arrangement.spacedBy(16.dp)
            ) {
                Spacer(Modifier.height(4.dp))

                // ── Прозвище игрока ────────────────────────────────────
                FairyCard(modifier = Modifier.fillMaxWidth()) {
                    Text(
                        Strings.t("settings.nickname.title"),
                        style = MaterialTheme.typography.titleMedium,
                        color = LocalAccentOnCard.current,
                        fontWeight = FontWeight.SemiBold
                    )
                    Spacer(Modifier.height(4.dp))
                    Text(
                        Strings.t("settings.nickname.hint"),
                        style = MaterialTheme.typography.bodySmall,
                        color = LocalContentColorMuted.current
                    )
                    Spacer(Modifier.height(10.dp))
                    OutlinedTextField(
                        value = uiState.settings.nickname,
                        onValueChange = viewModel::setNickname,
                        singleLine = true,
                        placeholder = { Text(Strings.t("settings.nickname.placeholder")) },
                        modifier = Modifier.fillMaxWidth(),
                        colors = fairyOnCardTextFieldColors()
                    )
                }

                // Выбор нейросети временно скрыт: модель фиксирована на
                // сервере-прокси, игроку выбирать нечего. Настройка textModel
                // и TEXT_MODEL_OPTIONS остались в коде — вернём карточку, когда
                // будет смысл давать выбор.

                // Тоггл «генерации баннеров через Pollinations» удалён —
                // обложки теперь всегда из бандл-стока (assets/banners/).

                // ── Язык и тема ────────────────────────────────────────
                FairyCard(modifier = Modifier.fillMaxWidth().tourAnchor(TourTarget.SETTINGS_PREFS)) {
                    Text(
                        Strings.t("settings.langTheme.title"),
                        style = MaterialTheme.typography.titleMedium,
                        color = LocalAccentOnCard.current,
                        fontWeight = FontWeight.SemiBold
                    )
                    Spacer(Modifier.height(10.dp))
                    Text(
                        Strings.t("settings.lang.title"),
                        style = MaterialTheme.typography.bodyMedium,
                        color = LocalContentColor.current.copy(alpha = 0.9f)
                    )
                    Spacer(Modifier.height(6.dp))
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.fillMaxWidth()) {
                        listOf("ru" to "Русский", "en" to "English").forEach { (code, label) ->
                            val selected = uiState.settings.language == code
                            FilterChip(
                                selected = selected,
                                onClick = { viewModel.setLanguage(code) },
                                label = { Text(label) },
                                modifier = Modifier.weight(1f),
                                colors = FilterChipDefaults.filterChipColors(
                                    selectedContainerColor = FairyGold,
                                    selectedLabelColor = Color(0xFF1A0A00),
                                    labelColor = LocalContentColorSecondary.current
                                )
                            )
                        }
                    }
                    Spacer(Modifier.height(14.dp))
                    Text(
                        Strings.t("settings.theme.title"),
                        style = MaterialTheme.typography.bodyMedium,
                        color = LocalContentColor.current.copy(alpha = 0.9f)
                    )
                    Spacer(Modifier.height(6.dp))
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.fillMaxWidth()) {
                        com.s0dolamby.game.domain.model.ThemeMode.entries.forEach { mode ->
                            val selected = uiState.settings.themeMode == mode
                            FilterChip(
                                selected = selected,
                                onClick = { viewModel.setThemeMode(mode) },
                                label = {
                                    Text(
                                        "${mode.emoji} ${Strings.t("theme.${mode.name}")}",
                                        maxLines = 1
                                    )
                                },
                                modifier = Modifier.weight(1f),
                                colors = FilterChipDefaults.filterChipColors(
                                    selectedContainerColor = FairyGold,
                                    selectedLabelColor = Color(0xFF1A0A00),
                                    labelColor = LocalContentColorSecondary.current
                                )
                            )
                        }
                    }
                    Spacer(Modifier.height(14.dp))
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        Column(Modifier.weight(1f)) {
                            Text(
                                Strings.t("settings.sound.title"),
                                style = MaterialTheme.typography.bodyMedium,
                                color = LocalContentColor.current.copy(alpha = 0.9f)
                            )
                            Text(
                                Strings.t("settings.sound.hint"),
                                style = MaterialTheme.typography.bodySmall,
                                color = LocalContentColorMuted.current
                            )
                        }
                        Switch(
                            checked = uiState.settings.soundEnabled,
                            onCheckedChange = viewModel::setSoundEnabled,
                            colors = SwitchDefaults.colors(
                                checkedThumbColor = Color(0xFF1A0A00),
                                checkedTrackColor = FairyGold,
                                uncheckedThumbColor = LocalContentColorMuted.current,
                                uncheckedTrackColor = LocalContentColor.current.copy(alpha = 0.1f)
                            )
                        )
                    }
                    Spacer(Modifier.height(10.dp))
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        Column(Modifier.weight(1f)) {
                            Text(
                                Strings.t("settings.music.title"),
                                style = MaterialTheme.typography.bodyMedium,
                                color = LocalContentColor.current.copy(alpha = 0.9f)
                            )
                            Text(
                                Strings.t("settings.music.hint"),
                                style = MaterialTheme.typography.bodySmall,
                                color = LocalContentColorMuted.current
                            )
                        }
                        Switch(
                            checked = uiState.settings.musicEnabled,
                            onCheckedChange = viewModel::setMusicEnabled,
                            colors = SwitchDefaults.colors(
                                checkedThumbColor = Color(0xFF1A0A00),
                                checkedTrackColor = FairyGold,
                                uncheckedThumbColor = LocalContentColorMuted.current,
                                uncheckedTrackColor = LocalContentColor.current.copy(alpha = 0.1f)
                            )
                        )
                    }
                    Spacer(Modifier.height(10.dp))
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        Column(Modifier.weight(1f)) {
                            Text(
                                Strings.t("settings.notif.title"),
                                style = MaterialTheme.typography.bodyMedium,
                                color = LocalContentColor.current.copy(alpha = 0.9f)
                            )
                            Text(
                                Strings.t("settings.notif.hint"),
                                style = MaterialTheme.typography.bodySmall,
                                color = LocalContentColorMuted.current
                            )
                        }
                        Switch(
                            checked = uiState.settings.notificationsEnabled,
                            onCheckedChange = viewModel::setNotificationsEnabled,
                            colors = SwitchDefaults.colors(
                                checkedThumbColor = Color(0xFF1A0A00),
                                checkedTrackColor = FairyGold,
                                uncheckedThumbColor = LocalContentColorMuted.current,
                                uncheckedTrackColor = LocalContentColor.current.copy(alpha = 0.1f)
                            )
                        )
                    }
                }

                OrnamentDivider()

                // ── ЧАВО + версия ─────────────────────────────────────
                FairyCard(modifier = Modifier.fillMaxWidth()) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        Column {
                            Text(Strings.t("settings.about.title"), style = MaterialTheme.typography.titleMedium, color = LocalAccentOnCard.current, fontWeight = FontWeight.SemiBold)
                            Text(
                                Strings.t("settings.about.version", BuildConfig.VERSION_NAME, BuildConfig.VERSION_CODE),
                                style = MaterialTheme.typography.labelSmall,
                                color = LocalContentColorMuted.current
                            )
                        }
                        IconButton(onClick = { showFaqDialog = true }) {
                            Icon(Icons.Default.Info, Strings.t("settings.faq.title"), tint = LocalAccentOnCard.current)
                        }
                    }
                    Spacer(Modifier.height(8.dp))
                    Text(
                        Strings.t("settings.about.text"),
                        style = MaterialTheme.typography.bodySmall,
                        color = LocalContentColorMuted.current
                    )
                    Spacer(Modifier.height(8.dp))
                    Button(
                        onClick = { showFaqDialog = true },
                        modifier = Modifier.fillMaxWidth(),
                        colors = ButtonDefaults.buttonColors(
                            containerColor = FairyGold,
                            contentColor = Color(0xFF1A0A00)
                        )
                    ) {
                        Text(Strings.t("settings.about.faq"), fontWeight = FontWeight.SemiBold)
                    }
                    Spacer(Modifier.height(8.dp))
                    // Заново показать входной тур по интерфейсу (сбрасывает флаг
                    // и возвращает на предыдущий экран, где тур и всплывёт).
                    OutlinedButton(
                        onClick = { viewModel.replayTour(); onBack() },
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Text(Strings.t("settings.tour.replay"), color = LocalAccentOnCard.current)
                    }
                }

                OrnamentDivider()

                // ── Сброс игры ─────────────────────────────────────────
                FairyCard(modifier = Modifier.fillMaxWidth().tourAnchor(TourTarget.SETTINGS_RESET)) {
                    Text(
                        Strings.t("settings.danger.title"),
                        style = MaterialTheme.typography.titleMedium,
                        color = Error,
                        fontWeight = FontWeight.SemiBold
                    )
                    Spacer(Modifier.height(8.dp))
                    Text(
                        Strings.t("settings.danger.hint"),
                        style = MaterialTheme.typography.bodySmall,
                        color = LocalContentColorMuted.current
                    )
                    Spacer(Modifier.height(12.dp))
                    OutlinedButton(
                        onClick = { showResetDialog = true },
                        modifier = Modifier.fillMaxWidth(),
                        colors = ButtonDefaults.outlinedButtonColors(contentColor = Error),
                        border = androidx.compose.foundation.BorderStroke(1.dp, Error.copy(alpha = 0.5f))
                    ) {
                        Text(Strings.t("settings.danger.reset"), fontWeight = FontWeight.SemiBold)
                    }
                }
            }
        }
    }

    if (showResetDialog) {
        // Первичная (золотая) — безопасная «Отмена»; сброс — вторичной обводкой.
        com.s0dolamby.game.presentation.common.components.FairyPromptDialog(
            emoji = "⚠️",
            title = Strings.t("settings.reset.confirmTitle"),
            body = Strings.t("settings.reset.confirmText"),
            primaryText = Strings.t("btn.cancel"),
            onPrimary = { showResetDialog = false },
            secondaryText = Strings.t("settings.reset.confirmYes"),
            onSecondary = {
                showResetDialog = false
                viewModel.resetGame()
            }
        )
    }

    if (showFaqDialog) {
        FaqWikiSheet(onDismiss = { showFaqDialog = false })
    }
}
