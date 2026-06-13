package com.s0dolamby.game.presentation.relationships

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.s0dolamby.game.domain.model.GameState
import com.s0dolamby.game.domain.model.PersonaArchetype
import com.s0dolamby.game.domain.repository.GameStateRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.*
import javax.inject.Inject

data class ArchetypeEntry(
    val archetype: PersonaArchetype,
    val tieLevel: Int,
    val tokens: Int
) {
    val seen: Boolean get() = tieLevel > 0 || tokens > 0
}

data class RelationshipsUiState(
    val entries: List<ArchetypeEntry> = emptyList(),
    val tiesTotal: Int = 0,
    val seenCount: Int = 0,
    val maxLevel: Int = GameState.MAX_TIE_LEVEL,
    val bonusPercentPerLevel: Int = GameState.TIE_BONUS_PERCENT_PER_LEVEL
)

@HiltViewModel
class RelationshipsViewModel @Inject constructor(
    gameStateRepository: GameStateRepository
) : ViewModel() {

    val uiState: StateFlow<RelationshipsUiState> = gameStateRepository.observeGameState()
        .map { state ->
            val entries = PersonaArchetype.values().map { arch ->
                ArchetypeEntry(
                    archetype = arch,
                    tieLevel = state.tieLevels[arch] ?: 0,
                    tokens = state.archetypeTokens[arch] ?: 0
                )
            }
            RelationshipsUiState(
                entries = entries,
                tiesTotal = entries.sumOf { it.tieLevel },
                seenCount = entries.count { it.seen }
            )
        }
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), RelationshipsUiState())
}
