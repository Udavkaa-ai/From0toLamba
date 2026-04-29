import { motion } from 'framer-motion'
import { colors, spacing } from '@/theme'

// Заметки по версиям — что поменялось. Показываются один раз: клиент
// хранит последнюю увиденную версию в localStorage (см. useWhatsNew).
// Добавляй новую запись сверху при каждом релизе.
export interface ChangelogEntry {
  version: string
  title: string
  items: string[]
}

export const CHANGELOG: ChangelogEntry[] = [
  {
    version: '2.9.10',
    title: 'Живые графики и острее печати',
    items: [
      '📈 На графике дела появился поток вкладчиков — пунктирная синяя линия. Форма графика многое говорит о судьбе дела — умей читать',
      '🎭 Посул АРУ в карточке теперь кое-что говорит о деле — но не всегда то, что хочет сказать хозяин. Обращай внимание',
      '⚔️ В «Купеческой грамоте» новые знаки и новые хитрости — подделка может отличаться формой, размером или тоном. Глаз замылился? Смотри свежее',
      '💰 Доходность по всем делам подросла — самое время вложиться и проверить чутьё',
    ],
  },
  {
    version: '2.9.9',
    title: 'Майская Ярмарка — бета 2.9.9',
    items: [
      '🏆 Анонс первого турнира «Майская Ярмарка» — 1–9 мая, итоги 10 мая в 10:00',
      '🤝 В рейтинге появилась вкладка «Сваты» — кто привёл больше всего купцов',
      '📦 Рейтинг «Дела» теперь считает только дела, в которые реально вложился',
      '🎉 Поздравление за подвиг снова показывается корректно после сброса игры',
      '🔮 Купеческие печати обновлены — больше цветов и знаков для новых испытаний',
    ],
  },
  {
    version: '1.6.0',
    title: 'Поздравления за подвиги и удобный возврат',
    items: [
      '🎉 За каждый новый подвиг — торжественная модалка прямо на главной, а для «зверинца» ещё и справка о породе/личине/судьбе',
      '◀ Системная стрелка «назад» в Mini App возвращает к предыдущему экрану, а не закрывает игру',
      '🔘 Кнопка «Назад» на Летописи, Грамоте и Беседе стала крупной и заметной',
      '📯 Окошко с вестями показывается корректно при первом входе после обновления',
    ],
  },
  {
    version: '1.5.21',
    title: 'Подвиги и вводный рассказ',
    items: [
      '📖 При первом входе — вводный рассказ: пять пород дел, семь личин хозяев, пять судеб',
      '🗂️ В «Успехах» подвиги стали кликабельными — открывают справочник пород, личин и судеб',
      '🔓 Заблокированные подвиги теперь показывают условие получения',
      '⚙️ В настройках появилось «Как играть» — вводный рассказ можно повторить в любой момент',
    ],
  },
]

const LS_KEY = 'lastSeenVersion'

/**
 * Возвращает запись changelog, если клиент её ещё не видел.
 * Новичкам (без завершённого онбординга) — не показываем, у них в
 * приоритете вводный тур.
 */
export function getPendingChangelog(
  currentVersion: string,
  isOnboardingComplete: boolean,
): ChangelogEntry | null {
  if (typeof window === 'undefined') return null
  if (!isOnboardingComplete) return null
  const seen = window.localStorage.getItem(LS_KEY)
  if (seen === currentVersion) return null
  const entry = CHANGELOG.find(e => e.version === currentVersion)
  return entry ?? null
}

export function markChangelogSeen(currentVersion: string) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(LS_KEY, currentVersion)
}

export function WhatsNewOverlay({
  entry, onClose,
}: { entry: ChangelogEntry; onClose: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 260,
        background: 'rgba(6, 4, 18, 0.85)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: spacing.lg,
      }}
    >
      <motion.div
        initial={{ scale: 0.9, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.9, y: 20 }}
        transition={{ type: 'spring', damping: 25, stiffness: 280 }}
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: '420px',
          background: `linear-gradient(145deg, ${colors.enchantedPurple}, ${colors.nightBlue})`,
          border: `1px solid ${colors.fairyGold}55`,
          borderRadius: '16px',
          padding: spacing.xl,
          boxShadow: '0 16px 48px rgba(0,0,0,0.6)',
        }}
      >
        <div style={{ textAlign: 'center', marginBottom: spacing.lg }}>
          <div style={{ fontSize: '48px', marginBottom: '4px' }}>📯</div>
          <div style={{ color: colors.fairyGold, fontSize: '18px', fontWeight: 800 }}>
            Вести с ярмарки
          </div>
          <div style={{ color: colors.textMuted, fontSize: '12px', marginTop: '4px' }}>
            Обновление v{entry.version}
          </div>
        </div>

        <div style={{
          color: colors.fairyGold, fontSize: '15px', fontWeight: 700,
          textAlign: 'center', marginBottom: spacing.md,
        }}>
          {entry.title}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.sm }}>
          {entry.items.map((item, i) => (
            <div
              key={i}
              style={{
                padding: `${spacing.sm} ${spacing.md}`,
                background: 'rgba(255,255,255,0.04)',
                border: `1px solid ${colors.cardBorder}`,
                borderRadius: '10px',
                color: colors.textPrimary,
                fontSize: '13px',
                lineHeight: 1.5,
              }}
            >
              {item}
            </div>
          ))}
        </div>

        <button
          onClick={onClose}
          style={{
            width: '100%', marginTop: spacing.xl,
            padding: spacing.md,
            background: colors.fairyGold,
            border: 'none',
            borderRadius: '12px',
            color: colors.nightBlue,
            fontSize: '14px', fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          К делам →
        </button>
      </motion.div>
    </motion.div>
  )
}
