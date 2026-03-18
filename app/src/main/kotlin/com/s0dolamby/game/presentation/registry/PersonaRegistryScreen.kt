package com.s0dolamby.game.presentation.registry

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material.icons.filled.Lock
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.s0dolamby.game.domain.model.PersonaArchetype
import com.s0dolamby.game.domain.repository.AmaRepository
import com.s0dolamby.game.domain.repository.ProjectRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.launch
import javax.inject.Inject

data class PersonaEntry(
    val archetype: PersonaArchetype,
    val encountered: Boolean,
    val timesIdentified: Int,
    val projectsClosed: Int
)

@HiltViewModel
class PersonaRegistryViewModel @Inject constructor(
    private val projectRepository: ProjectRepository
) : ViewModel() {

    val entries: StateFlow<List<PersonaEntry>> = projectRepository.getClosedProjects()
        .map { closedProjects ->
            PersonaArchetype.values().map { archetype ->
                val projectsWithArchetype = closedProjects.filter { it.personaArchetype == archetype }
                PersonaEntry(
                    archetype = archetype,
                    encountered = projectsWithArchetype.isNotEmpty(),
                    timesIdentified = 0,
                    projectsClosed = projectsWithArchetype.size
                )
            }
        }
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun PersonaRegistryScreen(
    onBack: () -> Unit,
    viewModel: PersonaRegistryViewModel = hiltViewModel()
) {
    val entries by viewModel.entries.collectAsState()

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Энциклопедия разработчиков") },
                navigationIcon = {
                    IconButton(onClick = onBack) { Icon(Icons.Default.ArrowBack, "Назад") }
                }
            )
        }
    ) { padding ->
        LazyColumn(
            modifier = Modifier.fillMaxSize().padding(padding),
            contentPadding = PaddingValues(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            item {
                Text(
                    "Архетипы разработчиков открываются после закрытия проектов",
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
            items(entries) { entry ->
                PersonaCard(entry = entry)
            }
        }
    }
}

@Composable
private fun PersonaCard(entry: PersonaEntry) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(
            containerColor = if (entry.encountered) MaterialTheme.colorScheme.surface
            else MaterialTheme.colorScheme.surfaceVariant
        )
    ) {
        Row(
            modifier = Modifier.padding(16.dp).fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            if (!entry.encountered) {
                Icon(
                    Icons.Default.Lock,
                    contentDescription = null,
                    tint = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.size(40.dp)
                )
            } else {
                Surface(
                    modifier = Modifier.size(40.dp),
                    shape = MaterialTheme.shapes.medium,
                    color = MaterialTheme.colorScheme.primary
                ) {
                    Box(contentAlignment = Alignment.Center) {
                        Text(
                            entry.archetype.emoji,
                            style = MaterialTheme.typography.titleMedium
                        )
                    }
                }
            }

            Column(modifier = Modifier.weight(1f)) {
                Text(
                    if (entry.encountered) entry.archetype.displayName else "???",
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Bold
                )
                if (entry.encountered) {
                    Text(
                        entry.archetype.description,
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        maxLines = 2
                    )
                    Text(
                        "Встречено проектов: ${entry.projectsClosed}",
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                } else {
                    Text(
                        "Закрой проект с этим архетипом, чтобы разблокировать",
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            }
        }
    }
}

val PersonaArchetype.displayName: String get() = when (this) {
    PersonaArchetype.CLASSIC_SCAMMER -> "Классический скамер"
    PersonaArchetype.PSEUDO_PRO -> "Псевдо-профессионал"
    PersonaArchetype.NAIVE_ENTHUSIAST -> "Наивный энтузиаст"
    PersonaArchetype.BUSINESS_SHARK -> "Бизнес-акула"
    PersonaArchetype.SWEET_INFLUENCER -> "Сладкий инфлюенсер"
    PersonaArchetype.SILENT_TECHIE -> "Молчаливый технарь"
    PersonaArchetype.SERIAL_FOUNDER -> "Серийный основатель"
}

val PersonaArchetype.emoji: String get() = when (this) {
    PersonaArchetype.CLASSIC_SCAMMER -> "🐍"
    PersonaArchetype.PSEUDO_PRO -> "👔"
    PersonaArchetype.NAIVE_ENTHUSIAST -> "🌱"
    PersonaArchetype.BUSINESS_SHARK -> "🦈"
    PersonaArchetype.SWEET_INFLUENCER -> "💅"
    PersonaArchetype.SILENT_TECHIE -> "💻"
    PersonaArchetype.SERIAL_FOUNDER -> "🔄"
}

val PersonaArchetype.description: String get() = when (this) {
    PersonaArchetype.CLASSIC_SCAMMER -> "Давит на срочность. При давлении — агрессивен, переходит на личности."
    PersonaArchetype.PSEUDO_PRO -> "Много терминов, ссылается на Dubai. Уходит в жаргон под давлением."
    PersonaArchetype.NAIVE_ENTHUSIAST -> "Мы-форма, искренний но некомпетентный. Может случайно раскрыть правду."
    PersonaArchetype.BUSINESS_SHARK -> "Говорит метриками. Убедителен — может быть как скамом, так и единорогом."
    PersonaArchetype.SWEET_INFLUENCER -> "Много эмодзи, апелляция к эмоциям. Всегда «уже вложила сама»."
    PersonaArchetype.SILENT_TECHIE -> "Технический язык, избегает простых ответов. Аноним."
    PersonaArchetype.SERIAL_FOUNDER -> "Открыт про провалы. Может неожиданно оказаться честным."
}
