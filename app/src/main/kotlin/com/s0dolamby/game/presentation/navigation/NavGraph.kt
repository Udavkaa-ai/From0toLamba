package com.s0dolamby.game.presentation.navigation

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.*
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
                onRegistryClick = { navController.navigate(Screen.PersonaRegistry.route) }
            )
        }
        composable(Screen.PersonaRegistry.route) {
            PersonaRegistryScreen(onBack = { navController.popBackStack() })
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
                    // После победы заменяем gate в стеке на AMA-беседу, где
                    // кнопка инвеста увидит unlock в MinigameUnlockStore и
                    // юзер сможет открыть invest-sheet тапом «Вложить».
                    // Если был раскрыт идеал — AMA покажет панель «Раскрытые
                    // сведения» с реальным посулом и судьбой дела.
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
        GlobalDayFab(
            visible = showGlobalFab,
            modifier = Modifier.align(Alignment.BottomEnd)
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

        // Плашка «🌅 Утро дня N» при переходе дня — глобально.
        if (currentDay > 0) DayBreakOverlay(currentDay)
    } // outer Box end
}
