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
import com.s0dolamby.game.presentation.common.components.ScreenBackground
import com.s0dolamby.game.presentation.common.theme.FairyGold
import androidx.compose.foundation.background
import com.s0dolamby.game.presentation.portfolio.displayName
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
        // Архетип открывается, когда дело закрылось с вложенными рублями
        // (либо живёт сейчас как активное).
        val unlockedClosed = closed.filter { it.investedAmountRubles > 0 }
        val allUnlocked = (unlockedClosed + active).distinctBy { it.id }

        val personas = PersonaArchetype.values().map { archetype ->
            val projects = allUnlocked.filter { it.personaArchetype == archetype }
            PersonaEntry(
                archetype = archetype,
                encountered = projects.isNotEmpty(),
                timesIdentified = 0,
                projectsClosed = unlockedClosed.count { it.personaArchetype == archetype }
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
    val tabs = listOf("Типажи", "Виды дел", "Словарь")

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
                        Text("Летопись", fontWeight = FontWeight.Bold)
                        Text("✦", color = FairyGold, fontSize = 12.sp)
                    }
                },
                navigationIcon = {
                    IconButton(onClick = onBack) { Icon(Icons.Default.ArrowBack, "Назад") }
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
                            "Летопись пуста",
                            style = MaterialTheme.typography.titleMedium,
                            color = Color.White,
                            fontWeight = FontWeight.SemiBold
                        )
                        Text(
                            "Поговори с Дельцами — типажи откроются после закрытия дел",
                            style = MaterialTheme.typography.bodyMedium,
                            color = Color.White.copy(alpha = 0.65f)
                        )
                    }
                }
            }
        } else {
            item {
                Text(
                    "Открыто ${uiState.personas.size} из ${uiState.personas.size + uiState.lockedCount} типажей",
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
                        "Ещё ${uiState.lockedCount} типажей скрыто — инвестируй в новые дела",
                        style = MaterialTheme.typography.bodyMedium,
                        color = Color.White.copy(alpha = 0.65f)
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
            Surface(
                modifier = Modifier.size(44.dp),
                shape = MaterialTheme.shapes.medium,
                color = FairyGold.copy(alpha = 0.15f)
            ) {
                Box(contentAlignment = Alignment.Center) {
                    Text(entry.archetype.emoji, style = MaterialTheme.typography.titleLarge)
                }
            }
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    entry.archetype.displayName,
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Bold,
                    color = Color.White
                )
                Text(
                    entry.archetype.description,
                    style = MaterialTheme.typography.bodyMedium,
                    color = Color.White.copy(alpha = 0.65f)
                )
                if (entry.projectsClosed > 0) {
                    Text(
                        "Встречено дел: ${entry.projectsClosed}",
                        style = MaterialTheme.typography.labelSmall,
                        color = FairyGold.copy(alpha = 0.7f)
                    )
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
                        "Здесь появятся виды дел после твоего участия в них.",
                        style = MaterialTheme.typography.bodyMedium,
                        color = Color.White.copy(alpha = 0.65f)
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
    FairyCard(modifier = Modifier.fillMaxWidth()) {
        Text(type.displayName, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold, color = Color.White)
        Text(type.description, style = MaterialTheme.typography.bodyMedium, color = Color.White.copy(alpha = 0.7f))
        Text(
            "Типичный риск: ${type.riskLevel}",
            style = MaterialTheme.typography.labelSmall,
            color = FairyGold.copy(alpha = 0.7f)
        )
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
    FairyCard(modifier = Modifier.fillMaxWidth()) {
        Text(title, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold, color = FairyGold)
        Spacer(Modifier.height(4.dp))
        Text(body, style = MaterialTheme.typography.bodyMedium, color = Color.White.copy(alpha = 0.8f))
    }
}

private val glossaryItems = listOf(
    "APY (чужеземное) — годовой прибыток" to
        "Annual Percentage Yield — по-нашему: обещанный годовой прибыток с учётом накопленных процентов.\n" +
        "Пример: APY 365% = примерно 1% в день. В честных делах APY выше 100% почти не бывает.\n" +
        "В симуляторе APY — это посул хозяина дела. Настоящий прибыток может быть в разы ниже или вовсе нулевым.",

    "ROI (чужеземное) — окупаемость вложения" to
        "Return on Investment — по-нашему: отдача от вложенного злата.\n" +
        "Считается так: (что получил − что вложил) / что вложил × 100%.\n" +
        "Положительный ROI = прибыток, отрицательный = убыток.",

    "Количество участников" to
        "Ведомость числа участников дела — важный знак его здоровья.\n" +
        "Резкое снижение (−10 000 за день) = тревожный знак: люди уходят.\n" +
        "Стабильный рост = дело живёт. Взрывной рост перед «закрытием» = возможный обман.\n" +
        "Помни: в скам-делах заявленные цифры часто выдуманы.",

    "Как распознать обманщика" to
        "Тревожные знаки, на которые стоит обращать внимание:\n\n" +
        "• Нереальный посул (APY >500% годовых) — такая прибыль не случается\n" +
        "• Давление на срочность: «только сегодня», «осталось мало мест»\n" +
        "• Расплывчатые ответы на прямые вопросы о выводе злата\n" +
        "• Задержки выплат в вестях — первый признак медленного слива\n" +
        "• Злость или обиды в ответ на скептические вопросы\n" +
        "• Артель безымянна, нет проверки старейшин\n" +
        "• Обещание большой выплаты «через неделю» без конкретики",

    "Блокировка вывода" to
        "Когда хозяин дела начинает скамить, вывод средств может быть заблокирован.\n" +
        "Это означает: он перестал выплачивать и ищет выход.\n\n" +
        "Есть небольшой шанс (~20%), что дело «восстановится» и вывод откроется снова — " +
        "это происходит, когда скамеру нужно привлечь новые деньги.\n\n" +
        "Если вывод не открылся — жди закрытия и частичного возврата средств.",

    "Судьбы дел" to
        "• Мгновенный скам — закрывается на 1–3 день, потеря 80–100%\n" +
        "• Медленный слив — живёт 1–3 недели, потеря 30–70%\n" +
        "• Честный провал — хозяин старался, экономика не взлетела, потеря 10–40%\n" +
        "• Выживший — долгосрочный, стабильный небольшой доход\n" +
        "• Единорог — редкость, реальный рост и доходность до 10% в день"
)

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
