package com.s0dolamby.game.domain.repository

import com.s0dolamby.game.domain.model.DailyUpdate
import kotlinx.coroutines.flow.Flow

interface UpdateRepository {
    fun observeUpdates(): Flow<List<DailyUpdate>>
    suspend fun saveUpdate(update: DailyUpdate)
    suspend fun getUpdatesForProject(projectId: String): List<DailyUpdate>
}
