package com.s0dolamby.game.presentation.settings

import androidx.compose.foundation.layout.*
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
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
    viewModel: SettingsViewModel = hiltViewModel()
) {
    val uiState by viewModel.uiState.collectAsState()
    var showResetDialog by remember { mutableStateOf(false) }

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
                    .padding(horizontal = 16.dp),
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

                // ── Генерация картинок ─────────────────────────────────
                FairyCard(modifier = Modifier.fillMaxWidth()) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        Column(modifier = Modifier.weight(1f)) {
                            Text(
                                "Генерация баннеров",
                                style = MaterialTheme.typography.titleMedium,
                                color = FairyGold,
                                fontWeight = FontWeight.SemiBold
                            )
                            Text(
                                "Создавать картинки для новых дел через Pollinations",
                                style = MaterialTheme.typography.bodySmall,
                                color = Color.White.copy(alpha = 0.6f)
                            )
                        }
                        Switch(
                            checked = uiState.settings.imageGenerationEnabled,
                            onCheckedChange = { viewModel.setImageGenerationEnabled(it) },
                            colors = SwitchDefaults.colors(
                                checkedThumbColor = FairyGold,
                                checkedTrackColor = FairyGold.copy(alpha = 0.4f)
                            )
                        )
                    }
                }

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
                        Text("🔑 Золотой ключик (BURATINO)", fontWeight = FontWeight.SemiBold)
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
}
