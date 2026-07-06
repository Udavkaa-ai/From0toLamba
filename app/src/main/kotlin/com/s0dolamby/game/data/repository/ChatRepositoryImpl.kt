package com.s0dolamby.game.data.repository

import com.s0dolamby.game.BuildConfig
import com.s0dolamby.game.data.ai.GameChatActionRequest
import com.s0dolamby.game.data.ai.GameChatPostRequest
import com.s0dolamby.game.data.ai.OpenRouterApiService
import com.s0dolamby.game.data.logging.AppLogger
import com.s0dolamby.game.domain.model.ChatRoomMessage
import com.s0dolamby.game.domain.repository.ChatRepository
import com.s0dolamby.game.domain.repository.SettingsRepository
import java.time.OffsetDateTime
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.util.UUID
import javax.inject.Inject

class ChatRepositoryImpl @Inject constructor(
    private val api: OpenRouterApiService,
    private val settingsRepository: SettingsRepository
) : ChatRepository {

    private val timeFmt = DateTimeFormatter.ofPattern("HH:mm")

    /** Стабильный id игрока: тот же, что в купеческом рейтинге. */
    private suspend fun ensurePlayerId(): String {
        val s = settingsRepository.getSettings()
        if (s.playerId.isNotBlank()) return s.playerId
        val fresh = UUID.randomUUID().toString()
        settingsRepository.updateSettings(s.copy(playerId = fresh))
        return fresh
    }

    override suspend fun fetch(): Result<List<ChatRoomMessage>> = runCatching {
        val myId = settingsRepository.getSettings().playerId
        val resp = api.fetchChatMessages(BuildConfig.MOBILE_APP_KEY, afterId = 0, limit = 120)
        resp.messages.map { d ->
            ChatRoomMessage(
                id = d.id,
                nickname = d.nickname,
                text = d.text,
                timeLabel = formatTime(d.createdAt),
                isMine = myId.isNotBlank() && d.playerId == myId,
                replyToNick = d.replyToNick,
                replyToText = d.replyToText
            )
        }
    }.onFailure { AppLogger.e("Chat", "fetch failed", it) }

    override suspend fun send(text: String, replyToId: Int?): Result<Unit> = runCatching {
        val clean = text.trim()
        require(clean.isNotEmpty()) { "Пустое сообщение" }
        val settings = settingsRepository.getSettings()
        val nickname = settings.nickname.trim()
        require(nickname.isNotBlank()) { "Сначала задай имя купца" }
        val playerId = ensurePlayerId()
        api.postChatMessage(
            appKey = BuildConfig.MOBILE_APP_KEY,
            request = GameChatPostRequest(
                playerId = playerId,
                nickname = nickname,
                text = clean.take(500),
                replyToId = replyToId
            )
        )
        Unit
    }.onFailure { AppLogger.e("Chat", "send failed", it) }

    override suspend fun delete(messageId: Int): Result<Unit> = runCatching {
        val playerId = settingsRepository.getSettings().playerId
        api.deleteChatMessage(BuildConfig.MOBILE_APP_KEY, GameChatActionRequest(playerId, messageId))
        Unit
    }.onFailure { AppLogger.e("Chat", "delete failed", it) }

    override suspend fun report(messageId: Int): Result<Unit> = runCatching {
        val playerId = settingsRepository.getSettings().playerId
        api.reportChatMessage(BuildConfig.MOBILE_APP_KEY, GameChatActionRequest(playerId, messageId))
        Unit
    }.onFailure { AppLogger.e("Chat", "report failed", it) }

    private fun formatTime(iso: String): String = runCatching {
        OffsetDateTime.parse(iso).atZoneSameInstant(ZoneId.systemDefault()).format(timeFmt)
    }.getOrDefault("")
}
