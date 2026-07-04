package com.s0dolamby.game.data.science

import com.google.gson.Gson
import com.s0dolamby.game.data.db.dao.PlayerDao
import com.s0dolamby.game.data.logging.AppLogger
import com.s0dolamby.game.domain.model.Project
import com.s0dolamby.game.domain.science.ScienceCard
import com.s0dolamby.game.domain.science.ScienceCatalog
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.runBlocking
import javax.inject.Inject
import javax.inject.Singleton

/**
 * «Наука старца»: открытые карты приёмов + очередь свежеоткрытых для
 * оверлея (по образцу AchievementUnlockStore/MinigameUnlockStore).
 *
 * Источник истины — in-memory StateFlow, сеется из game_state.scienceCardsJson
 * на старте процесса; запись идёт синхронно в память и в Room в том же
 * suspend-вызове (unlockFor зовут use-case'ы из корутин).
 */
@Singleton
class ScienceUnlockStore @Inject constructor(
    private val playerDao: PlayerDao,
    private val gson: Gson
) {
    private val _unlockedIds = MutableStateFlow(
        runBlocking {
            runCatching {
                gson.fromJson(
                    playerDao.getGameState()?.scienceCardsJson ?: "[]",
                    Array<String>::class.java
                ).toSet()
            }.getOrDefault(emptySet())
        }
    )
    val unlockedIds: StateFlow<Set<String>> = _unlockedIds.asStateFlow()

    private val _queue = MutableStateFlow<List<ScienceCard>>(emptyList())
    val queue: StateFlow<List<ScienceCard>> = _queue.asStateFlow()

    /**
     * Выдать науку за закрытое дело: первый ещё не открытый приём из
     * кандидатов (архетип → судьба → особые). Возвращает открытую карту
     * или null, если вся наука этого дела уже усвоена.
     */
    suspend fun unlockFor(project: Project): ScienceCard? {
        val card = ScienceCatalog.candidatesFor(project)
            .firstOrNull { it.id !in _unlockedIds.value } ?: return null

        _unlockedIds.update { it + card.id }
        _queue.update { it + card }
        playerDao.getGameState()?.let { state ->
            playerDao.update(state.copy(scienceCardsJson = gson.toJson(_unlockedIds.value.toList())))
        }
        AppLogger.i("Science", "unlocked '${card.id}' for ${project.claimedName}")
        return card
    }

    /** Оверлей показан — убрать верхнюю карту из очереди. */
    fun pop() = _queue.update { it.drop(1) }

    /** Полный сброс при «Начать заново» (Room уже вычищен clearAllTables). */
    fun clearAll() {
        _unlockedIds.value = emptySet()
        _queue.value = emptyList()
    }
}
