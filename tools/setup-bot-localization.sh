#!/usr/bin/env bash
# Локализация бота через Telegram Bot API. BotFather UI поддерживает только
# одно имя/описание — мы используем прямые API-вызовы с language_code, чтобы
# RU-юзеры видели «Из грязи в князи», а остальные — «From Rags to Riches».
#
# Запуск:
#   TELEGRAM_BOT_TOKEN=123:ABC... ./tools/setup-bot-localization.sh
#
# Что выставляется:
#   • Default (любой язык кроме ru) — английские строки
#   • language_code='ru' — русские строки
#
# Запускать можно сколько угодно раз — API идемпотентен, новые значения
# перезатирают старые.

set -euo pipefail

if [[ -z "${TELEGRAM_BOT_TOKEN:-}" ]]; then
  echo "TELEGRAM_BOT_TOKEN env var не задан" >&2
  echo "Запуск: TELEGRAM_BOT_TOKEN=123:ABC... $0" >&2
  exit 1
fi

API="https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}"

# ── Тексты ──────────────────────────────────────────────────────────────────

NAME_EN="From Rags to Riches"
NAME_RU="Из грязи в князи"

# Короткое описание — показывается в превью бота, до 120 символов.
SHORT_EN="A merchant in an old Russian fairy tale. Invest, spot scammers, get rich — or go bust."
SHORT_RU="Купец в старинной Сказке. Вкладывай свои гроши, распознавай мошенников, богатей — или прогоришь."

# Длинное описание — открывается при нажатии на имя бота, до 512 символов.
DESC_EN='"From Rags to Riches" — a merchant-investor simulator in fairy-tale Russia.

💰 Invest your kopecks in offers from Dealers — most are scams. Spot them through trial games and conversations.

📜 Decipher the Merchant Charter with 24 seals
💬 Question the Dealers in person — under pressure they slip up
🏆 Compete with other merchants on the market fair ranking

⭐ Season 2 starts May 1st — top merchants get prizes!'

DESC_RU='«Из грязи в князи» — симулятор купца-инвестора в сказочной Руси.

💰 Вкладывай гроши в предложения дельцов — большинство из них обман. Распознавай мошенников через испытания и беседы.

📜 Разбирай Купеческую грамоту с 24 печатями
💬 Допрашивай Дельцов лично — под давлением они проговариваются
🏆 Соревнуйся с другими купцами в ярмарочном рейтинге

⭐ С 1 мая — стартовый чемпионат. Лучших купцов ждут призы!'

# ── Вызов API ────────────────────────────────────────────────────────────────

call() {
  local method="$1"; shift
  local payload="$1"; shift
  local label="$1"

  echo "→ $label"
  local resp
  resp=$(curl -sS -X POST "${API}/${method}" \
    -H "Content-Type: application/json" \
    -d "$payload")
  if echo "$resp" | grep -q '"ok":true'; then
    echo "   ok"
  else
    echo "   FAIL: $resp" >&2
    exit 1
  fi
}

# jq бы упростил, но не у всех установлен — собираем JSON вручную через python3.
json() {
  python3 -c 'import json, sys; print(json.dumps(dict(zip(sys.argv[1::2], sys.argv[2::2]))))' "$@"
}

# Default (EN)
call setMyName              "$(json name "$NAME_EN")"                                 "setMyName (default)"
call setMyShortDescription  "$(json short_description "$SHORT_EN")"                   "setMyShortDescription (default)"
call setMyDescription       "$(json description "$DESC_EN")"                          "setMyDescription (default)"

# Russian
call setMyName              "$(json name "$NAME_RU" language_code ru)"                "setMyName (ru)"
call setMyShortDescription  "$(json short_description "$SHORT_RU" language_code ru)"  "setMyShortDescription (ru)"
call setMyDescription       "$(json description "$DESC_RU" language_code ru)"         "setMyDescription (ru)"

echo
echo "✅ Готово. RU-юзеры будут видеть «Из грязи в князи»,"
echo "   остальные — «From Rags to Riches»."
echo "   Изменения вступают в силу в Telegram-клиентах в течение ~минуты."
