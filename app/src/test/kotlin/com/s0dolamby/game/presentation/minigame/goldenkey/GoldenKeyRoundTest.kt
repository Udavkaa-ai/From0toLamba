package com.s0dolamby.game.presentation.minigame.goldenkey

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class GoldenKeyRoundTest {

    @Test
    fun `default round has 9 unique options including the correct key`() {
        val (correct, options) = buildRound("seed-1")
        assertEquals(9, options.size)
        assertEquals(9, options.toSet().size)
        assertTrue("correct key must be among options", correct in options)
    }

    @Test
    fun `custom optionCount honored`() {
        val (_, options) = buildRound("seed-1", optionCount = 6)
        assertEquals(6, options.size)
        assertEquals(6, options.toSet().size)
    }

    @Test
    fun `same seed produces the same round`() {
        val (c1, o1) = buildRound("seed-x")
        val (c2, o2) = buildRound("seed-x")
        assertEquals(c1, c2)
        assertEquals(o1, o2)
    }

    @Test
    fun `different seeds usually produce different rounds`() {
        val (c1, _) = buildRound("seed-a")
        val (c2, _) = buildRound("seed-b")
        // Не гарантия — но для двух разных строк-семян очень редко совпадает
        assertTrue("seeds gave the same correct key — подозрительно", c1 != c2)
    }

    @Test
    fun `wrong options differ from correct in at least one attribute`() {
        val (correct, options) = buildRound("seed-diff")
        val wrongs = options.filter { it != correct }
        wrongs.forEach { wrong ->
            val diffs = listOfNotNull(
                if (wrong.bowlShape != correct.bowlShape) 1 else null,
                if (wrong.color != correct.color) 1 else null,
                if (wrong.teethCount != correct.teethCount) 1 else null,
                if (wrong.stemPattern != correct.stemPattern) 1 else null,
                if (wrong.hasTassel != correct.hasTassel) 1 else null,
            ).size
            assertTrue("wrong key must differ from correct in at least one attribute", diffs >= 1)
        }
    }
}
