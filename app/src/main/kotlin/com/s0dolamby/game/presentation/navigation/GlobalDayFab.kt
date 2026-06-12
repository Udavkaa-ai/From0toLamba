package com.s0dolamby.game.presentation.navigation

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.scaleIn
import androidx.compose.animation.scaleOut
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.collectAsState
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.s0dolamby.game.domain.usecase.AdvanceDayUseCase
import com.s0dolamby.game.presentation.common.theme.EnchantedPurple
import com.s0dolamby.game.presentation.common.theme.FairyGold
import com.s0dolamby.game.presentation.common.theme.NightBlue
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

@HiltViewModel
class GlobalDayFabViewModel @Inject constructor(
    private val advanceDayUseCase: AdvanceDayUseCase
) : ViewModel() {
    private val _isLoading = MutableStateFlow(false)
    val isLoading: StateFlow<Boolean> = _isLoading.asStateFlow()

    fun advanceDay() {
        if (_isLoading.value) return
        viewModelScope.launch {
            _isLoading.value = true
            advanceDayUseCase()
            _isLoading.value = false
        }
    }
}

/**
 * Плавающая кнопка «🌅 Следующий день», висящая поверх NavHost на всех «обычных»
 * экранах. Скрывается на экранах, где она мешает (мини-игры, AMA-чат, gate,
 * онбординг).
 */
@Composable
fun GlobalDayFab(
    visible: Boolean,
    modifier: Modifier = Modifier,
    viewModel: GlobalDayFabViewModel = hiltViewModel()
) {
    val isLoading by viewModel.isLoading.collectAsState()
    AnimatedVisibility(
        visible = visible,
        enter = fadeIn() + scaleIn(initialScale = 0.85f),
        exit = fadeOut() + scaleOut(targetScale = 0.85f),
        modifier = modifier
    ) {
        Box(
            modifier = Modifier
                .padding(end = 16.dp, bottom = 96.dp)
                .shadow(12.dp, RoundedCornerShape(28.dp))
                .clip(RoundedCornerShape(28.dp))
                .background(
                    Brush.linearGradient(listOf(EnchantedPurple, NightBlue))
                )
                .border(1.5.dp, FairyGold.copy(alpha = 0.5f), RoundedCornerShape(28.dp))
                .clickable(enabled = !isLoading) { viewModel.advanceDay() }
                .padding(horizontal = 18.dp, vertical = 14.dp),
            contentAlignment = Alignment.Center
        ) {
            Text(
                if (isLoading) "⏳  Течёт время..." else "🌅  Следующий день",
                color = FairyGold,
                fontSize = 14.sp,
                fontWeight = FontWeight.SemiBold
            )
        }
    }
}
