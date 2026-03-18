package com.s0dolamby.game.presentation.inbox

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.s0dolamby.game.domain.model.Project
import com.s0dolamby.game.domain.repository.ProjectRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.*
import javax.inject.Inject

@HiltViewModel
class InboxViewModel @Inject constructor(
    private val projectRepository: ProjectRepository
) : ViewModel() {

    val inboxProjects: StateFlow<List<Project>> = projectRepository.getInboxProjects()
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())
}
