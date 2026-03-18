package com.s0dolamby.game.presentation.navigation

import androidx.compose.runtime.Composable
import androidx.navigation.NavType
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import androidx.navigation.navArgument
import com.s0dolamby.game.presentation.ama.AmaScreen
import com.s0dolamby.game.presentation.home.HomeScreen
import com.s0dolamby.game.presentation.inbox.InboxScreen
import com.s0dolamby.game.presentation.news.NewsScreen
import com.s0dolamby.game.presentation.portfolio.PortfolioScreen
import com.s0dolamby.game.presentation.stats.StatsScreen

sealed class Screen(val route: String) {
    object Home : Screen("home")
    object Inbox : Screen("inbox")
    object Ama : Screen("ama/{projectId}") {
        fun createRoute(projectId: String) = "ama/$projectId"
    }
    object Portfolio : Screen("portfolio")
    object News : Screen("news")
    object Stats : Screen("stats")
}

@Composable
fun NavGraph() {
    val navController = rememberNavController()

    NavHost(navController = navController, startDestination = Screen.Home.route) {
        composable(Screen.Home.route) {
            HomeScreen(
                onInboxClick = { navController.navigate(Screen.Inbox.route) },
                onPortfolioClick = { navController.navigate(Screen.Portfolio.route) },
                onNewsClick = { navController.navigate(Screen.News.route) },
                onStatsClick = { navController.navigate(Screen.Stats.route) },
                onProjectClick = { projectId -> navController.navigate(Screen.Ama.createRoute(projectId)) }
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
            AmaScreen(onBack = { navController.popBackStack() })
        }
        composable(Screen.Portfolio.route) {
            PortfolioScreen(onBack = { navController.popBackStack() })
        }
        composable(Screen.News.route) {
            NewsScreen(onBack = { navController.popBackStack() })
        }
        composable(Screen.Stats.route) {
            StatsScreen(onBack = { navController.popBackStack() })
        }
    }
}
