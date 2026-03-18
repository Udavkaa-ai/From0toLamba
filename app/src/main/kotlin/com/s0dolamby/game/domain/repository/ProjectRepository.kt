package com.s0dolamby.game.domain.repository

import com.s0dolamby.game.domain.model.Project
import kotlinx.coroutines.flow.Flow

interface ProjectRepository {
    fun getActiveProjects(): Flow<List<Project>>
    fun getInboxProjects(): Flow<List<Project>>
    fun getClosedProjects(): Flow<List<Project>>
    suspend fun getProjectById(id: String): Project?
    suspend fun saveProject(project: Project)
    suspend fun updateProject(project: Project)
    suspend fun closeProject(projectId: String, reason: String)
    suspend fun updateBannerUrl(projectId: String, url: String, promptUsed: String)
    suspend fun closeAllInboxProjects()
}
