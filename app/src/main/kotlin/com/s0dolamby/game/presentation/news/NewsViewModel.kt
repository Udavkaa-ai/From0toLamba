package com.s0dolamby.game.presentation.news

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.s0dolamby.game.domain.model.DailyUpdate
import com.s0dolamby.game.domain.repository.UpdateRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.*
import javax.inject.Inject

@HiltViewModel
class NewsViewModel @Inject constructor(
    updateRepository: UpdateRepository
) : ViewModel() {
    val updates: StateFlow<List<DailyUpdate>> = updateRepository.observeUpdates()
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())
}
