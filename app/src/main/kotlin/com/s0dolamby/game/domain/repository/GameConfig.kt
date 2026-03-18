package com.s0dolamby.game.domain.repository

object GameConfig {
    const val STARTING_BALANCE = 0.0
    const val ONBOARDING_BONUS_TON = 10.0
    const val MAX_ACTIVE_PROJECTS = 5
    const val AMA_MAX_QUESTIONS = 10
    const val MIN_INVESTMENT_TON = 0.1
    const val MAX_INVESTMENT_TON = 50.0
    const val NEW_PROJECTS_PER_DAY_MIN = 1
    const val NEW_PROJECTS_PER_DAY_MAX = 3

    const val OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1/"
    const val TEXT_MODEL = "deepseek/deepseek-chat-v3-0324"
    const val MAX_TOKENS_AMA = 512
    const val MAX_TOKENS_UPDATE = 400
    const val MAX_TOKENS_POSTMORTEM = 600
    const val MAX_TOKENS_NAME_GEN = 20
    const val MAX_TOKENS_BANNER_CONCEPT = 120

    const val IMAGE_MODEL = "black-forest-labs/flux-schnell"
    const val BANNER_IMAGE_SIZE = "512x512"
}
