package com.s0dolamby.game.domain.usecase

import com.s0dolamby.game.domain.model.*
import com.s0dolamby.game.domain.repository.GameStateRepository
import com.s0dolamby.game.domain.repository.ProjectRepository
import io.mockk.*
import kotlinx.coroutines.test.runTest
import org.junit.Assert.*
import org.junit.Before
import org.junit.Test

class InvestUseCaseTest {

    private val gameStateRepo = mockk<GameStateRepository>()
    private val projectRepo = mockk<ProjectRepository>()
    private val bannerUseCase = mockk<GenerateProjectBannerUseCase>(relaxed = true)
    private lateinit var useCase: InvestUseCase

    private val testProject = Project(
        id = "p1", name = "TestProject", type = ProjectType.CARD_GAME,
        developerPersonaId = "d1", fate = ProjectFate.SLOW_DRAIN,
        personaArchetype = PersonaArchetype.BURATINO,
        daysUntilCollapse = 10, realDailyYieldRubles = 0.005,
        lieTopics = listOf(LieTopic.PATRON_COUNT), truthTopics = emptyList(),
        npcTruthParams = NpcTruthParams(
            realPatronCount = 100, realDailyProfitDesc = "1%", realPayoutSchedule = "weekly",
            realGuildSize = 5, elderBlessingPassed = false, nobleBacking = null,
            withdrawalPolicy = "no limits"
        ),
        developerName = "Паша", developerAvatarSeed = "seed",
        claimedName = "TestProject", claimedAPY = 300f,
        claimedUserCount = 10000, claimedTeamSize = 5,
        roadmap = listOf("Launch", "Token"), description = "Test",
        investedAmountRubles = 0.0, isActive = false
    )

    private val testGameState = GameState(
        balance = 100.0, currentDay = 1, activeProjects = emptyList(),
        pendingInbox = emptyList(), investorRank = InvestorRank.NEWBIE,
        totalInvested = 0.0, totalReturned = 0.0,
        scamsDetected = 0, scamsMissed = 0, dayStreak = 1
    )

    @Before
    fun setup() {
        useCase = InvestUseCase(gameStateRepo, projectRepo, bannerUseCase)
    }

    @Test
    fun `invest success updates balance and project`() = runTest {
        coEvery { gameStateRepo.getGameState() } returns testGameState
        coEvery { projectRepo.getProjectById("p1") } returns testProject
        coEvery { projectRepo.updateProject(any()) } just Runs
        coEvery { gameStateRepo.updateBalance(any()) } just Runs
        coEvery { gameStateRepo.recordInvestment(any()) } just Runs
        coEvery { gameStateRepo.updateRankIfNeeded() } just Runs

        val result = useCase("p1", 10.0)

        assertTrue(result.isSuccess)
        coVerify { gameStateRepo.updateBalance(90.0) }
        coVerify { gameStateRepo.recordInvestment(10.0) }
        coVerify { projectRepo.updateProject(match { it.investedAmountRubles == 10.0 && it.isActive }) }
    }

    @Test
    fun `invest fails when balance insufficient`() = runTest {
        coEvery { gameStateRepo.getGameState() } returns testGameState.copy(balance = 3.0)
        coEvery { projectRepo.getProjectById("p1") } returns testProject

        val result = useCase("p1", 10.0)

        assertTrue(result.isFailure)
        assertTrue(result.exceptionOrNull()?.message?.contains("Недостаточно") == true)
    }

    @Test
    fun `invest fails when amount below minimum`() = runTest {
        val result = useCase("p1", 1.0)
        assertTrue(result.isFailure)
    }

    @Test
    fun `invest fails when max active projects reached`() = runTest {
        val fullState = testGameState.copy(
            activeProjects = List(5) { testProject.copy(id = "p$it") }
        )
        coEvery { gameStateRepo.getGameState() } returns fullState
        coEvery { projectRepo.getProjectById("p1") } returns testProject

        val result = useCase("p1", 5.0)
        assertTrue(result.isFailure)
    }
}
