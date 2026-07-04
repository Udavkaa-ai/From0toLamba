package com.s0dolamby.game.presentation.navigation

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.runtime.*
import androidx.compose.ui.draw.clip
import androidx.compose.ui.unit.dp
import com.s0dolamby.game.presentation.common.i18n.Strings
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import androidx.navigation.NavType
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import androidx.navigation.navArgument
import com.s0dolamby.game.domain.repository.GameStateRepository
import com.s0dolamby.game.presentation.achievements.AchievementUnlockedOverlay
import com.s0dolamby.game.presentation.ama.AmaScreen
import com.s0dolamby.game.presentation.common.components.DayBreakOverlay
import com.s0dolamby.game.presentation.common.components.DayTransitionOverlay
import com.s0dolamby.game.presentation.home.HomeScreen
import com.s0dolamby.game.presentation.inbox.InboxScreen
import com.s0dolamby.game.presentation.leaderboard.LeaderboardScreen
import com.s0dolamby.game.domain.model.PersonaArchetype
import com.s0dolamby.game.presentation.minigame.babayaga.BabaYagaCauldronScreen
import com.s0dolamby.game.presentation.minigame.boyarin.BoyarinCharterScreen
import com.s0dolamby.game.presentation.minigame.gate.MinigameGateScreen
import com.s0dolamby.game.presentation.minigame.goldenkey.GoldenKeyScreen
import com.s0dolamby.game.presentation.minigame.ivandurak.IvanDurakMapScreen
import com.s0dolamby.game.presentation.minigame.kolobok.KolobokNoraScreen
import com.s0dolamby.game.presentation.minigame.koschei.KoscheiMemoryScreen
import com.s0dolamby.game.presentation.minigame.zolushka.ZolushkaCoinsScreen
import com.s0dolamby.game.presentation.news.NewsScreen
import com.s0dolamby.game.presentation.onboarding.OnboardingScreen
import com.s0dolamby.game.presentation.portfolio.PortfolioScreen
import com.s0dolamby.game.presentation.portfolio.ProjectDetailScreen
import com.s0dolamby.game.presentation.registry.PersonaRegistryScreen
import com.s0dolamby.game.presentation.relationships.RelationshipsScreen
import com.s0dolamby.game.presentation.settings.SettingsScreen
import com.s0dolamby.game.presentation.stats.StatsScreen
import com.s0dolamby.game.presentation.today.TodayScreen
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.launch
import javax.inject.Inject

sealed class Screen(val route: String) {
    object Onboarding : Screen("onboarding")
    object Home : Screen("home")
    object Inbox : Screen("inbox")
    object Ama : Screen("ama/{projectId}") {
        fun createRoute(projectId: String) = "ama/$projectId"
    }
    /** Универсальный «вход в дело»: сначала мини-игра дельца, потом инвест. */
    object MinigameGate : Screen("minigame-gate/{archetype}/{projectId}") {
        fun createRoute(archetype: String, projectId: String) =
            "minigame-gate/$archetype/$projectId"
    }
    object Portfolio : Screen("portfolio")
    object ProjectDetail : Screen("project/{projectId}") {
        fun createRoute(projectId: String) = "project/$projectId"
    }
    object News : Screen("news")
    object Stats : Screen("stats")
    object PersonaRegistry : Screen("registry")
    object Science : Screen("science")
    object Settings : Screen("settings")
    object GoldenKey : Screen("minigame/golden-key")
    object KoscheiMemory : Screen("minigame/koschei-memory")
    object KolobokNora : Screen("minigame/kolobok-nora")
    object ZolushkaCoins : Screen("minigame/zolushka-coins")
    object BabaYagaCauldron : Screen("minigame/baba-yaga-cauldron")
    object BoyarinCharter : Screen("minigame/boyarin-charter")
    object IvanDurakMap : Screen("minigame/ivan-durak-map")
    object Leaderboard : Screen("leaderboard")
    object Today : Screen("today")
    object Relationships : Screen("relationships")
}

@HiltViewModel
class NavViewModel @Inject constructor(
    private val gameStateRepository: GameStateRepository
) : ViewModel() {

    private val _isOnboardingComplete = MutableStateFlow<Boolean?>(null)
    val isOnboardingComplete: StateFlow<Boolean?> = _isOnboardingComplete.asStateFlow()

    /** Размер инбокса — рисуется красным бейджем у вкладки «Грамоты». */
    val inboxBadge: StateFlow<Int> = gameStateRepository.observeGameState()
        .map { it.pendingInbox.size }
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), 0)

    /** Текущий день — нужен глобальной [DayBreakOverlay] чтобы анимировать переход. */
    val currentDay: StateFlow<Int> = gameStateRepository.observeGameState()
        .map { it.currentDay }
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), -1)

    init {
        viewModelScope.launch {
            gameStateRepository.initializeGameState()
            val state = gameStateRepository.getGameState()
            _isOnboardingComplete.value = state.isOnboardingComplete
        }
    }
}

@Composable
fun NavGraph() {
    val navController = rememberNavController()
    val navViewModel: NavViewModel = hiltViewModel()
    val isOnboardingComplete by navViewModel.isOnboardingComplete.collectAsState()

    // Wait until we know onboarding status
    val startDestination = when (isOnboardingComplete) {
        null -> return  // Still loading — show nothing
        false -> Screen.Onboarding.route
        true -> Screen.Home.route
    }

    // Куда сейчас залетели — нужно чтобы прятать глобальную «Следующий день»
    // на экранах, где она мешает (AMA-чат, мини-игры, gate, онбординг).
    val currentEntry by navController.currentBackStackEntryAsState()
    val currentRoute = currentEntry?.destination?.route
    val hideFabRoutes = setOf(
        Screen.Onboarding.route,
        // На главной у HomeScreen своя кнопка (нужна для DayNewsOverlay)
        Screen.Home.route,
        Screen.Ama.route,
        Screen.MinigameGate.route,
        Screen.GoldenKey.route,
        Screen.KoscheiMemory.route,
        Screen.KolobokNora.route,
        Screen.ZolushkaCoins.route,
        Screen.BabaYagaCauldron.route,
        Screen.BoyarinCharter.route,
        Screen.IvanDurakMap.route
    )
    val showGlobalFab = currentRoute != null && currentRoute !in hideFabRoutes

    // Какая вкладка сейчас активна (для подсветки BottomNav) — null значит
    // что мы на «не-табовом» экране (стек поверх) и BottomNav не показываем.
    val currentTab: AppTab? = when (currentRoute) {
        Screen.Home.route -> AppTab.HOME
        Screen.Inbox.route -> AppTab.INBOX
        Screen.Portfolio.route -> AppTab.PORTFOLIO
        Screen.Stats.route -> AppTab.STATS
        Screen.Today.route -> AppTab.TODAY
        else -> null
    }

    // Переход между табами: всегда возвращаемся в стек к Home, чтобы не копить
    // глубокий backstack из-за тапов по нижней навигации.
    val navToTab: (String) -> Unit = { route ->
        if (currentRoute != route) {
            navController.navigate(route) {
                popUpTo(Screen.Home.route) { inclusive = (route == Screen.Home.route) }
                launchSingleTop = true
                restoreState = true
            }
        }
    }
    val inboxBadge by navViewModel.inboxBadge.collectAsState()
    val currentDay by navViewModel.currentDay.collectAsState()

    Box(modifier = Modifier.fillMaxSize()) {
    NavHost(navController = navController, startDestination = startDestination) {
        composable(Screen.Onboarding.route) {
            OnboardingScreen(onDone = {
                navController.navigate(Screen.Home.route) {
                    popUpTo(Screen.Onboarding.route) { inclusive = true }
                }
            })
        }
        composable(Screen.Home.route) {
            HomeScreen(
                onInboxClick = { navController.navigate(Screen.Inbox.route) },
                onPortfolioClick = { navController.navigate(Screen.Portfolio.route) },
                onTodayClick = { navController.navigate(Screen.Today.route) },
                onStatsClick = { navController.navigate(Screen.Stats.route) },
                onRelationshipsClick = { navController.navigate(Screen.Relationships.route) },
                onRegistryClick = { navController.navigate(Screen.PersonaRegistry.route) },
                onProjectClick = { projectId -> navController.navigate(Screen.ProjectDetail.createRoute(projectId)) },
                onSettingsClick = { navController.navigate(Screen.Settings.route) }
            )
        }
        composable(Screen.Inbox.route) {
            InboxScreen(
                onBack = { navController.popBackStack() },
                onPlayMinigame = { archetypeName, projectId ->
                    // Основной вход: сразу в мини-игру дельца. После выигрыша
                    // gate сам отправит в Ama (там кнопка инвеста уже разблокирована).
                    navController.navigate(Screen.MinigameGate.createRoute(archetypeName, projectId))
                },
                onChatAfterAd = { projectId ->
                    // Альтернативный вход: «реклама» (пока заглушка) → Ama без unlock.
                    // Игрок может поговорить, но кнопка инвеста по-прежнему «🎲 Испытать».
                    navController.navigate(Screen.Ama.createRoute(projectId))
                },
                onContinueToAma = { projectId ->
                    // Мини-игра уже пройдена — пускаем сразу в беседу.
                    navController.navigate(Screen.Ama.createRoute(projectId))
                }
            )
        }
        composable(
            route = Screen.Ama.route,
            arguments = listOf(navArgument("projectId") { type = NavType.StringType })
        ) {
            AmaScreen(
                onBack = { navController.popBackStack() },
                onOpenRegistry = {
                    navController.popBackStack()
                    navController.navigate(Screen.PersonaRegistry.route)
                },
                onPlayMinigame = { archetypeName, projectId ->
                    navController.navigate(Screen.MinigameGate.createRoute(archetypeName, projectId))
                }
            )
        }
        composable(Screen.Portfolio.route) {
            PortfolioScreen(
                onBack = { navController.popBackStack() },
                onProjectClick = { projectId -> navController.navigate(Screen.ProjectDetail.createRoute(projectId)) }
            )
        }
        composable(
            route = Screen.ProjectDetail.route,
            arguments = listOf(navArgument("projectId") { type = NavType.StringType })
        ) {
            ProjectDetailScreen(
                onBack = { navController.popBackStack() },
                onManageClick = { navController.navigate(Screen.Portfolio.route) }
            )
        }
        composable(Screen.News.route) {
            NewsScreen(onBack = { navController.popBackStack() })
        }
        composable(Screen.Stats.route) {
            StatsScreen(
                onBack = { navController.popBackStack() },
                onRegistryClick = { navController.navigate(Screen.PersonaRegistry.route) },
                onScienceClick = { navController.navigate(Screen.Science.route) }
            )
        }
        composable(Screen.PersonaRegistry.route) {
            PersonaRegistryScreen(onBack = { navController.popBackStack() })
        }
        composable(Screen.Science.route) {
            com.s0dolamby.game.presentation.science.ScienceScreen(
                onBack = { navController.popBackStack() }
            )
        }
        composable(Screen.Settings.route) {
            SettingsScreen(
                onBack = { navController.popBackStack() },
                onResetDone = {
                    navController.navigate(Screen.Onboarding.route) {
                        popUpTo(0) { inclusive = true }
                    }
                },
                onTryGoldenKey = { navController.navigate(Screen.GoldenKey.route) },
                onTryKoscheiMemory = { navController.navigate(Screen.KoscheiMemory.route) },
                onTryKolobokNora = { navController.navigate(Screen.KolobokNora.route) },
                onTryZolushkaCoins = { navController.navigate(Screen.ZolushkaCoins.route) },
                onTryBabaYagaCauldron = { navController.navigate(Screen.BabaYagaCauldron.route) },
                onTryBoyarinCharter = { navController.navigate(Screen.BoyarinCharter.route) },
                onTryIvanDurakMap = { navController.navigate(Screen.IvanDurakMap.route) }
            )
        }
        composable(Screen.GoldenKey.route) {
            GoldenKeyScreen(onBack = { navController.popBackStack() })
        }
        composable(Screen.KoscheiMemory.route) {
            KoscheiMemoryScreen(onBack = { navController.popBackStack() })
        }
        composable(Screen.KolobokNora.route) {
            KolobokNoraScreen(onBack = { navController.popBackStack() })
        }
        composable(Screen.ZolushkaCoins.route) {
            ZolushkaCoinsScreen(onBack = { navController.popBackStack() })
        }
        composable(Screen.BabaYagaCauldron.route) {
            BabaYagaCauldronScreen(onBack = { navController.popBackStack() })
        }
        composable(Screen.BoyarinCharter.route) {
            BoyarinCharterScreen(onBack = { navController.popBackStack() })
        }
        composable(Screen.IvanDurakMap.route) {
            IvanDurakMapScreen(onBack = { navController.popBackStack() })
        }
        composable(
            route = Screen.MinigameGate.route,
            arguments = listOf(
                navArgument("archetype") { type = NavType.StringType },
                navArgument("projectId") { type = NavType.StringType }
            )
        ) { entry ->
            val archetypeStr = entry.arguments?.getString("archetype").orEmpty()
            val projectId = entry.arguments?.getString("projectId").orEmpty()
            val archetype = runCatching { PersonaArchetype.valueOf(archetypeStr) }
                .getOrElse { PersonaArchetype.BURATINO }
            MinigameGateScreen(
                archetype = archetype,
                projectId = projectId,
                onBack = { navController.popBackStack() },
                onContinueToInvest = {
                    // «Вложить» после игры НЕ тащит игрока в чат (чат генерит
                    // AI-приветствие и тратит токены) — возвращаемся туда,
                    // откуда пришли: в грамотах карточка уже разблокирована
                    // и открывает шит вложения, в беседе — кнопка «Вложить».
                    navController.popBackStack()
                },
                onGoToChat = {
                    // Явное желание поговорить — вот теперь стартуем AMA.
                    // За вопросы делец добрасывает «уговор» +1%/вопрос.
                    navController.navigate(Screen.Ama.createRoute(projectId)) {
                        popUpTo(Screen.MinigameGate.route) { inclusive = true }
                    }
                }
            )
        }
        composable(Screen.Leaderboard.route) {
            LeaderboardScreen(onBack = { navController.popBackStack() })
        }
        composable(Screen.Today.route) {
            TodayScreen()
        }
        composable(Screen.Relationships.route) {
            RelationshipsScreen(onBack = { navController.popBackStack() })
        }
    } // NavHost end

        // Глобальная плавающая «🌅 Следующий день» — поверх всех «обычных» экранов
        val dayFabViewModel: GlobalDayFabViewModel = hiltViewModel()
        val dayAdvancing by dayFabViewModel.isLoading.collectAsState()
        GlobalDayFab(
            visible = showGlobalFab,
            modifier = Modifier.align(Alignment.BottomEnd),
            viewModel = dayFabViewModel
        )

        // BottomNav поверх контента на 5 табовых экранах (как в TG).
        if (currentTab != null) {
            Box(modifier = Modifier.align(Alignment.BottomCenter)) {
                AppBottomNav(
                    current = currentTab,
                    pendingInboxCount = inboxBadge,
                    onHomeClick = { navToTab(Screen.Home.route) },
                    onInboxClick = { navToTab(Screen.Inbox.route) },
                    onPortfolioClick = { navToTab(Screen.Portfolio.route) },
                    onStatsClick = { navToTab(Screen.Stats.route) },
                    onTodayClick = { navToTab(Screen.Today.route) }
                )
            }
        }

        // Жалованная грамота — всплывает поверх всего на любом экране,
        // когда use-case разблокировал подвиг.
        AchievementUnlockedOverlay()

        // «Наука старца» — свиток с приёмом мошенников после закрытия дела.
        com.s0dolamby.game.presentation.science.ScienceUnlockedOverlay()

        // Плашка «🌅 Утро дня N» при переходе дня — глобально.
        if (currentDay > 0) DayBreakOverlay(currentDay)

        // Свайп-колода «Вестей дня» — глобально, с какого бы экрана ни
        // нажали «Следующий день» (раньше показывалась только на главной).
        val pendingNews by dayFabViewModel.pendingNews.collectAsState()
        val reactedNews by dayFabViewModel.reactedNewsIds.collectAsState()
        val activeProjects by dayFabViewModel.activeProjects.collectAsState()
        val activeIds = remember(activeProjects) { activeProjects.map { it.id }.toSet() }
        // Весть, на которую реагируем «Сечением» (позитив) прямо сейчас
        var sechenieFor by remember { mutableStateOf<com.s0dolamby.game.domain.model.DailyUpdate?>(null) }
        // Тревожная весть, от которой отбиваемся «Зорким счётом»
        var zorkiyFor by remember { mutableStateOf<com.s0dolamby.game.domain.model.DailyUpdate?>(null) }
        // Выигранный бонус → шит довложения (весть, бонус%)
        var reactionInvest by remember { mutableStateOf<Pair<com.s0dolamby.game.domain.model.DailyUpdate, Int>?>(null) }

        if (pendingNews.isNotEmpty()) {
            com.s0dolamby.game.presentation.common.components.DayNewsDeck(
                updates = pendingNews,
                onDismiss = dayFabViewModel::dismissNews,
                onOpenProject = { update ->
                    dayFabViewModel.dismissNews(update)
                    navController.navigate(Screen.ProjectDetail.createRoute(update.projectId))
                },
                activeProjectIds = activeIds,
                reactedIds = reactedNews,
                onReact = { update ->
                    if (update.eventKind == com.s0dolamby.game.domain.model.DailyEventKind.NEGATIVE) {
                        zorkiyFor = update
                    } else {
                        sechenieFor = update
                    }
                }
            )
        }

        // Игра «Сечение» — реакция на важную весть (одна попытка на весть).
        // Задания серии строятся из ЭКОНОМИКИ дела: доля вложений, прирост,
        // вес события из вести.
        sechenieFor?.let { update ->
            val project = activeProjects.find { it.id == update.projectId }
            val tasks = com.s0dolamby.game.presentation.minigame.sechenie
                .buildSechenieTasks(project, update)
            com.s0dolamby.game.presentation.minigame.sechenie.SechenieOverlay(
                projectName = update.projectName,
                tasks = tasks,
                onInvestWithBonus = { bonus ->
                    dayFabViewModel.markReacted(update.id)
                    sechenieFor = null
                    reactionInvest = update to bonus
                },
                onClose = {
                    dayFabViewModel.markReacted(update.id)
                    sechenieFor = null
                }
            )
        }

        // «Зоркий счёт» — отбиться от тревожной вести. Если весть о
        // заморозке вывода — ставка иная: чистая победа открывает окно
        // «вывести в последний момент», неудача просто оставляет замок.
        zorkiyFor?.let { update ->
            val isLockNews = activeProjects
                .firstOrNull { it.id == update.projectId }?.isWithdrawalLocked == true
            com.s0dolamby.game.presentation.minigame.zorkiy.ZorkiySchyotOverlay(
                projectName = update.projectName,
                isLockNews = isLockNews,
                onOutcome = { outcome ->
                    dayFabViewModel.markReacted(update.id)
                    dayFabViewModel.applyBadNewsOutcome(update, outcome)
                    zorkiyFor = null
                },
                onRetreat = {
                    // Отступил ДО начала игры — попытка не тратится
                    zorkiyFor = null
                }
            )
        }

        // Шит довложения с бонусом за меткий глаз
        reactionInvest?.let { (update, bonus) ->
            val freeBalance by dayFabViewModel.freeBalance.collectAsState()
            com.s0dolamby.game.presentation.common.components.InvestSheet(
                freeBalance = freeBalance,
                bonusText = Strings.t("sechenie.investLine", bonus, update.projectName),
                onDismiss = { reactionInvest = null },
                onInvest = { amount ->
                    dayFabViewModel.investWithReactionBonus(update.projectId, amount, bonus)
                    reactionInvest = null
                }
            )
        }

        // Снэкбар-результат довложения по реакции показываем плашкой DayBreak-стиля
        val reactionResult by dayFabViewModel.reactionInvestResult.collectAsState()
        reactionResult?.let { res ->
            LaunchedEffect(res) {
                kotlinx.coroutines.delay(2000)
                dayFabViewModel.clearReactionInvestResult()
            }
            Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.TopCenter) {
                Box(
                    modifier = Modifier
                        .padding(top = 80.dp)
                        .clip(androidx.compose.foundation.shape.RoundedCornerShape(14.dp))
                        .background(androidx.compose.ui.graphics.Color(0xF01A0F3F))
                        .padding(horizontal = 18.dp, vertical = 12.dp)
                ) {
                    val good = res.startsWith("ok:") || res.startsWith("win:") || res == "unlocked"
                    androidx.compose.material3.Text(
                        when {
                            res.startsWith("ok:") ->
                                Strings.t("sechenie.snack.invested", res.removePrefix("ok:").toDoubleOrNull() ?: 0.0)
                            res.startsWith("win:") ->
                                Strings.t("zorkiy.snack.win", res.removePrefix("win:").toDoubleOrNull() ?: 0.0)
                            res == "freeze" -> Strings.t("zorkiy.snack.freeze")
                            res == "unlocked" -> Strings.t("zorkiy.snack.unlocked")
                            res == "lockstay" -> Strings.t("zorkiy.snack.lockstay")
                            else -> res.removePrefix("err:").ifBlank { Strings.t("ama.err.unknown") }
                        },
                        color = if (good) com.s0dolamby.game.presentation.common.theme.Success
                        else com.s0dolamby.game.presentation.common.theme.Error
                    )
                }
            }
        }

        // Ярмарочная сцена на время advance-day через глобальную кнопку
        // (на главной свой оверлей — HomeScreen). Маскирует генерацию дел.
        DayTransitionOverlay(visible = dayAdvancing)
    } // outer Box end
}
