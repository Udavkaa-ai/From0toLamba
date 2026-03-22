package com.s0dolamby.game.data.repository

import com.google.gson.Gson
import com.s0dolamby.game.data.db.dao.ProjectDao
import com.s0dolamby.game.data.db.entity.toDomain
import com.s0dolamby.game.data.db.entity.toEntity
import com.s0dolamby.game.domain.model.Project
import com.s0dolamby.game.domain.repository.ProjectRepository
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map
import javax.inject.Inject

class ProjectRepositoryImpl @Inject constructor(
    private val dao: ProjectDao,
    private val gson: Gson
) : ProjectRepository {

    override fun getActiveProjects(): Flow<List<Project>> =
        dao.observeActiveProjects().map { list -> list.map { it.toDomain(gson) } }

    override fun getInboxProjects(): Flow<List<Project>> =
        dao.observeInboxProjects().map { list -> list.map { it.toDomain(gson) } }

    override fun getClosedProjects(): Flow<List<Project>> =
        dao.observeClosedProjects().map { list -> list.map { it.toDomain(gson) } }

    override suspend fun getProjectById(id: String): Project? =
        dao.getById(id)?.toDomain(gson)

    override suspend fun saveProject(project: Project) =
        dao.insert(project.toEntity(gson))

    override suspend fun updateProject(project: Project) =
        dao.update(project.toEntity(gson))

    override suspend fun closeProject(projectId: String, reason: String, returnedValueRubles: Double) =
        dao.closeProject(projectId, reason, returnedValueRubles)

    override suspend fun updateBannerUrl(projectId: String, url: String, promptUsed: String) =
        dao.updateBanner(projectId, url, promptUsed)

    override suspend fun closeAllInboxProjects() = dao.closeAllInboxProjects()

    override suspend fun markLieGuessCorrect(projectId: String) = dao.markLieGuessCorrect(projectId)

    override suspend fun getActiveProjectsTotalValue(): Double =
        dao.getActiveProjects().sumOf { it.currentValueRubles }
}
