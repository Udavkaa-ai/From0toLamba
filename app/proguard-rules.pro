# ── Gson: классы, (де)сериализуемые рефлексией ──────────────────────────
# Регистры читают JSON из assets, entity сериализуют списки/мапы в колонки,
# ai-слой гоняет DTO в OpenRouter. Обфускация имён полей ломает парсинг.
-keep class com.s0dolamby.game.data.ai.** { *; }
-keep class com.s0dolamby.game.data.registry.** { *; }
-keep class com.s0dolamby.game.data.db.entity.** { *; }
-keep class com.s0dolamby.game.domain.model.** { *; }

# Gson TypeToken (generic-типы в parseArchetypeMap и т.п.)
-keep class com.google.gson.reflect.TypeToken { *; }
-keep class * extends com.google.gson.reflect.TypeToken
-keepattributes Signature
-keepattributes *Annotation*
-keepattributes EnclosingMethod, InnerClasses

# ── Retrofit ─────────────────────────────────────────────────────────────
-keepattributes Exceptions
-keep,allowobfuscation,allowshrinking interface retrofit2.Call
-keep,allowobfuscation,allowshrinking class retrofit2.Response
-keep,allowobfuscation,allowshrinking class kotlin.coroutines.Continuation

# ── OkHttp: платформенные предупреждения ─────────────────────────────────
-dontwarn okhttp3.internal.platform.**
-dontwarn org.conscrypt.**
-dontwarn org.bouncycastle.**
-dontwarn org.openjdk.**
