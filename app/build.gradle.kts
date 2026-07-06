import java.util.Properties

plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.kotlin.android)
    alias(libs.plugins.kotlin.compose)
    alias(libs.plugins.ksp)
    alias(libs.plugins.hilt)
}

val localProperties = Properties()
val localPropertiesFile = rootProject.file("local.properties")
if (localPropertiesFile.exists()) {
    localProperties.load(localPropertiesFile.inputStream())
}

// Короткий git-хэш текущего коммита — чтобы у каждой тестовой сборки была
// прослеживаемая версия и баг можно было привязать к конкретному билду.
// Если git недоступен (архив без .git) — молча остаёмся без суффикса.
val gitShortSha: String = try {
    val process = ProcessBuilder("git", "rev-parse", "--short", "HEAD")
        .directory(rootProject.projectDir)
        .redirectErrorStream(true)
        .start()
    val out = process.inputStream.bufferedReader().readText().trim()
    process.waitFor()
    if (process.exitValue() == 0 && out.isNotEmpty()) out else ""
} catch (_: Exception) {
    ""
}

android {
    namespace = "com.s0dolamby.game"
    compileSdk = 35

    defaultConfig {
        applicationId = "com.s0dolamby.game"
        minSdk = 26
        targetSdk = 35
        versionCode = 2
        versionName = "0.2.0"

        // AI ходит через ОТДЕЛЬНЫЙ mobile-backend на Railway: ключ
        // OpenRouter живёт там, в APK не попадает. MOBILE_APP_KEY — лёгкий
        // допуск к прокси. MOBILE_PROXY_URL — домен mobile-backend-сервиса
        // (Railway выдаёт свой при создании), задаётся секретом/local.properties.
        // Дефолт-плейсхолдер: без реального URL сборка соберётся, но AI/фидбек
        // работать не будут — обязательно задать MOBILE_PROXY_URL.
        buildConfigField(
            "String",
            "MOBILE_PROXY_URL",
            "\"${localProperties.getProperty(
                "MOBILE_PROXY_URL",
                "https://mobile-backend.up.railway.app/"
            )}\""
        )
        buildConfigField(
            "String",
            "MOBILE_APP_KEY",
            "\"${localProperties.getProperty("MOBILE_APP_KEY", "")}\""
        )

        // Реклама (Yandex Mobile Ads / РСЯ). По умолчанию ВЫКЛ — SDK лежит в
        // APK, но не инициализируется и рекламу не показывает. Включается
        // секретом/local.properties (ADS_ENABLED=true) вместе с реальным
        // YANDEX_REWARDED_UNIT_ID. Дефолтный блок — демо-блок Яндекса для
        // тестов (всегда отдаёт тестовую рекламу).
        buildConfigField(
            "Boolean",
            "ADS_ENABLED",
            localProperties.getProperty("ADS_ENABLED", "false")
        )
        buildConfigField(
            "String",
            "YANDEX_REWARDED_UNIT_ID",
            "\"${localProperties.getProperty("YANDEX_REWARDED_UNIT_ID", "demo-rewarded-yandex")}\""
        )
    }

    signingConfigs {
        // Фиксированный debug-ключ из репозитория: каждый CI-раннер по умолчанию
        // генерит СВОЙ debug.keystore → подпись меняется от сборки к сборке и
        // Android отказывается обновлять APK. С общим ключом обновление работает.
        getByName("debug") {
            storeFile = file("debug.keystore")
            storePassword = "android"
            keyAlias = "androiddebugkey"
            keyPassword = "android"
        }
    }

    buildTypes {
        debug {
            // CI собирает debug-APK, релиз в Play подписан другим ключом —
            // без суффикса Android не даёт обновить (конфликт подписей).
            // С суффиксом debug-сборка ставится рядом как отдельное приложение.
            applicationIdSuffix = ".debug"
            // К версии добавляем git-хэш билда: «0.1.0-debug+a1b2c3d».
            // Так тестер видит на экране «О игре»/в фидбеке точный коммит.
            versionNameSuffix = "-debug" + (if (gitShortSha.isNotEmpty()) "+$gitShortSha" else "")
            resValue("string", "app_name_override", "Из грязи в князи (debug)")
            manifestPlaceholders["appLabel"] = "@string/app_name_override"
            signingConfig = signingConfigs.getByName("debug")
        }
        release {
            // Минификация + вырезание неиспользуемых ресурсов для Play.
            // Keep-правила для Gson/Room/Retrofit — в proguard-rules.pro.
            // ВАЖНО: перед публикацией собрать release локально и прогнать
            // смоук-тест — CI собирает только debug.
            isMinifyEnabled = true
            isShrinkResources = true
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")
            manifestPlaceholders["appLabel"] = "@string/app_name"
            // signingConfig задаётся при публикации: ключ НЕ хранится в репо.
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_11
        targetCompatibility = JavaVersion.VERSION_11
    }

    kotlinOptions {
        jvmTarget = "11"
    }

    buildFeatures {
        compose = true
        buildConfig = true
    }

    lint {
        abortOnError = true
        lintConfig = file("lint.xml")
        htmlReport = true
        htmlOutput = file("build/reports/lint/lint-report.html")
        // Проверять ресурсы и зависимости
        checkDependencies = true
        // Не останавливать сборку на warning, только на error
        warningsAsErrors = false
    }
}

dependencies {
    implementation(libs.androidx.core.ktx)
    implementation(libs.androidx.lifecycle.runtime.ktx)
    implementation(libs.androidx.activity.compose)

    // Реклама — Yandex Mobile Ads (РСЯ/YAN). Инициализация под флагом ADS_ENABLED.
    implementation("com.yandex.android:mobileads:8.2.0")

    // Compose
    implementation(platform(libs.androidx.compose.bom))
    implementation(libs.androidx.ui)
    implementation(libs.androidx.ui.graphics)
    implementation(libs.androidx.ui.tooling.preview)
    implementation(libs.androidx.material3)
    implementation(libs.androidx.material.icons.extended)
    implementation(libs.androidx.lifecycle.viewmodel.compose)
    implementation(libs.androidx.navigation.compose)
    debugImplementation(libs.androidx.ui.tooling)

    // Hilt
    implementation(libs.hilt.android)
    ksp(libs.hilt.compiler)
    implementation(libs.hilt.navigation.compose)
    implementation(libs.hilt.work)
    ksp(libs.hilt.work.compiler)

    // Room
    implementation(libs.room.runtime)
    implementation(libs.room.ktx)
    ksp(libs.room.compiler)

    // Network
    implementation(libs.retrofit)
    implementation(libs.retrofit.gson)
    implementation(libs.okhttp)
    implementation(libs.okhttp.logging)
    implementation(libs.gson)

    // Coil
    implementation(libs.coil.compose)

    // WorkManager
    implementation(libs.work.runtime.ktx)

    // Coroutines
    implementation(libs.kotlinx.coroutines.android)

    // Test
    testImplementation(libs.junit)
    testImplementation(libs.mockk)
    testImplementation(libs.kotlinx.coroutines.test)
}
