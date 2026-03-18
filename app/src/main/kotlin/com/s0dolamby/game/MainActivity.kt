package com.s0dolamby.game

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import com.s0dolamby.game.presentation.navigation.NavGraph
import com.s0dolamby.game.presentation.common.theme.From0toLambaTheme
import dagger.hilt.android.AndroidEntryPoint

@AndroidEntryPoint
class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        setContent {
            From0toLambaTheme {
                NavGraph()
            }
        }
    }
}
