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
                            Text("Настройки", fontWeight = FontWeight.Bold)
                            Text("✦", color = FairyGold, fontSize = 12.sp)
                        }
                    },
                    navigationIcon = {
                        IconButton(onClick = onBack) { Icon(Icons.Default.ArrowBack, "Назад") }
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

                // ── Модель текста ──────────────────────────────────────
                FairyCard(modifier = Modifier.fillMaxWidth()) {
                    Text(
                        "Нейросеть для текста",
                        style = MaterialTheme.typography.titleMedium,
                        color = FairyGold,
                        fontWeight = FontWeight.SemiBold
                    )
                    Spacer(Modifier.height(4.dp))
                    Text(
                        "Используется для бесед, вестей и генерации имён",
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
                        "Мини-игры (бета)",
                        style = MaterialTheme.typography.titleMedium,
                        color = FairyGold,
                        fontWeight = FontWeight.SemiBold
                    )
                    Spacer(Modifier.height(8.dp))
                    Text(
                        "Пока в стороне от инвест-цикла. Скоро будут условием входа в дело.",
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

                // ── Язык + тема (готовится) ────────────────────────────
                FairyCard(modifier = Modifier.fillMaxWidth()) {
                    Text(
                        "Язык и тема",
                        style = MaterialTheme.typography.titleMedium,
                        color = FairyGold,
                        fontWeight = FontWeight.SemiBold
                    )
                    Spacer(Modifier.height(8.dp))
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        Column {
                            Text(
                                "🌐 Язык интерфейса",
                                style = MaterialTheme.typography.bodyMedium,
                                color = Color.White.copy(alpha = 0.9f)
                            )
                            Text(
                                "Русский · английский в работе",
                                style = MaterialTheme.typography.labelSmall,
                                color = Color.White.copy(alpha = 0.45f)
                            )
                        }
                        AssistChip(
                            onClick = { },
                            enabled = false,
                            label = { Text("RU", fontWeight = FontWeight.SemiBold) },
                            colors = AssistChipDefaults.assistChipColors(
                                disabledContainerColor = FairyGold.copy(alpha = 0.18f),
                                disabledLabelColor = FairyGold
                            )
                        )
                    }
                    Spacer(Modifier.height(10.dp))
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        Column {
                            Text(
                                "🎨 Тема",
                                style = MaterialTheme.typography.bodyMedium,
                                color = Color.White.copy(alpha = 0.9f)
                            )
                            Text(
                                "«Тёмная фиолетовая» · светлая ярмарка в работе",
                                style = MaterialTheme.typography.labelSmall,
                                color = Color.White.copy(alpha = 0.45f)
                            )
                        }
                        AssistChip(
                            onClick = { },
                            enabled = false,
                            label = { Text("🌙 Тёмная", fontWeight = FontWeight.SemiBold) },
                            colors = AssistChipDefaults.assistChipColors(
                                disabledContainerColor = FairyGold.copy(alpha = 0.18f),
                                disabledLabelColor = FairyGold
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
                            Text("О приложении", style = MaterialTheme.typography.titleMedium, color = FairyGold, fontWeight = FontWeight.SemiBold)
                            Text(
                                "Версия ${BuildConfig.VERSION_NAME} · код ${BuildConfig.VERSION_CODE}",
                                style = MaterialTheme.typography.labelSmall,
                                color = Color.White.copy(alpha = 0.5f)
                            )
                        }
                        IconButton(onClick = { showFaqDialog = true }) {
                            Icon(Icons.Default.Info, "ЧАВО", tint = FairyGold)
                        }
                    }
                    Spacer(Modifier.height(8.dp))
                    Text(
                        "«Из грязи в князи» — симулятор купца-инвестора в сказочной Руси. " +
                            "Игра — для удовольствия. AI-беседы оплачиваются через OpenRouter.",
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
                        Text("❓ ЧАВО — частые вопросы", fontWeight = FontWeight.SemiBold)
                    }
                }

                OrnamentDivider()

                // ── Сброс игры ─────────────────────────────────────────
                FairyCard(modifier = Modifier.fillMaxWidth()) {
                    Text(
                        "Опасная зона",
                        style = MaterialTheme.typography.titleMedium,
                        color = Error,
                        fontWeight = FontWeight.SemiBold
                    )
                    Spacer(Modifier.height(8.dp))
                    Text(
                        "Сброс удалит всё: злато, сделки, историю бесед. Игра начнётся заново с нуля.",
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
                        Text("Начать заново", fontWeight = FontWeight.SemiBold)
                    }
                }
            }
        }
    }

    if (showResetDialog) {
        AlertDialog(
            onDismissRequest = { showResetDialog = false },
            title = { Text("Начать заново?") },
            text = { Text("Все данные будут удалены. Это действие необратимо.") },
            confirmButton = {
                Button(
                    onClick = {
                        showResetDialog = false
                        viewModel.resetGame()
                    },
                    colors = ButtonDefaults.buttonColors(containerColor = Error)
                ) { Text("Сбросить всё") }
            },
            dismissButton = {
                TextButton(onClick = { showResetDialog = false }) { Text("Отмена") }
            }
        )
    }

    if (showFaqDialog) {
        AlertDialog(
            onDismissRequest = { showFaqDialog = false },
            title = { Text("❓ ЧАВО") },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    FaqEntry(
                        q = "Что за гроши?",
                        a = "Внутриигровая валюта. Реальных денег не стоит и нигде не торгуется."
                    )
                    FaqEntry(
                        q = "Откуда берётся ответ дельца?",
                        a = "AI-модель из OpenRouter (по умолчанию DeepSeek v4 Flash). Ключ передаётся из секретов CI и сохраняется в local.properties. На устройстве хранится только баланс игры."
                    )
                    FaqEntry(
                        q = "Что даёт связь с дельцом?",
                        a = "Каждый закрытый в плюс деал даёт +1 уровень связи (cap 10) и +1 жетон архетипа. Жетон можно потратить, чтобы пропустить мини-игру."
                    )
                    FaqEntry(
                        q = "Как растёт стрик «Сегодня»?",
                        a = "Каждый календарный день (МСК) на вкладке «🔥 Сегодня» серия растёт +1. Если пропустишь день — серия сбрасывается на 1."
                    )
                    FaqEntry(
                        q = "Можно ли восстановить прогресс после Сброса?",
                        a = "Нет — данные хранятся локально в Room-БД, после сброса безвозвратно удаляются."
                    )
                }
            },
            confirmButton = {
                TextButton(onClick = { showFaqDialog = false }) { Text("Понятно", color = FairyGold) }
            }
        )
    }
}

@Composable
private fun FaqEntry(q: String, a: String) {
    Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
        Text(q, style = MaterialTheme.typography.bodyMedium, fontWeight = FontWeight.SemiBold)
        Text(a, style = MaterialTheme.typography.bodySmall, color = Color.White.copy(alpha = 0.75f))
    }
}
