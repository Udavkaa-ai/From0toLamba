package com.s0dolamby.game.presentation.chat

import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.combinedClickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Send
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import com.s0dolamby.game.domain.model.ChatRoomMessage
import com.s0dolamby.game.presentation.common.i18n.Strings
import com.s0dolamby.game.presentation.common.theme.FairyGold
import com.s0dolamby.game.presentation.common.theme.NightBlue

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ChatScreen(
    onBack: () -> Unit,
    viewModel: ChatViewModel = hiltViewModel()
) {
    val state by viewModel.state.collectAsState()
    val listState = rememberLazyListState()

    // Автопрокрутка к свежему сообщению.
    LaunchedEffect(state.messages.size) {
        if (state.messages.isNotEmpty()) listState.animateScrollToItem(state.messages.lastIndex)
    }

    Scaffold(
        containerColor = NightBlue,
        topBar = {
            TopAppBar(
                title = { Text(Strings.t("chat.title"), fontWeight = FontWeight.Bold) },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.Default.ArrowBack, Strings.t("btn.back"))
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = Color(0xFF120A28),
                    titleContentColor = Color.White,
                    navigationIconContentColor = FairyGold
                )
            )
        }
    ) { padding ->
        Column(
            modifier = Modifier
                .padding(padding)
                .fillMaxSize()
                .background(NightBlue)
        ) {
            when {
                state.loading && state.messages.isEmpty() ->
                    Box(Modifier.weight(1f).fillMaxWidth(), contentAlignment = Alignment.Center) {
                        Text(Strings.t("chat.loading"), color = Color.White.copy(alpha = 0.7f))
                    }
                state.error && state.messages.isEmpty() ->
                    Box(Modifier.weight(1f).fillMaxWidth(), contentAlignment = Alignment.Center) {
                        Text(Strings.t("chat.error"), color = Color.White.copy(alpha = 0.7f))
                    }
                state.messages.isEmpty() ->
                    Box(Modifier.weight(1f).fillMaxWidth(), contentAlignment = Alignment.Center) {
                        Text(Strings.t("chat.empty"), color = Color.White.copy(alpha = 0.6f))
                    }
                else ->
                    LazyColumn(
                        state = listState,
                        modifier = Modifier.weight(1f).fillMaxWidth(),
                        contentPadding = PaddingValues(12.dp),
                        verticalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        items(state.messages, key = { it.id }) { msg ->
                            MessageRow(
                                msg = msg,
                                onReply = { viewModel.setReply(msg) },
                                onDelete = { viewModel.delete(msg.id) },
                                onReport = { viewModel.report(msg.id) }
                            )
                        }
                    }
            }

            // Цитата отвечаемого сообщения над полем ввода
            state.replyTo?.let { rep ->
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .background(Color(0xFF1E1440))
                        .padding(horizontal = 12.dp, vertical = 6.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Box(Modifier.width(3.dp).height(32.dp).background(FairyGold))
                    Spacer(Modifier.width(8.dp))
                    Column(Modifier.weight(1f)) {
                        Text(Strings.t("chat.replyTo", rep.nickname), color = FairyGold, fontSize = 12.sp, fontWeight = FontWeight.SemiBold)
                        Text(rep.text, color = Color.White.copy(alpha = 0.7f), fontSize = 12.sp, maxLines = 1)
                    }
                    IconButton(onClick = { viewModel.setReply(null) }) {
                        Icon(Icons.Default.Close, Strings.t("btn.cancel"), tint = Color.White.copy(alpha = 0.6f))
                    }
                }
            }

            // Поле ввода
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .background(Color(0xFF120A28))
                    .padding(8.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                OutlinedTextField(
                    value = state.input,
                    onValueChange = viewModel::setInput,
                    modifier = Modifier.weight(1f),
                    placeholder = { Text(Strings.t("chat.placeholder")) },
                    maxLines = 4,
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedTextColor = Color.White,
                        unfocusedTextColor = Color.White,
                        focusedBorderColor = FairyGold,
                        unfocusedBorderColor = FairyGold.copy(alpha = 0.4f),
                        cursorColor = FairyGold,
                        focusedPlaceholderColor = Color.White.copy(alpha = 0.4f),
                        unfocusedPlaceholderColor = Color.White.copy(alpha = 0.4f)
                    )
                )
                Spacer(Modifier.width(8.dp))
                IconButton(
                    onClick = viewModel::send,
                    enabled = state.input.trim().isNotEmpty() && !state.sending
                ) {
                    Icon(
                        Icons.Default.Send,
                        Strings.t("chat.send"),
                        tint = if (state.input.trim().isNotEmpty()) FairyGold else Color.White.copy(alpha = 0.3f)
                    )
                }
            }
        }
    }
}

@OptIn(ExperimentalFoundationApi::class)
@Composable
private fun MessageRow(
    msg: ChatRoomMessage,
    onReply: () -> Unit,
    onDelete: () -> Unit,
    onReport: () -> Unit
) {
    var menuOpen by remember { mutableStateOf(false) }
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(12.dp))
            .background(if (msg.isMine) Color(0xFF3A2A0E) else Color(0xFF1C142E))
            .border(
                1.dp,
                if (msg.isMine) FairyGold.copy(alpha = 0.4f) else Color.White.copy(alpha = 0.08f),
                RoundedCornerShape(12.dp)
            )
            .combinedClickable(onClick = {}, onLongClick = { menuOpen = true })
            .padding(horizontal = 12.dp, vertical = 8.dp)
    ) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text(msg.nickname, color = FairyGold, fontSize = 13.sp, fontWeight = FontWeight.SemiBold)
            Text(msg.timeLabel, color = Color.White.copy(alpha = 0.4f), fontSize = 11.sp)
        }
        // Цитата
        if (msg.replyToNick != null) {
            Spacer(Modifier.height(4.dp))
            Row(modifier = Modifier.fillMaxWidth()) {
                Box(Modifier.width(2.dp).height(28.dp).background(FairyGold.copy(alpha = 0.6f)))
                Spacer(Modifier.width(6.dp))
                Column(Modifier.weight(1f)) {
                    Text(msg.replyToNick, color = FairyGold.copy(alpha = 0.8f), fontSize = 11.sp)
                    Text(msg.replyToText ?: "", color = Color.White.copy(alpha = 0.55f), fontSize = 12.sp, maxLines = 1)
                }
            }
        }
        Spacer(Modifier.height(3.dp))
        Text(msg.text, color = Color.White.copy(alpha = 0.92f), fontSize = 15.sp, lineHeight = 20.sp)

        DropdownMenu(expanded = menuOpen, onDismissRequest = { menuOpen = false }) {
            DropdownMenuItem(
                text = { Text(Strings.t("chat.action.reply")) },
                onClick = { menuOpen = false; onReply() }
            )
            if (msg.isMine) {
                DropdownMenuItem(
                    text = { Text(Strings.t("chat.action.delete")) },
                    onClick = { menuOpen = false; onDelete() }
                )
            } else {
                DropdownMenuItem(
                    text = { Text(Strings.t("chat.action.report")) },
                    onClick = { menuOpen = false; onReport() }
                )
            }
        }
    }
}
