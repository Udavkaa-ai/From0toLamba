package com.s0dolamby.game.presentation.registry

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import com.s0dolamby.game.R
import com.s0dolamby.game.domain.model.PersonaArchetype
import com.s0dolamby.game.domain.model.ProjectType
import com.s0dolamby.game.presentation.common.components.FairyCard
import com.s0dolamby.game.presentation.common.components.PersonaAvatar
import com.s0dolamby.game.presentation.common.components.ScreenBackground
import com.s0dolamby.game.presentation.common.i18n.Strings
import com.s0dolamby.game.presentation.common.theme.FairyGold
import androidx.compose.foundation.background
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.*
import javax.inject.Inject
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.s0dolamby.game.domain.repository.ProjectRepository

data class PersonaEntry(
    val archetype: PersonaArchetype,
    val encountered: Boolean,
    val timesIdentified: Int,
    val projectsClosed: Int,
    val tieLevel: Int = 0,
    val tokens: Int = 0
)

data class RegistryUiState(
    val personas: List<PersonaEntry> = emptyList(),
    val encounteredTypes: List<ProjectType> = emptyList(),
    val lockedCount: Int = 0
)

@HiltViewModel
class PersonaRegistryViewModel @Inject constructor(
    private val projectRepository: ProjectRepository,
    private val gameStateRepository: com.s0dolamby.game.domain.repository.GameStateRepository
) : ViewModel() {

    val uiState: StateFlow<RegistryUiState> = combine(
        projectRepository.getClosedProjects(),
        projectRepository.getActiveProjects(),
        gameStateRepository.observeGameState()
    ) { closed, active, state ->
        // Архетип открывается, когда дело закрылось с вложенными грошами
        // (либо живёт сейчас как активное), либо когда есть связь/жетон.
        val unlockedClosed = closed.filter { it.investedAmountRubles > 0 }
        val allUnlocked = (unlockedClosed + active).distinctBy { it.id }

        val personas = PersonaArchetype.values().map { archetype ->
            val projects = allUnlocked.filter { it.personaArchetype == archetype }
            val tie = state.tieLevels[archetype] ?: 0
            val tokens = state.archetypeTokens[archetype] ?: 0
            PersonaEntry(
                archetype = archetype,
                encountered = projects.isNotEmpty() || tie > 0 || tokens > 0,
                timesIdentified = 0,
                projectsClosed = unlockedClosed.count { it.personaArchetype == archetype },
                tieLevel = tie,
                tokens = tokens
            )
        }

        val encounteredTypes = allUnlocked.map { it.type }.distinct()
        val lockedCount = personas.count { !it.encountered }

        RegistryUiState(
            personas = personas.filter { it.encountered },
            encounteredTypes = encounteredTypes,
            lockedCount = lockedCount
        )
    }
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), RegistryUiState())
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun PersonaRegistryScreen(
    onBack: () -> Unit,
    viewModel: PersonaRegistryViewModel = hiltViewModel()
) {
    val uiState by viewModel.uiState.collectAsState()
    var selectedTab by remember { mutableStateOf(0) }
    val tabs = listOf(
        Strings.t("registry.tab.personas"),
        Strings.t("registry.tab.types"),
        Strings.t("registry.tab.glossary")
    )

    ScreenBackground(R.drawable.registry_bg) {
    Scaffold(
        containerColor = Color.Transparent,
        topBar = {
            TopAppBar(
                title = {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(6.dp)
                    ) {
                        Text("✦", color = FairyGold, fontSize = 12.sp)
                        Text(Strings.t("registry.title"), fontWeight = FontWeight.Bold)
                        Text("✦", color = FairyGold, fontSize = 12.sp)
                    }
                },
                navigationIcon = {
                    IconButton(onClick = onBack) { Icon(Icons.Default.ArrowBack, Strings.t("btn.back")) }
                },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = Color.Transparent)
            )
        }
    ) { padding ->
        Column(modifier = Modifier.fillMaxSize().padding(padding)) {
            TabRow(
                selectedTabIndex = selectedTab,
                containerColor = Color.Transparent,
                contentColor = FairyGold,
                indicator = { tabPositions ->
                    val tab = tabPositions[selectedTab]
                    Box(modifier = Modifier.fillMaxSize()) {
                        Box(
                            modifier = Modifier
                                .align(Alignment.BottomStart)
                                .offset(x = tab.left)
                                .width(tab.width)
                                .height(2.dp)
                                .background(FairyGold)
                        )
                    }
                }
            ) {
                tabs.forEachIndexed { i, title ->
                    Tab(
                        selected = selectedTab == i,
                        onClick = { selectedTab = i },
                        text = {
                            Text(
                                title,
                                color = if (selectedTab == i) FairyGold else Color.White.copy(alpha = 0.6f),
                                fontWeight = if (selectedTab == i) FontWeight.SemiBold else FontWeight.Normal
                            )
                        }
                    )
                }
            }
            when (selectedTab) {
                0 -> PersonasTab(uiState)
                1 -> ProjectTypesTab(uiState.encounteredTypes)
                2 -> GlossaryTab()
            }
        }
    }
    } // ScreenBackground
}

@Composable
private fun PersonasTab(uiState: RegistryUiState) {
    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        if (uiState.personas.isEmpty()) {
            item {
                FairyCard(modifier = Modifier.fillMaxWidth()) {
                    Column(
                        modifier = Modifier.fillMaxWidth().padding(vertical = 24.dp),
                        horizontalAlignment = Alignment.CenterHorizontally,
                        verticalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        Text("✦", color = FairyGold.copy(alpha = 0.4f), fontSize = 24.sp)
                        Text(
                            Strings.t("registry.personas.empty.title"),
                            style = MaterialTheme.typography.titleMedium,
                            color = LocalContentColor.current,
                            fontWeight = FontWeight.SemiBold
                        )
                        Text(
                            Strings.t("registry.personas.empty.hint"),
                            style = MaterialTheme.typography.bodyMedium,
                            color = LocalContentColor.current.copy(alpha = 0.65f)
                        )
                    }
                }
            }
        } else {
            item {
                Text(
                    Strings.t("registry.personas.openedCount", uiState.personas.size, uiState.personas.size + uiState.lockedCount),
                    style = MaterialTheme.typography.bodyMedium,
                    color = FairyGold.copy(alpha = 0.7f)
                )
            }
            items(uiState.personas) { entry ->
                PersonaCard(entry = entry)
            }
        }
        if (uiState.lockedCount > 0) {
            item {
                FairyCard(modifier = Modifier.fillMaxWidth()) {
                    Text(
                        Strings.t("registry.personas.lockedHint", uiState.lockedCount),
                        style = MaterialTheme.typography.bodyMedium,
                        color = LocalContentColor.current.copy(alpha = 0.65f)
                    )
                }
            }
        }
    }
}

@Composable
private fun PersonaCard(entry: PersonaEntry) {
    FairyCard(modifier = Modifier.fillMaxWidth()) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            PersonaAvatar(entry.archetype, size = 48.dp)
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    Strings.t("persona.${entry.archetype.name}"),
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Bold,
                    color = LocalContentColor.current
                )
                Text(
                    Strings.t("persona.${entry.archetype.name}.desc"),
                    style = MaterialTheme.typography.bodyMedium,
                    color = LocalContentColor.current.copy(alpha = 0.65f)
                )
                Row(
                    modifier = Modifier.padding(top = 4.dp),
                    horizontalArrangement = Arrangement.spacedBy(10.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    if (entry.tieLevel > 0) {
                        Text(
                            "🤝 ${entry.tieLevel}/10",
                            style = MaterialTheme.typography.labelSmall,
                            color = FairyGold,
                            fontWeight = FontWeight.SemiBold
                        )
                    }
                    if (entry.tokens > 0) {
                        Text(
                            "🪙 ${entry.tokens}",
                            style = MaterialTheme.typography.labelSmall,
                            color = FairyGold
                        )
                    }
                    if (entry.projectsClosed > 0) {
                        Text(
                            "📜 ${entry.projectsClosed}",
                            style = MaterialTheme.typography.labelSmall,
                            color = LocalContentColor.current.copy(alpha = 0.6f)
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun ProjectTypesTab(types: List<ProjectType>) {
    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        if (types.isEmpty()) {
            item {
                FairyCard(modifier = Modifier.fillMaxWidth()) {
                    Text(
                        Strings.t("registry.types.empty"),
                        style = MaterialTheme.typography.bodyMedium,
                        color = LocalContentColor.current.copy(alpha = 0.65f)
                    )
                }
            }
        } else {
            items(types) { type ->
                ProjectTypeCard(type)
            }
        }
    }
}

@Composable
private fun ProjectTypeCard(type: ProjectType) {
    val (titleKey, descKey, riskKey) = when (type) {
        ProjectType.CARD_GAME -> Triple("type.cardGame", "type.CARD_GAME.desc", "risk.veryHigh")
        ProjectType.TREASURE_HUNT -> Triple("type.treasureHunt", "type.TREASURE_HUNT.desc", "risk.high")
        ProjectType.POTION_BREW -> Triple("type.potionBrew", "type.POTION_BREW.desc", "risk.veryHigh")
        ProjectType.GUILD_SCHEME -> Triple("type.guildScheme", "type.GUILD_SCHEME.desc", "risk.high")
        ProjectType.HONEST_TRADE -> Triple("type.honestTrade", "type.HONEST_TRADE.desc", "risk.moderate")
    }
    FairyCard(modifier = Modifier.fillMaxWidth()) {
        Text(Strings.t(titleKey), style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold, color = LocalContentColor.current)
        Text(Strings.t(descKey), style = MaterialTheme.typography.bodyMedium, color = LocalContentColor.current.copy(alpha = 0.7f))
        Text(
            Strings.t("registry.types.risk", Strings.t(riskKey)),
            style = MaterialTheme.typography.labelSmall,
            color = FairyGold.copy(alpha = 0.7f)
        )
    }
}

private val glossaryItems = listOf(
    "glossary.apy.title" to "glossary.apy.body",
    "glossary.roi.title" to "glossary.roi.body",
    "glossary.users.title" to "glossary.users.body",
    "glossary.detect.title" to "glossary.detect.body",
    "glossary.lock.title" to "glossary.lock.body",
    "glossary.fates.title" to "glossary.fates.body"
)

@Composable
private fun GlossaryTab() {
    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        items(glossaryItems) { (titleKey, bodyKey) ->
            GlossaryCard(title = Strings.t(titleKey), body = Strings.t(bodyKey))
        }
    }
}

@Composable
private fun GlossaryCard(title: String, body: String) {
    FairyCard(modifier = Modifier.fillMaxWidth()) {
        Text(title, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold, color = FairyGold)
        Spacer(Modifier.height(4.dp))
        Text(body, style = MaterialTheme.typography.bodyMedium, color = LocalContentColor.current.copy(alpha = 0.8f))
    }
}

val PersonaArchetype.emoji: String get() = when (this) {
    PersonaArchetype.BURATINO -> "🤥"
    PersonaArchetype.BOYARIN -> "👑"
    PersonaArchetype.KOLOBOK -> "😊"
    PersonaArchetype.KOSCHEI -> "💀"
    PersonaArchetype.ZOLUSHKA -> "✨"
    PersonaArchetype.BABA_YAGA -> "🧙"
    PersonaArchetype.IVAN_DURAK -> "🎲"
}

val PersonaArchetype.displayName: String get() = when (this) {
    PersonaArchetype.BURATINO -> "Буратино"
    PersonaArchetype.BOYARIN -> "Боярин"
    PersonaArchetype.KOLOBOK -> "Колобок"
    PersonaArchetype.KOSCHEI -> "Кощей"
    PersonaArchetype.ZOLUSHKA -> "Золушка"
    PersonaArchetype.BABA_YAGA -> "Баба-Яга"
    PersonaArchetype.IVAN_DURAK -> "Иван-дурак"
}

val PersonaArchetype.description: String get() = when (this) {
    PersonaArchetype.BURATINO -> "Очевидный лжец, верит в свои же сказки"
    PersonaArchetype.BOYARIN -> "Пафосный, ссылается на великих покровителей"
    PersonaArchetype.KOLOBOK -> "Хвастун-энтузиаст, от всех убегает с улыбкой"
    PersonaArchetype.KOSCHEI -> "Холодный и уверенный, говорит только цифрами"
    PersonaArchetype.ZOLUSHKA -> "Апеллирует к жалости и эмоциям, давит дедлайнами"
    PersonaArchetype.BABA_YAGA -> "Отвечает загадками, технически подкована"
    PersonaArchetype.IVAN_DURAK -> "Открыт про провалы — третий раз может взлететь"
}

val ProjectType.description: String get() = when (this) {
    ProjectType.CARD_GAME -> "Азартные игры на удачу с ставками"
    ProjectType.TREASURE_HUNT -> "Поиск клада с командой или в одиночку"
    ProjectType.POTION_BREW -> "Пассивный доход с варки зелий и ресурсов"
    ProjectType.GUILD_SCHEME -> "Реферальная артель: зарабатывай на новичках"
    ProjectType.HONEST_TRADE -> "Прозрачная торговля с открытыми условиями"
}

val ProjectType.riskLevel: String get() = when (this) {
    ProjectType.CARD_GAME -> "Очень высокий"
    ProjectType.TREASURE_HUNT -> "Высокий"
    ProjectType.POTION_BREW -> "Очень высокий"
    ProjectType.GUILD_SCHEME -> "Высокий"
    ProjectType.HONEST_TRADE -> "Умеренный"
}
