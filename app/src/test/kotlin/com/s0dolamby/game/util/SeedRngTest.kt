package com.s0dolamby.game.util

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class SeedRngTest {

    @Test
    fun `same seed produces same sequence`() {
        val a = SeedRng("charter-42").let { rng -> List(20) { rng.nextInt(100) } }
        val b = SeedRng("charter-42").let { rng -> List(20) { rng.nextInt(100) } }
        assertEquals(a, b)
    }

    @Test
    fun `different seeds produce different sequences`() {
        val a = SeedRng("seed-a").let { rng -> List(20) { rng.nextInt(100) } }
        val b = SeedRng("seed-b").let { rng -> List(20) { rng.nextInt(100) } }
        assertNotEquals(a, b)
    }

    @Test
    fun `nextInt is within bounds`() {
        val rng = SeedRng("bounds")
        repeat(10_000) {
            val v = rng.nextInt(24)
            assertTrue("out of range: $v", v in 0..23)
        }
    }

    @Test
    fun `nextDouble is in 0 1 range`() {
        val rng = SeedRng("double")
        repeat(10_000) {
            val v = rng.nextDouble()
            assertTrue("out of range: $v", v in 0.0..1.0)
        }
    }

    @Test
    fun `pick selects deterministically`() {
        val items = listOf("a", "b", "c", "d", "e")
        val a = SeedRng("pick").let { rng -> List(10) { rng.pick(items) } }
        val b = SeedRng("pick").let { rng -> List(10) { rng.pick(items) } }
        assertEquals(a, b)
    }
}
