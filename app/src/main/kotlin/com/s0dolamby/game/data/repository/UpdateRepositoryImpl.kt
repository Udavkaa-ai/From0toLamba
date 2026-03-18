package com.s0dolamby.game.data.repository

import com.google.gson.Gson
import com.s0dolamby.game.data.db.dao.UpdateDao
import com.s0dolamby.game.data.db.entity.toDomain
import com.s0dolamby.game.data.db.entity.toEntity
import com.s0dolamby.game.domain.model.DailyUpdate
import com.s0dolamby.game.domain.repository.UpdateRepository
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map
import javax.inject.Inject

class UpdateRepositoryImpl @Inject constructor(
    private val dao: UpdateDao,
    private val gson: Gson
) : UpdateRepository {

    override fun observeUpdates(): Flow<List<DailyUpdate>> =
        dao.observeAll().map { list -> list.map { it.toDomain(gson) } }

    override suspend fun saveUpdate(update: DailyUpdate) =
        dao.insert(update.toEntity(gson))

    override suspend fun getUpdatesForProject(projectId: String): List<DailyUpdate> =
        dao.getForProject(projectId).map { it.toDomain(gson) }
}
