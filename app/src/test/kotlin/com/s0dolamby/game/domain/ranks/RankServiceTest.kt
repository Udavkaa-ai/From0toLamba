package com.s0dolamby.game.domain.ranks

import com.s0dolamby.game.domain.model.InvestorRank
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class RankServiceTest {

    @Test
    fun `boundaries map to expected ranks`() {
        assertEquals(InvestorRank.NEWBIE,       RankService.rankFor(0))
        assertEquals(InvestorRank.NEWBIE,       RankService.rankFor(4))
        assertEquals(InvestorRank.AMBASSADOR,   RankService.rankFor(5))
        assertEquals(InvestorRank.AMBASSADOR,   RankService.rankFor(19))
        assertEquals(InvestorRank.ANALYST,      RankService.rankFor(20))
        assertEquals(InvestorRank.ANALYST,      RankService.rankFor(49))
        assertEquals(InvestorRank.SHARK,        RankService.rankFor(50))
        assertEquals(InvestorRank.SHARK,        RankService.rankFor(99))
        assertEquals(InvestorRank.LAMBO_SENSEI, RankService.rankFor(100))
        assertEquals(InvestorRank.LAMBO_SENSEI, RankService.rankFor(9_999))
    }

    @Test
    fun `dealsUntilNextRank counts down correctly`() {
        assertEquals(5,  RankService.dealsUntilNextRank(0))
        assertEquals(1,  RankService.dealsUntilNextRank(4))
        assertEquals(15, RankService.dealsUntilNextRank(5))
        assertEquals(1,  RankService.dealsUntilNextRank(19))
        assertEquals(30, RankService.dealsUntilNextRank(20))
        assertEquals(50, RankService.dealsUntilNextRank(50))
        assertEquals(1,  RankService.dealsUntilNextRank(99))
        assertNull(RankService.dealsUntilNextRank(100))
        assertNull(RankService.dealsUntilNextRank(1_000_000))
    }
}
