package com.s0dolamby.game.presentation.feedback

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.s0dolamby.game.domain.usecase.FeedbackType
import com.s0dolamby.game.domain.usecase.SendFeedbackUseCase
import com.s0dolamby.game.presentation.common.components.FairyCard
import com.s0dolamby.game.presentation.common.components.fairyOnCardTextFieldColors
import com.s0dolamby.game.presentation.common.i18n.Strings
import com.s0dolamby.game.presentation.common.theme.Error
import com.s0dolamby.game.presentation.common.theme.FairyGold
import com.s0dolamby.game.presentation.common.theme.LocalAccentOnCard
import com.s0dolamby.game.presentation.common.theme.LocalContentColorMuted
import com.s0dolamby.game.presentation.common.theme.Success
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

enum class FeedbackSendState { IDLE, SENDING, OK, ERROR }

@HiltViewModel
class FeedbackViewModel @Inject constructor(
    private val sendFeedbackUseCase: SendFeedbackUseCase
) : ViewModel() {
    private val _state = MutableStateFlow(FeedbackSendState.IDLE)
    val state = _state.asStateFlow()

    fun send(type: FeedbackType, message: String, page: String?) {
        viewModelScope.launch {
            _state.value = FeedbackSendState.SENDING
            val ok = sendFeedbackUseCase(type, message, page).isSuccess
            _state.value = if (ok) FeedbackSendState.OK else FeedbackSendState.ERROR
        }
    }

    fun reset() { _state.value = FeedbackSendState.IDLE }
}

/**
 * Кнопка-язычок «🐞 Тестерам» в нижнем углу — на каждой странице. Тап
 * открывает попап (тип: баг/предложение/вопрос + текст). Отправленное
 * привязывается к текущему экрану, версии и автору и уходит в Postgres
 * на Railway. Тестовая версия — на релизе можно спрятать.
 */
@Composable
fun FeedbackReporter(
    page: String?,
    modifier: Modifier = Modifier,
    viewModel: FeedbackViewModel = hiltViewModel()
) {
    var open by remember { mutableStateOf(false) }

    // Компактный «язычок» в углу
    Box(
        modifier = modifier
            .clip(RoundedCornerShape(topStart = 12.dp, bottomStart = 12.dp))
            .background(Color(0xE01A0E2E))
            .border(1.dp, FairyGold.copy(alpha = 0.45f), RoundedCornerShape(topStart = 12.dp, bottomStart = 12.dp))
            .clickable { open = true }
            .padding(horizontal = 12.dp, vertical = 7.dp)
    ) {
        Text(Strings.t("feedback.tab"), color = FairyGold, fontSize = 12.sp, fontWeight = FontWeight.SemiBold)
    }

    if (open) {
        val sendState by viewModel.state.collectAsState()
        FeedbackDialog(
            page = page,
            sendState = sendState,
            onSend = { type, msg -> viewModel.send(type, msg, page) },
            onClose = {
                open = false
                viewModel.reset()
            }
        )
    }
}

@Composable
private fun FeedbackDialog(
    page: String?,
    sendState: FeedbackSendState,
    onSend: (FeedbackType, String) -> Unit,
    onClose: () -> Unit
) {
    var type by remember { mutableStateOf(FeedbackType.BUG) }
    var text by remember { mutableStateOf("") }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(Color(0xCC060412))
            .clickable(
                interactionSource = remember { MutableInteractionSource() },
                indication = null
            ) { onClose() },
        contentAlignment = Alignment.Center
    ) {
        // Внутренний Box глотает тапы, чтобы клик по карточке не закрывал попап
        Box(
            modifier = Modifier
                .padding(horizontal = 24.dp)
                .clickable(
                    interactionSource = remember { MutableInteractionSource() },
                    indication = null
                ) {}
        ) {
            FairyCard(modifier = Modifier.fillMaxWidth()) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.SpaceBetween,
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Text(
                        Strings.t("feedback.title"),
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.Bold,
                        color = LocalAccentOnCard.current
                    )
                    Text(
                        "✕",
                        color = LocalContentColorMuted.current,
                        fontSize = 18.sp,
                        modifier = Modifier.clickable { onClose() }.padding(4.dp)
                    )
                }
                page?.let {
                    Text(
                        Strings.t("feedback.page", it),
                        style = MaterialTheme.typography.labelSmall,
                        color = LocalContentColorMuted.current
                    )
                }
                Spacer(Modifier.height(10.dp))

                // Выбор типа
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.fillMaxWidth()) {
                    TypeChip("🐞", "feedback.type.bug", type == FeedbackType.BUG, Modifier.weight(1f)) { type = FeedbackType.BUG }
                    TypeChip("💡", "feedback.type.suggestion", type == FeedbackType.SUGGESTION, Modifier.weight(1f)) { type = FeedbackType.SUGGESTION }
                    TypeChip("❓", "feedback.type.question", type == FeedbackType.QUESTION, Modifier.weight(1f)) { type = FeedbackType.QUESTION }
                }
                Spacer(Modifier.height(10.dp))

                OutlinedTextField(
                    value = text,
                    onValueChange = { text = it.take(2000) },
                    modifier = Modifier.fillMaxWidth(),
                    minLines = 3,
                    placeholder = { Text(Strings.t("feedback.placeholder")) },
                    colors = fairyOnCardTextFieldColors()
                )
                Spacer(Modifier.height(10.dp))

                Button(
                    onClick = { onSend(type, text) },
                    enabled = text.trim().length >= 3 && sendState != FeedbackSendState.SENDING,
                    modifier = Modifier.fillMaxWidth(),
                    colors = ButtonDefaults.buttonColors(
                        containerColor = FairyGold,
                        contentColor = Color(0xFF1A0A00),
                        disabledContainerColor = FairyGold.copy(alpha = 0.35f),
                        disabledContentColor = Color(0xFF1A0A00).copy(alpha = 0.5f)
                    )
                ) {
                    Text(
                        if (sendState == FeedbackSendState.SENDING) Strings.t("feedback.sending")
                        else Strings.t("feedback.send"),
                        fontWeight = FontWeight.SemiBold
                    )
                }
                when (sendState) {
                    FeedbackSendState.OK -> {
                        Spacer(Modifier.height(6.dp))
                        Text(Strings.t("feedback.ok"), color = Success, style = MaterialTheme.typography.labelMedium)
                        androidx.compose.runtime.LaunchedEffect(Unit) {
                            kotlinx.coroutines.delay(1200)
                            onClose()
                        }
                    }
                    FeedbackSendState.ERROR -> {
                        Spacer(Modifier.height(6.dp))
                        Text(Strings.t("feedback.err"), color = Error, style = MaterialTheme.typography.labelMedium)
                    }
                    else -> Unit
                }
            }
        }
    }
}

@Composable
private fun TypeChip(
    emoji: String,
    labelKey: String,
    selected: Boolean,
    modifier: Modifier = Modifier,
    onClick: () -> Unit
) {
    val accent = LocalAccentOnCard.current
    Box(
        modifier = modifier
            .clip(RoundedCornerShape(10.dp))
            .background(if (selected) accent.copy(alpha = 0.18f) else Color.Transparent)
            .border(
                1.dp,
                if (selected) accent.copy(alpha = 0.7f) else LocalContentColorMuted.current.copy(alpha = 0.4f),
                RoundedCornerShape(10.dp)
            )
            .clickable { onClick() }
            .padding(vertical = 8.dp),
        contentAlignment = Alignment.Center
    ) {
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            Text(emoji, fontSize = 18.sp)
            Text(
                Strings.t(labelKey),
                fontSize = 10.sp,
                color = if (selected) accent else LocalContentColorMuted.current,
                fontWeight = if (selected) FontWeight.SemiBold else FontWeight.Normal
            )
        }
    }
}
