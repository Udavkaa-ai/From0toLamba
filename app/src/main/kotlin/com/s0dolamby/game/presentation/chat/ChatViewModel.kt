package com.s0dolamby.game.presentation.chat

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.s0dolamby.game.domain.model.ChatRoomMessage
import com.s0dolamby.game.domain.repository.ChatRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import javax.inject.Inject

data class ChatUiState(
    val messages: List<ChatRoomMessage> = emptyList(),
    val loading: Boolean = true,
    val error: Boolean = false,
    val input: String = "",
    val replyTo: ChatRoomMessage? = null,
    val sending: Boolean = false
)

@HiltViewModel
class ChatViewModel @Inject constructor(
    private val repository: ChatRepository
) : ViewModel() {

    private val _state = MutableStateFlow(ChatUiState())
    val state = _state.asStateFlow()

    init {
        refresh(showLoading = true)
        // Мягкий поллинг, пока экран открыт (ViewModel живёт с nav-entry).
        viewModelScope.launch {
            while (isActive) {
                delay(5000)
                refresh(showLoading = false)
            }
        }
    }

    fun refresh(showLoading: Boolean = false) {
        viewModelScope.launch {
            if (showLoading) _state.value = _state.value.copy(loading = true)
            val result = repository.fetch()
            result.fold(
                onSuccess = { _state.value = _state.value.copy(messages = it, loading = false, error = false) },
                onFailure = { _state.value = _state.value.copy(loading = false, error = _state.value.messages.isEmpty()) }
            )
        }
    }

    fun setInput(text: String) { _state.value = _state.value.copy(input = text.take(500)) }

    fun setReply(msg: ChatRoomMessage?) { _state.value = _state.value.copy(replyTo = msg) }

    fun send() {
        val cur = _state.value
        val text = cur.input.trim()
        if (text.isEmpty() || cur.sending) return
        _state.value = cur.copy(sending = true)
        viewModelScope.launch {
            repository.send(text, cur.replyTo?.id)
            _state.value = _state.value.copy(input = "", replyTo = null, sending = false)
            refresh(showLoading = false)
        }
    }

    fun delete(messageId: Int) {
        viewModelScope.launch {
            repository.delete(messageId)
            refresh(showLoading = false)
        }
    }

    fun report(messageId: Int) {
        viewModelScope.launch { repository.report(messageId) }
    }
}
