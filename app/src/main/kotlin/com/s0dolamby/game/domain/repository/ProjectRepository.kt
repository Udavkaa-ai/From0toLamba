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
    suspend fun closeProject(projectId: String, reason: String, returnedValueRubles: Double)
    suspend fun updateBannerUrl(projectId: String, url: String, promptUsed: String)
    suspend fun getInboxProjectsList(): List<Project>
    suspend fun closeAllInboxProjects()
    suspend fun getActiveProjectsTotalValue(): Double

    // «Верю — не верю»
    /** Записать прогноз (одна ставка на дело). true — записан, false — уже была/дело закрыто. */
    suspend fun setPlayerVerdict(projectId: String, verdict: com.s0dolamby.game.domain.model.PlayerVerdict): Boolean
    /** Зафиксировать итог прогноза после закрытия дела. */
    suspend fun setVerdictResolved(projectId: String, correct: Boolean)
    /** Закрытые дела со ставкой, ещё не сверенной с судьбой. */
    suspend fun getUnresolvedVerdictProjects(): List<Project>
}
