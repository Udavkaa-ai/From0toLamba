package com.s0dolamby.game.util

/**
 * Detеrministic 32-bit RNG.
 *
 * Seed → 32-bit Int via FNV-1a, затем mulberry32 (точная транслитерация
 * каноничной JS-версии, поскольку `Int * Int` в Kotlin это signed 32-bit
 * умножение, эквивалент `Math.imul`).
 *
 * Один и тот же seed даёт один и тот же поток на JVM и в JS.
 */
class SeedRng(seed: String) {
    private var state: Int = fnv1a(seed)

    fun nextDouble(): Double {
        val raw = nextRaw().toLong() and 0xFFFFFFFFL
        return raw.toDouble() / TWO_TO_32
    }

    fun nextInt(boundExclusive: Int): Int {
        require(boundExclusive > 0) { "bound must be > 0" }
        val raw = nextRaw().toLong() and 0xFFFFFFFFL
        return (raw % boundExclusive).toInt()
    }

    fun nextBoolean(): Boolean = nextDouble() < 0.5

    fun <T> pick(items: List<T>): T = items[nextInt(items.size)]

    private fun nextRaw(): Int {
        state += MULBERRY_INC
        var t = state
        t = (t xor (t ushr 15)) * (t or 1)
        t = t xor (t + ((t xor (t ushr 7)) * (t or 61)))
        return t xor (t ushr 14)
    }

    private companion object {
        const val FNV_OFFSET = -2128831035        // 0x811C9DC5 as signed Int
        const val FNV_PRIME = 16777619            // 0x01000193
        const val MULBERRY_INC = 0x6D2B79F5
        const val TWO_TO_32 = 4294967296.0

        fun fnv1a(input: String): Int {
            var hash = FNV_OFFSET
            for (ch in input) {
                hash = hash xor ch.code
                hash *= FNV_PRIME
            }
            return hash
        }
    }
}
