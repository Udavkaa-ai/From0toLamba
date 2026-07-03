package com.s0dolamby.game.data.news

import com.s0dolamby.game.domain.model.DailyUpdate
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Очередь «Вестей дня» после advance-day. Живёт синглтоном, а не во
 * ViewModel главной — колода должна показываться на ЛЮБОМ экране, где
 * нажали «Следующий день» (глобальная кнопка есть везде).
 */
@Singleton
class DayNewsStore @Inject constructor() {

    private val _pending = MutableStateFlow<List<DailyUpdate>>(emptyList())
    val pending: StateFlow<List<DailyUpdate>> = _pending.asStateFlow()

    /** Вести, на которые игрок уже отреагировал «Сечением» — по одной реакции. */
    private val _reactedIds = MutableStateFlow<Set<String>>(emptySet())
    val reactedIds: StateFlow<Set<String>> = _reactedIds.asStateFlow()

    fun push(updates: List<DailyUpdate>) {
        if (updates.isNotEmpty()) _pending.update { it + updates }
    }

    fun dismiss(update: DailyUpdate) {
        _pending.update { list -> list.filter { it.id != update.id } }
    }

    fun markReacted(updateId: String) {
        _reactedIds.update { it + updateId }
    }

    fun clear() {
        _pending.value = emptyList()
        _reactedIds.value = emptySet()
    }
}
