package com.s0dolamby.game.data.minigame

import com.s0dolamby.game.presentation.minigame.common.MinigameOutcome
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import javax.inject.Inject
import javax.inject.Singleton

/**
 * In-memory хранилище результатов мини-игр по делам.
 * Не персистится — сбрасывается при restart процесса. Этого достаточно для MVP:
 * игрок сыграл → разрешено вложить → вложил. Если приложение убили — пересыграет.
 *
 * Доступно через Hilt. Сохранение в Room — следующая фаза.
 */
@Singleton
class MinigameUnlockStore @Inject constructor() {
    private val _outcomes = MutableStateFlow<Map<String, MinigameOutcome>>(emptyMap())
    val outcomes: StateFlow<Map<String, MinigameOutcome>> = _outcomes.asStateFlow()

    fun outcomeFor(projectId: String): MinigameOutcome? = _outcomes.value[projectId]

    fun isUnlocked(projectId: String): Boolean =
        _outcomes.value[projectId]?.isWin == true

    fun record(projectId: String, outcome: MinigameOutcome) {
        _outcomes.update { it + (projectId to outcome) }
    }

    fun clear(projectId: String) {
        _outcomes.update { it - projectId }
    }
}
