package com.s0dolamby.game.domain.config

import com.s0dolamby.game.domain.model.PersonaArchetype
import com.s0dolamby.game.domain.model.ProjectFate
import com.s0dolamby.game.domain.model.ProjectType
import org.junit.Assert.assertEquals
import org.junit.Test

class ConfigCompletenessTest {

    @Test
    fun `FateConfig covers all ProjectFate values`() {
        ProjectFate.values().forEach { fate -> FateConfig[fate] }
    }

    @Test
    fun `FateConfig weights sum to 100`() {
        val sum = ProjectFate.values().sumOf { FateConfig[it].weight }
        assertEquals(100, sum)
    }

    @Test
    fun `WithdrawalRules covers all ProjectType values`() {
        ProjectType.values().forEach { type -> WithdrawalRules[type] }
    }

    @Test
    fun `MinigameInfo covers all PersonaArchetype values`() {
        PersonaArchetype.values().forEach { arch -> MinigameInfo[arch] }
    }
}
