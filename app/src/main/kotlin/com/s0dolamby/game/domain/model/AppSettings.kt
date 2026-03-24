package com.s0dolamby.game.domain.model

data class AppSettings(
    val textModel: String = "qwen/qwen3.5-flash-02-23",
    val imageGenerationEnabled: Boolean = true
)

data class ModelOption(val label: String, val modelId: String)

val TEXT_MODEL_OPTIONS = listOf(
    ModelOption("Qwen Flash (рекомендуется)", "qwen/qwen3.5-flash-02-23"),
    ModelOption("DeepSeek Chat v3", "deepseek/deepseek-chat-v3-0324"),
    ModelOption("Gemini Flash Lite", "google/gemini-2.5-flash-lite-preview-09-2025"),
    ModelOption("Qwen3 235B (мощный)", "qwen/qwen3-235b-a22b")
)
