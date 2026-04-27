import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { colors, spacing } from '@/theme'

interface Slide {
  emoji: string
  title: string
  body: string
  accent?: string
}

const SLIDES: Slide[] = [
  {
    emoji: '📜',
    title: 'Ярмарка «Из грязи в князи»',
    body: 'Ты молодой купец в сказочной Руси. Стартуешь с пустыми карманами, а цель — взойти до Князя. Гроши вкладываешь в дела, что приносят хозяева, но многие из них обманщики — отличать правду от лжи научишься сам.',
  },
  {
    emoji: '✉️',
    title: 'Входящие грамоты',
    body: 'Каждый день в твой сундук ложатся 1–3 новых грамоты от хозяев дел. Можно изучить, вложиться — или отправить восвояси. Читай внимательно: сулят иногда бешеные иксы, а иногда — верный путь в казну, только не свою.',
  },
  {
    emoji: '🔍',
    title: 'Купеческая грамота',
    body: 'Перед каждым делом — испытание на внимательность. Эталонная печать, а рядом 24 ячейки, где есть поддельные. На поиск — 15 секунд. Чем больше в деле лжи, тем больше подделок. Нашёл — чин растёт, пропустил — чуйка падает на два.',
    accent: '👁 Чуйка: +1 за находку, −2 за пропуск',
  },
  {
    emoji: '⚙️',
    title: 'Пять пород дел',
    body: 'Азартная игра, Поиск клада, Зелейное дело, Артель и Честная торговля. У каждой свой нрав: где-то за вывод берут четверть, где-то отпускают не больше четверти за раз. Честная торговля — без ограничений, но и иксов там нет.',
  },
  {
    emoji: '🎭',
    title: 'Семь личин хозяев',
    body: 'Хозяева дел носят сказочные личины. Буратино болтлив и наивен, Кощей холоден и считает процентами, Колобок катит всё в частушку, Иван-дурак признаёт провалы сам. Узнаешь повадку — проще заметишь ложь.',
  },
  {
    emoji: '🎯',
    title: 'Пять судеб',
    body: 'Дело может сбежать с казной (самое подлое), тихо угаснуть, честно провалиться, выжить с прибылью или — единожды из двадцати — взмыть Жар-птицей. Разбор любого закрытого дела откроет его судьбу в «Летописи».',
    accent: '🔥 Поймай Жар-птицу за хвост — и обгонишь других купцов',
  },
  {
    emoji: '🏆',
    title: 'Чины и ярмарочный рейтинг',
    body: 'Скоморох → Купец → Мудрец → Боярин → Князь. Поднимаешься по чинам копя гроши и растя чуйку. В «Успехах» собирай подвиги — заодно откроешь справочник пород, личин и судеб.',
  },
  {
    emoji: '📜',
    title: 'Правила и ответственность',
    body: '«Из грязи в князи» — симуляционная игра. Все проекты, персонажи и события вымышлены и не являются инвестиционными советами. Игровые гроши (г) не имеют реальной стоимости.\n\nПлатежи за дополнительные возможности (Telegram Stars) обрабатываются Telegram. Используя приложение, вы подтверждаете, что вам исполнилось 18 лет.\n\nВремя от времени разработчики проводят конкурсы с реальными призами — следи за объявлениями в игре.',
    accent: 'Нажимая «Принять», вы соглашаетесь с правилами игры',
  },
]

export function OnboardingTutorial({ onClose }: { onClose: () => void }) {
  const [idx, setIdx] = useState(0)
  const slide = SLIDES[idx]
  const isLast = idx === SLIDES.length - 1

  const next = () => {
    if (isLast) onClose()
    else setIdx(idx + 1)
  }
  const back = () => idx > 0 && setIdx(idx - 1)

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      style={{
        position: 'fixed', inset: 0, zIndex: 300,
        background: 'rgba(6, 4, 18, 0.92)',
        display: 'flex', flexDirection: 'column',
        padding: `${spacing.lg}`,
        paddingTop: `calc(${spacing.lg} + env(safe-area-inset-top))`,
        // Снизу — BottomNav (~60px на родительской странице) + safe-area
        paddingBottom: `calc(72px + ${spacing.md} + env(safe-area-inset-bottom))`,
        overflowY: 'auto',
      }}
    >
      {/* Кнопка «Пропустить» — скрыта на последнем слайде с правилами */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: spacing.md, minHeight: '28px' }}>
        {!isLast && (
          <button
            onClick={onClose}
            style={{
              background: 'none', border: 'none',
              color: colors.textMuted, fontSize: '13px',
              cursor: 'pointer', padding: '4px 8px',
            }}
          >
            Пропустить →
          </button>
        )}
      </div>

      {/* Прогресс-точки */}
      <div style={{ display: 'flex', gap: '6px', justifyContent: 'center', marginBottom: spacing.xl }}>
        {SLIDES.map((_, i) => (
          <div
            key={i}
            style={{
              width: i === idx ? '24px' : '8px',
              height: '4px',
              borderRadius: '2px',
              background: i === idx
                ? colors.fairyGold
                : i < idx ? `${colors.fairyGold}80` : 'rgba(255,255,255,0.15)',
              transition: 'all 0.3s',
            }}
          />
        ))}
      </div>

      {/* Слайд */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        <AnimatePresence mode="wait">
          <motion.div
            key={idx}
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -40 }}
            transition={{ duration: 0.25 }}
            style={{ textAlign: 'center', maxWidth: '440px', margin: '0 auto' }}
          >
            <div style={{ fontSize: '72px', marginBottom: spacing.lg }}>
              {slide.emoji}
            </div>
            <div style={{
              color: colors.fairyGold, fontSize: '24px', fontWeight: 800,
              marginBottom: spacing.md, lineHeight: 1.2,
            }}>
              {slide.title}
            </div>
            <div style={{
              color: colors.textPrimary, fontSize: '15px', lineHeight: 1.6,
              marginBottom: slide.accent ? spacing.lg : 0,
            }}>
              {slide.body}
            </div>
            {slide.accent && (
              <div style={{
                display: 'inline-block',
                padding: `${spacing.sm} ${spacing.md}`,
                background: `${colors.fairyGold}18`,
                border: `1px solid ${colors.fairyGold}55`,
                borderRadius: '10px',
                color: colors.fairyGold,
                fontSize: '13px',
                fontWeight: 600,
              }}>
                {slide.accent}
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Кнопки */}
      <div style={{ display: 'flex', gap: spacing.sm, marginTop: spacing.xl }}>
        {idx > 0 && (
          <button
            onClick={back}
            style={{
              flex: 1, padding: spacing.md,
              background: 'rgba(255,255,255,0.06)',
              border: `1px solid ${colors.cardBorder}`,
              borderRadius: '12px',
              color: colors.textSecondary,
              fontSize: '14px', fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            ← Назад
          </button>
        )}
        <button
          onClick={next}
          style={{
            flex: 2, padding: spacing.md,
            background: colors.fairyGold,
            border: 'none',
            borderRadius: '12px',
            color: colors.nightBlue,
            fontSize: '15px', fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          {isLast ? '📜 Принять правила и начать' : 'Дальше →'}
        </button>
      </div>
    </motion.div>
  )
}
