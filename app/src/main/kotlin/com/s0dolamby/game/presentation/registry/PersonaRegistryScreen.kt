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
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.s0dolamby.game.domain.model.PersonaArchetype
import com.s0dolamby.game.domain.model.ProjectType
import com.s0dolamby.game.domain.repository.ProjectRepository
import com.s0dolamby.game.presentation.portfolio.displayName
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.*
import javax.inject.Inject

data class PersonaEntry(
    val archetype: PersonaArchetype,
    val encountered: Boolean,
    val timesIdentified: Int,
    val projectsClosed: Int
)

data class RegistryUiState(
    val personas: List<PersonaEntry> = emptyList(),
    val encounteredTypes: List<ProjectType> = emptyList(),
    val lockedCount: Int = 0
)

@HiltViewModel
class PersonaRegistryViewModel @Inject constructor(
    private val projectRepository: ProjectRepository
) : ViewModel() {

    val uiState: StateFlow<RegistryUiState> = combine(
        projectRepository.getClosedProjects(),
        projectRepository.getActiveProjects()
    ) { closed, active ->
        // Unlock via: invested + closed  OR  correct lie guess (any state)
        val unlockedByClose = closed.filter { it.investedAmountRubles > 0 }
        val unlockedByGuess = (closed + active).filter { it.lieGuessCorrect }
        val allUnlocked = (unlockedByClose + unlockedByGuess).distinctBy { it.id }

        val personas = PersonaArchetype.values().map { archetype ->
            val projects = allUnlocked.filter { it.personaArchetype == archetype }
            PersonaEntry(
                archetype = archetype,
                encountered = projects.isNotEmpty(),
                timesIdentified = projects.count { it.lieGuessCorrect },
                projectsClosed = unlockedByClose.count { it.personaArchetype == archetype }
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
    val tabs = listOf("Разработчики", "Типы проектов", "Словарь")

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Энциклопедия") },
                navigationIcon = {
                    IconButton(onClick = onBack) { Icon(Icons.Default.ArrowBack, "Назад") }
                }
            )
        }
    ) { padding ->
        Column(modifier = Modifier.fillMaxSize().padding(padding)) {
            TabRow(selectedTabIndex = selectedTab) {
                tabs.forEachIndexed { i, title ->
                    Tab(selected = selectedTab == i, onClick = { selectedTab = i }, text = { Text(title) })
                }
            }
            when (selectedTab) {
                0 -> PersonasTab(uiState)
                1 -> ProjectTypesTab(uiState.encounteredTypes)
                2 -> GlossaryTab()
            }
        }
    }
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
                Text(
                    "Здесь появятся архетипы разработчиков — угадай ложь разраба после AMA или дождись закрытия проекта.",
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.padding(vertical = 8.dp)
                )
            }
        } else {
            item {
                Text(
                    "Открыто ${uiState.personas.size} из ${uiState.personas.size + uiState.lockedCount} архетипов",
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
            items(uiState.personas) { entry ->
                PersonaCard(entry = entry)
            }
        }
        if (uiState.lockedCount > 0) {
            item {
                Surface(
                    color = MaterialTheme.colorScheme.surfaceVariant,
                    shape = MaterialTheme.shapes.medium,
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Text(
                        "Ещё ${uiState.lockedCount} архетипов скрыто — инвестируй в новые проекты",
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        modifier = Modifier.padding(16.dp)
                    )
                }
            }
        }
    }
}

@Composable
private fun PersonaCard(entry: PersonaEntry) {
    Card(modifier = Modifier.fillMaxWidth()) {
        Row(
            modifier = Modifier.padding(16.dp).fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            Surface(
                modifier = Modifier.size(44.dp),
                shape = MaterialTheme.shapes.medium,
                color = MaterialTheme.colorScheme.primary
            ) {
                Box(contentAlignment = Alignment.Center) {
                    Text(entry.archetype.emoji, style = MaterialTheme.typography.titleLarge)
                }
            }
            Column(modifier = Modifier.weight(1f)) {
                Text(entry.archetype.displayName, style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Bold)
                Text(entry.archetype.description, style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant)
                if (entry.projectsClosed > 0) {
                    Text("Встречено проектов: ${entry.projectsClosed}",
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant)
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
                Text("Здесь появятся типы проектов после твоего участия в них.",
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant)
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
    Card(modifier = Modifier.fillMaxWidth()) {
        Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
            Text(type.displayName, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
            Text(type.description, style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant)
            Text("Типичный риск: ${type.riskLevel}", style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
    }
}

@Composable
private fun GlossaryTab() {
    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        items(glossaryItems) { item ->
            GlossaryCard(title = item.first, body = item.second)
        }
    }
}

@Composable
private fun GlossaryCard(title: String, body: String) {
    Card(modifier = Modifier.fillMaxWidth()) {
        Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Text(title, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
            Text(body, style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
    }
}

private val glossaryItems = listOf(
    "APY (годовая доходность)" to
        "Annual Percentage Yield — процент прибыли в год с учётом сложных процентов.\n" +
        "Пример: APY 365% = примерно 1% в день. В реальных проектах APY >100% обычно означает высокий риск скама.\n" +
        "В симуляторе APY показывает заявленную доходность — настоящая может быть в разы ниже или нулевой.",

    "ROI (возврат инвестиций)" to
        "Return on Investment — отношение прибыли к вложенным средствам в процентах.\n" +
        "Формула: ROI = (текущая стоимость − вложено) / вложено × 100%.\n" +
        "Положительный ROI = прибыль, отрицательный = убыток.",

    "Количество пользователей" to
        "График числа участников проекта — важный индикатор здоровья.\n" +
        "Резкое снижение (−10 000 за день) = тревожный сигнал: люди выходят.\n" +
        "Стабильный рост = проект живёт. Взрывной рост перед «закрытием» = возможный pump-and-dump.\n" +
        "Помни: в скам-проектах заявленные цифры часто выдуманы.",

    "Как распознать скам" to
        "Красные флаги на которые стоит обращать внимание:\n\n" +
        "• Нереальный APY (>500% годовых) — экономика не выдержит\n" +
        "• Давление на срочность: «только сегодня», «осталось мало мест»\n" +
        "• Расплывчатые ответы на прямые вопросы о выводе средств\n" +
        "• Задержки выплат в апдейтах — первый признак SLOW_DRAIN\n" +
        "• Агрессия или обиды в ответ на скептические вопросы\n" +
        "• Команда анонимна, нет верифицированного аудита\n" +
        "• Обещание листинга «через неделю» без конкретики\n\n" +
        "Блокировка вывода — самый серьёзный сигнал. Это значит проект начал скамить.",

    "Временная блокировка вывода" to
        "Когда проект начинает скамить, вывод средств может быть заблокирован.\n" +
        "Это означает: разработчик перестал выплачивать и ищет выход.\n\n" +
        "Есть небольшой шанс (около 20%), что проект «восстановится» и вывод откроется снова — " +
        "это происходит, когда скамеру нужно привлечь новые деньги.\n\n" +
        "Если вывод не открылся — жди закрытия и частичного возврата средств.",

    "Судьбы проектов" to
        "• Мгновенный скам (INSTANT_SCAM) — закрывается на 1–3 день, потеря 80–100%\n" +
        "• Медленный слив (SLOW_DRAIN) — живёт 1–3 недели, потеря 30–70%\n" +
        "• Честный провал (HONEST_FAIL) — разраб старался, экономика не взлетела, потеря 10–40%\n" +
        "• Выживший (SURVIVOR) — долгосрочный, стабильный небольшой доход\n" +
        "• Единорог (UNICORN) — редкость, реальный рост токена и доходность до 10% в день"
)

val PersonaArchetype.displayName: String get() = when (this) {
    PersonaArchetype.BURATINO -> "Буратино"
    PersonaArchetype.BOYARIN -> "Боярин"
    PersonaArchetype.KOLOBOK -> "Колобок"
    PersonaArchetype.KOSCHEI -> "Кощей"
    PersonaArchetype.ZOLUSHKA -> "Золушка"
    PersonaArchetype.BABA_YAGA -> "Баба Яга"
    PersonaArchetype.IVAN_DURAK -> "Иван-дурак"
}

val PersonaArchetype.emoji: String get() = when (this) {
    PersonaArchetype.BURATINO -> "🪆"
    PersonaArchetype.BOYARIN -> "🎩"
    PersonaArchetype.KOLOBOK -> "🟠"
    PersonaArchetype.KOSCHEI -> "💀"
    PersonaArchetype.ZOLUSHKA -> "👠"
    PersonaArchetype.BABA_YAGA -> "🏚️"
    PersonaArchetype.IVAN_DURAK -> "🎲"
}

val PersonaArchetype.description: String get() = when (this) {
    PersonaArchetype.BURATINO -> "Наивный лжец, верит собственным сказкам. Обещает Поле Чудес, обижается под давлением."
    PersonaArchetype.BOYARIN -> "Пышно-официальный. Ссылается на связи при дворе и государевых партнёров без имён."
    PersonaArchetype.KOLOBOK -> "Хвастун-оптимист. От всех проблем уходит с песней — пока не встретит Лису."
    PersonaArchetype.KOSCHEI -> "Ледяной и цифровой. Говорит метриками-приговорами. Опасен — может быть и честным."
    PersonaArchetype.ZOLUSHKA -> "Апеллирует к жалости и мечтам. Дедлайны «до полуночи». Искусственная срочность."
    PersonaArchetype.BABA_YAGA -> "Отвечает загадками. Технически подкована — единственный архетип без ложных тем."
    PersonaArchetype.IVAN_DURAK -> "Открыт про два провала. Третий проект — может реально взлететь."
}

val ProjectType.description: String get() = when (this) {
    ProjectType.CARD_GAME -> "Карточные игры и азартные дела. Обещают быстрый доход — почти всегда скам или пирамида."
    ProjectType.TREASURE_HUNT -> "Поиск кладов и сокровищ. Романтичная обёртка скрывает риски: половина дел так и не находит клад."
    ProjectType.POTION_BREW -> "Алхимия и зелья — пассивный доход без усилий. Обещания сверхприбыли почти всегда ложь."
    ProjectType.GUILD_SCHEME -> "Артели и гильдии через рефералов. Работает пока растёт, рушится при замедлении притока участников."
    ProjectType.HONEST_TRADE -> "Честная торговля с открытыми счётными книгами. Низкая прибыль, но выше шанс долгосрочной работы."
}

val ProjectType.riskLevel: String get() = when (this) {
    ProjectType.CARD_GAME -> "Очень высокий"
    ProjectType.TREASURE_HUNT -> "Высокий"
    ProjectType.POTION_BREW -> "Критически высокий"
    ProjectType.GUILD_SCHEME -> "Высокий"
    ProjectType.HONEST_TRADE -> "Средний"
}
