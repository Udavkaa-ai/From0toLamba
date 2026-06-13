package com.s0dolamby.game.data.achievements

import com.s0dolamby.game.domain.achievements.Achievement
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Очередь только что разблокированных подвигов. Use-cases пушат сюда
 * после успешного recomputeAchievements(); UI слушает [queue] и
 * показывает [AchievementUnlockedOverlay] на верхнем элементе.
 *
 * Хранится in-memory — после убийства процесса очередь сбрасывается.
 * Этого достаточно: подвиг останется отмеченным в БД, а пропущенное
 * поздравление не критично.
 */
@Singleton
class AchievementUnlockStore @Inject constructor() {

    private val _queue = MutableStateFlow<List<Achievement>>(emptyList())
    val queue: StateFlow<List<Achievement>> = _queue.asStateFlow()

    fun push(items: List<Achievement>) {
        if (items.isEmpty()) return
        _queue.update { current -> current + items }
    }

    fun pop() {
        _queue.update { it.drop(1) }
    }
}
