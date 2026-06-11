package com.s0dolamby.game.presentation.navigation

import androidx.compose.runtime.*
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import androidx.navigation.NavType
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import androidx.navigation.navArgument
import com.s0dolamby.game.domain.repository.GameStateRepository
import com.s0dolamby.game.presentation.ama.AmaScreen
import com.s0dolamby.game.presentation.home.HomeScreen
import com.s0dolamby.game.presentation.inbox.InboxScreen
import com.s0dolamby.game.presentation.leaderboard.LeaderboardScreen
import com.s0dolamby.game.presentation.minigame.goldenkey.GoldenKeyScreen
import com.s0dolamby.game.presentation.minigame.kolobok.KolobokNoraScreen
import com.s0dolamby.game.presentation.minigame.koschei.KoscheiMemoryScreen
import com.s0dolamby.game.presentation.minigame.zolushka.ZolushkaCoinsScreen
import com.s0dolamby.game.presentation.news.NewsScreen
import com.s0dolamby.game.presentation.onboarding.OnboardingScreen
import com.s0dolamby.game.presentation.portfolio.PortfolioScreen
import com.s0dolamby.game.presentation.portfolio.ProjectDetailScreen
import com.s0dolamby.game.presentation.registry.PersonaRegistryScreen
import com.s0dolamby.game.presentation.settings.SettingsScreen
import com.s0dolamby.game.presentation.stats.StatsScreen
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
    object Leaderboard : Screen("leaderboard")
}

@HiltViewModel
class NavViewModel @Inject constructor(
    private val gameStateRepository: GameStateRepository
) : ViewModel() {

    private val _isOnboardingComplete = MutableStateFlow<Boolean?>(null)
    val isOnboardingComplete: StateFlow<Boolean?> = _isOnboardingComplete.asStateFlow()

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
                onNewsClick = { navController.navigate(Screen.News.route) },
                onStatsClick = { navController.navigate(Screen.Stats.route) },
                onLeaderboardClick = { navController.navigate(Screen.Leaderboard.route) },
                onRegistryClick = { navController.navigate(Screen.PersonaRegistry.route) },
                onProjectClick = { projectId -> navController.navigate(Screen.ProjectDetail.createRoute(projectId)) },
                onSettingsClick = { navController.navigate(Screen.Settings.route) }
            )
        }
        composable(Screen.Inbox.route) {
            InboxScreen(
                onBack = { navController.popBackStack() },
                onProjectClick = { projectId -> navController.navigate(Screen.Ama.createRoute(projectId)) }
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
                onTryZolushkaCoins = { navController.navigate(Screen.ZolushkaCoins.route) }
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
        composable(Screen.Leaderboard.route) {
            LeaderboardScreen(onBack = { navController.popBackStack() })
        }
    }
}
