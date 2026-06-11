package com.s0dolamby.game.domain.repository

import com.s0dolamby.game.domain.model.DEFAULT_TEXT_MODEL

object GameConfig {
    const val STARTING_BALANCE = 0.0
    const val ONBOARDING_BONUS_RUBLES = 50.0   // выплата за обучающую беседу в кабаке
    const val MAX_ACTIVE_PROJECTS = 5
    const val AMA_MAX_QUESTIONS = 10
    const val MIN_INVESTMENT_RUBLES = 5.0
    const val MAX_INVESTMENT_RUBLES = 5000.0
    const val NEW_PROJECTS_PER_DAY_MIN = 1
    const val NEW_PROJECTS_PER_DAY_MAX = 3

    const val OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1/"
    val TEXT_MODEL = DEFAULT_TEXT_MODEL
    const val MAX_TOKENS_AMA = 512
    const val MAX_TOKENS_UPDATE = 650
    const val MAX_TOKENS_POSTMORTEM = 600
    const val MAX_TOKENS_NAME_GEN = 20
}
