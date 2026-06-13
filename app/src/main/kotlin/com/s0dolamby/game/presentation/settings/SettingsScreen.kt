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
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import com.s0dolamby.game.BuildConfig
import com.s0dolamby.game.R
import com.s0dolamby.game.domain.model.TEXT_MODEL_OPTIONS
import com.s0dolamby.game.presentation.common.components.FairyCard
import com.s0dolamby.game.presentation.common.i18n.Strings
import com.s0dolamby.game.presentation.common.components.OrnamentDivider
import com.s0dolamby.game.presentation.common.components.ScreenBackground
import com.s0dolamby.game.presentation.common.theme.Error
import com.s0dolamby.game.presentation.common.theme.FairyGold

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

    ScreenBackground(R.drawable.home_bg) {
        Scaffold(
            containerColor = Color.Transparent,
            topBar = {
                TopAppBar(
                    title = {
                        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
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
                        color = FairyGold,
                        fontWeight = FontWeight.SemiBold
                    )
                    Spacer(Modifier.height(4.dp))
                    Text(
                        Strings.t("settings.nickname.hint"),
                        style = MaterialTheme.typography.bodySmall,
                        color = Color.White.copy(alpha = 0.6f)
                    )
                    Spacer(Modifier.height(10.dp))
                    OutlinedTextField(
                        value = uiState.settings.nickname,
                        onValueChange = viewModel::setNickname,
                        singleLine = true,
                        placeholder = { Text(Strings.t("settings.nickname.placeholder")) },
                        modifier = Modifier.fillMaxWidth(),
                        colors = OutlinedTextFieldDefaults.colors(
                            focusedBorderColor = FairyGold,
                            unfocusedBorderColor = FairyGold.copy(alpha = 0.3f),
                            cursorColor = FairyGold,
                            focusedTextColor = Color.White,
                            unfocusedTextColor = Color.White,
                            focusedContainerColor = Color.White.copy(alpha = 0.05f),
                            unfocusedContainerColor = Color.White.copy(alpha = 0.03f)
                        )
                    )
                }

                // ── Модель текста ──────────────────────────────────────
                FairyCard(modifier = Modifier.fillMaxWidth()) {
                    Text(
                        Strings.t("settings.model.title"),
                        style = MaterialTheme.typography.titleMedium,
                        color = FairyGold,
                        fontWeight = FontWeight.SemiBold
                    )
                    Spacer(Modifier.height(4.dp))
                    Text(
                        Strings.t("settings.model.hint"),
                        style = MaterialTheme.typography.bodySmall,
                        color = Color.White.copy(alpha = 0.6f)
                    )
                    Spacer(Modifier.height(12.dp))
                    TEXT_MODEL_OPTIONS.forEach { option ->
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.SpaceBetween
                        ) {
                            Text(
                                option.label,
                                style = MaterialTheme.typography.bodyMedium,
                                color = if (uiState.settings.textModel == option.modelId) FairyGold
                                        else Color.White.copy(alpha = 0.85f),
                                fontWeight = if (uiState.settings.textModel == option.modelId) FontWeight.SemiBold
                                             else FontWeight.Normal,
                                modifier = Modifier.weight(1f)
                            )
                            RadioButton(
                                selected = uiState.settings.textModel == option.modelId,
                                onClick = { viewModel.setTextModel(option.modelId) },
                                colors = RadioButtonDefaults.colors(
                                    selectedColor = FairyGold,
                                    unselectedColor = Color.White.copy(alpha = 0.4f)
                                )
                            )
                        }
                    }
                }

                // Тоггл «генерации баннеров через Pollinations» удалён —
                // обложки теперь всегда из бандл-стока (assets/banners/).

                OrnamentDivider()

                // ── Мини-игры (бета) ───────────────────────────────────
                FairyCard(modifier = Modifier.fillMaxWidth()) {
                    Text(
                        Strings.t("settings.minigames.title"),
                        style = MaterialTheme.typography.titleMedium,
                        color = FairyGold,
                        fontWeight = FontWeight.SemiBold
                    )
                    Spacer(Modifier.height(8.dp))
                    Text(
                        Strings.t("settings.minigames.hint"),
                        style = MaterialTheme.typography.bodySmall,
                        color = Color.White.copy(alpha = 0.65f)
                    )
                    Spacer(Modifier.height(12.dp))
                    OutlinedButton(
                        onClick = onTryGoldenKey,
                        modifier = Modifier.fillMaxWidth(),
                        colors = ButtonDefaults.outlinedButtonColors(contentColor = FairyGold),
                        border = androidx.compose.foundation.BorderStroke(1.dp, FairyGold.copy(alpha = 0.5f))
                    ) {
                        Text("🔑 Золотой ключик · Буратино", fontWeight = FontWeight.SemiBold)
                    }
                    Spacer(Modifier.height(6.dp))
                    OutlinedButton(
                        onClick = onTryKoscheiMemory,
                        modifier = Modifier.fillMaxWidth(),
                        colors = ButtonDefaults.outlinedButtonColors(contentColor = FairyGold),
                        border = androidx.compose.foundation.BorderStroke(1.dp, FairyGold.copy(alpha = 0.5f))
                    ) {
                        Text("⛓ Цепь Кощея · Кощей", fontWeight = FontWeight.SemiBold)
                    }
                    Spacer(Modifier.height(6.dp))
                    OutlinedButton(
                        onClick = onTryKolobokNora,
                        modifier = Modifier.fillMaxWidth(),
                        colors = ButtonDefaults.outlinedButtonColors(contentColor = FairyGold),
                        border = androidx.compose.foundation.BorderStroke(1.dp, FairyGold.copy(alpha = 0.5f))
                    ) {
                        Text("🕳 Нора-нора-нора · Колобок", fontWeight = FontWeight.SemiBold)
                    }
                    Spacer(Modifier.height(6.dp))
                    OutlinedButton(
                        onClick = onTryZolushkaCoins,
                        modifier = Modifier.fillMaxWidth(),
                        colors = ButtonDefaults.outlinedButtonColors(contentColor = FairyGold),
                        border = androidx.compose.foundation.BorderStroke(1.dp, FairyGold.copy(alpha = 0.5f))
                    ) {
                        Text("🌾 Перебери зерно · Золушка", fontWeight = FontWeight.SemiBold)
                    }
                    Spacer(Modifier.height(6.dp))
                    OutlinedButton(
                        onClick = onTryBabaYagaCauldron,
                        modifier = Modifier.fillMaxWidth(),
                        colors = ButtonDefaults.outlinedButtonColors(contentColor = FairyGold),
                        border = androidx.compose.foundation.BorderStroke(1.dp, FairyGold.copy(alpha = 0.5f))
                    ) {
                        Text("🧪 Котёл · Баба-Яга", fontWeight = FontWeight.SemiBold)
                    }
                    Spacer(Modifier.height(6.dp))
                    OutlinedButton(
                        onClick = onTryBoyarinCharter,
                        modifier = Modifier.fillMaxWidth(),
                        colors = ButtonDefaults.outlinedButtonColors(contentColor = FairyGold),
                        border = androidx.compose.foundation.BorderStroke(1.dp, FairyGold.copy(alpha = 0.5f))
                    ) {
                        Text("📜 Купеческая грамота · Боярин", fontWeight = FontWeight.SemiBold)
                    }
                    Spacer(Modifier.height(6.dp))
                    OutlinedButton(
                        onClick = onTryIvanDurakMap,
                        modifier = Modifier.fillMaxWidth(),
                        colors = ButtonDefaults.outlinedButtonColors(contentColor = FairyGold),
                        border = androidx.compose.foundation.BorderStroke(1.dp, FairyGold.copy(alpha = 0.5f))
                    ) {
                        Text("🃏 Подкинь карту · Иван-Дурак", fontWeight = FontWeight.SemiBold)
                    }
                }

                OrnamentDivider()

                // ── Язык и тема ────────────────────────────────────────
                FairyCard(modifier = Modifier.fillMaxWidth()) {
                    Text(
                        Strings.t("settings.langTheme.title"),
                        style = MaterialTheme.typography.titleMedium,
                        color = FairyGold,
                        fontWeight = FontWeight.SemiBold
                    )
                    Spacer(Modifier.height(10.dp))
                    Text(
                        Strings.t("settings.lang.title"),
                        style = MaterialTheme.typography.bodyMedium,
                        color = Color.White.copy(alpha = 0.9f)
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
                                    selectedContainerColor = FairyGold.copy(alpha = 0.22f),
                                    selectedLabelColor = FairyGold,
                                    labelColor = Color.White.copy(alpha = 0.7f)
                                )
                            )
                        }
                    }
                    Spacer(Modifier.height(14.dp))
                    Text(
                        Strings.t("settings.theme.title"),
                        style = MaterialTheme.typography.bodyMedium,
                        color = Color.White.copy(alpha = 0.9f)
                    )
                    Spacer(Modifier.height(6.dp))
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.fillMaxWidth()) {
                        com.s0dolamby.game.domain.model.ThemeMode.entries.forEach { mode ->
                            val selected = uiState.settings.themeMode == mode
                            FilterChip(
                                selected = selected,
                                onClick = { viewModel.setThemeMode(mode) },
                                label = { Text("${mode.emoji} ${Strings.t("theme.${mode.name}")}") },
                                modifier = Modifier.weight(1f),
                                colors = FilterChipDefaults.filterChipColors(
                                    selectedContainerColor = FairyGold.copy(alpha = 0.22f),
                                    selectedLabelColor = FairyGold,
                                    labelColor = Color.White.copy(alpha = 0.7f)
                                )
                            )
                        }
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
                            Text(Strings.t("settings.about.title"), style = MaterialTheme.typography.titleMedium, color = FairyGold, fontWeight = FontWeight.SemiBold)
                            Text(
                                Strings.t("settings.about.version", BuildConfig.VERSION_NAME, BuildConfig.VERSION_CODE),
                                style = MaterialTheme.typography.labelSmall,
                                color = Color.White.copy(alpha = 0.5f)
                            )
                        }
                        IconButton(onClick = { showFaqDialog = true }) {
                            Icon(Icons.Default.Info, Strings.t("settings.faq.title"), tint = FairyGold)
                        }
                    }
                    Spacer(Modifier.height(8.dp))
                    Text(
                        Strings.t("settings.about.text"),
                        style = MaterialTheme.typography.bodySmall,
                        color = Color.White.copy(alpha = 0.65f)
                    )
                    Spacer(Modifier.height(8.dp))
                    OutlinedButton(
                        onClick = { showFaqDialog = true },
                        modifier = Modifier.fillMaxWidth(),
                        colors = ButtonDefaults.outlinedButtonColors(contentColor = FairyGold),
                        border = androidx.compose.foundation.BorderStroke(1.dp, FairyGold.copy(alpha = 0.4f))
                    ) {
                        Text(Strings.t("settings.about.faq"), fontWeight = FontWeight.SemiBold)
                    }
                }

                OrnamentDivider()

                // ── Сброс игры ─────────────────────────────────────────
                FairyCard(modifier = Modifier.fillMaxWidth()) {
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
                        color = Color.White.copy(alpha = 0.65f)
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
        AlertDialog(
            onDismissRequest = { showResetDialog = false },
            title = { Text(Strings.t("settings.reset.confirmTitle")) },
            text = { Text(Strings.t("settings.reset.confirmText")) },
            confirmButton = {
                Button(
                    onClick = {
                        showResetDialog = false
                        viewModel.resetGame()
                    },
                    colors = ButtonDefaults.buttonColors(containerColor = Error)
                ) { Text(Strings.t("settings.reset.confirmYes")) }
            },
            dismissButton = {
                TextButton(onClick = { showResetDialog = false }) { Text(Strings.t("btn.cancel")) }
            }
        )
    }

    if (showFaqDialog) {
        FaqWikiSheet(onDismiss = { showFaqDialog = false })
    }
}
