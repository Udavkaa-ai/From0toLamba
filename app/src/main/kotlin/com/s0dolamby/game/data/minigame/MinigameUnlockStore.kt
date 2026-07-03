package com.s0dolamby.game.data.minigame

import com.s0dolamby.game.data.db.dao.MinigameUnlockDao
import com.s0dolamby.game.data.db.entity.MinigameUnlockEntity
import com.s0dolamby.game.presentation.minigame.common.MinigameOutcome
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import kotlinx.coroutines.runBlocking
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Хранилище результатов мини-игр по делам.
 *
 * Источник истины — in-memory StateFlow, который seedится из таблицы
 * `minigame_unlock` Room на старте процесса (runBlocking — мы провайдер
 * Hilt-синглетона, и инициализация исполняется один раз). Запись/очистка
 * меняют StateFlow синхронно и пишут в Room в фоне, поэтому Inbox-карточки
 * и MinigameGate ViewModel в `init {}` видят актуальное состояние без
 * гонок.
 *
 * Это закрывает баг «после ребута процесса мини-игра предлагается заново
 * на уже разблокированном деле».
 */
@Singleton
class MinigameUnlockStore @Inject constructor(
    private val dao: MinigameUnlockDao
) {
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

    private val _outcomes = MutableStateFlow<Map<String, MinigameOutcome>>(
        runBlocking { dao.getAll().associate { it.projectId to it.toOutcome() } }
    )
    val outcomes: StateFlow<Map<String, MinigameOutcome>> = _outcomes.asStateFlow()

    fun outcomeFor(projectId: String): MinigameOutcome? = _outcomes.value[projectId]

    fun isUnlocked(projectId: String): Boolean =
        _outcomes.value[projectId]?.isWin == true

    fun record(projectId: String, outcome: MinigameOutcome) {
        _outcomes.update { it + (projectId to outcome) }
        scope.launch {
            dao.upsert(
                MinigameUnlockEntity(
                    projectId = projectId,
                    errorCount = outcome.errorCount,
                    timeoutReached = outcome.timeoutReached
                )
            )
        }
    }

    fun clear(projectId: String) {
        _outcomes.update { it - projectId }
        scope.launch { dao.delete(projectId) }
    }

    /**
     * Полный сброс (кнопка «Начать заново»). Таблицу Room к этому моменту
     * уже стёр db.clearAllTables() — чистим только in-memory снапшот,
     * иначе старые unlock'и переживают сброс до перезапуска процесса.
     */
    fun clearAll() {
        _outcomes.value = emptyMap()
    }

    private fun MinigameUnlockEntity.toOutcome() = MinigameOutcome(
        errorCount = errorCount,
        timeoutReached = timeoutReached
    )
}
