package com.s0dolamby.game.di

import com.s0dolamby.game.data.repository.*
import com.s0dolamby.game.domain.repository.*
import dagger.Binds
import dagger.Module
import dagger.hilt.InstallIn
import dagger.hilt.components.SingletonComponent
import javax.inject.Singleton

@Module
@InstallIn(SingletonComponent::class)
abstract class RepositoryModule {

    @Binds @Singleton
    abstract fun bindProjectRepository(impl: ProjectRepositoryImpl): ProjectRepository

    @Binds @Singleton
    abstract fun bindGameStateRepository(impl: GameStateRepositoryImpl): GameStateRepository

    @Binds @Singleton
    abstract fun bindAmaRepository(impl: AmaRepositoryImpl): AmaRepository

    @Binds @Singleton
    abstract fun bindUpdateRepository(impl: UpdateRepositoryImpl): UpdateRepository
}
