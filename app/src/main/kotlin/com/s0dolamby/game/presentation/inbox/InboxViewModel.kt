package com.s0dolamby.game.presentation.inbox

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.s0dolamby.game.data.minigame.MinigameUnlockStore
import com.s0dolamby.game.domain.model.Project
import com.s0dolamby.game.domain.repository.ProjectRepository
import com.s0dolamby.game.presentation.minigame.common.MinigameOutcome
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.*
import javax.inject.Inject

@HiltViewModel
class InboxViewModel @Inject constructor(
    private val projectRepository: ProjectRepository,
    private val unlockStore: MinigameUnlockStore
) : ViewModel() {

    val inboxProjects: StateFlow<List<Project>> = projectRepository.getInboxProjects()
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    /** Map projectId → MinigameOutcome для уже пройденных дел. */
    val unlockOutcomes: StateFlow<Map<String, MinigameOutcome>> = unlockStore.outcomes
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyMap())
}
