import { BuratinoGame } from './BuratinoGame'
import { KoscheiGame } from './KoscheiGame'
import { KolobokGame } from './KolobokGame'
import type { MiniGameDifficulty } from './BuratinoGame'
import { colors, spacing } from '@/theme'

interface MiniGameProps {
  archetype: string
  seed: string
  difficulty: MiniGameDifficulty
  pending: boolean
  onComplete: (errorCount: number) => void
}

// Диспетчер по архетипу. Сейчас реализован BURATINO, остальные показывают заглушку
// с двумя тестовыми кнопками. По мере подключения новых мини-игр строки будут заменяться.
export function MiniGame(props: MiniGameProps) {
  switch (props.archetype) {
    case 'BURATINO':
      return (
        <BuratinoGame
          seed={props.seed}
          difficulty={props.difficulty}
          onComplete={props.onComplete}
        />
      )
    case 'KOSCHEI':
      return (
        <KoscheiGame
          seed={props.seed}
          difficulty={props.difficulty}
          onComplete={props.onComplete}
        />
      )
    case 'KOLOBOK':
      return (
        <KolobokGame
          seed={props.seed}
          difficulty={props.difficulty}
          onComplete={props.onComplete}
        />
      )
    default:
      return (
        <PlaceholderGame
          archetype={props.archetype}
          seed={props.seed}
          pending={props.pending}
          onComplete={props.onComplete}
        />
      )
  }
}

function PlaceholderGame({
  archetype, seed, pending, onComplete,
}: {
  archetype: string
  seed: string
  pending: boolean
  onComplete: (errorCount: number) => void
}) {
  return (
    <div style={{
      flex: 1, padding: spacing.xxl,
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      gap: spacing.lg, maxWidth: '500px', margin: '0 auto', width: '100%', boxSizing: 'border-box',
    }}>
      <div style={{ fontSize: '52px' }}>🪆</div>
      <div style={{ color: colors.fairyGold, fontSize: '20px', fontWeight: 700, textAlign: 'center' }}>
        Здесь будет испытание
      </div>
      <div style={{ color: colors.textMuted, fontSize: '13px', textAlign: 'center', lineHeight: 1.5 }}>
        Архетип: {archetype}<br />
        Мини-игра для этого хозяина появится в следующих этапах.
      </div>
      <div style={{ color: colors.textMuted, fontSize: '10px', opacity: 0.6 }}>
        seed: {seed.slice(0, 12)}…
      </div>
      <div style={{ display: 'flex', gap: spacing.sm, width: '100%' }}>
        <button
          onClick={() => onComplete(2)}
          disabled={pending}
          style={{
            flex: 1,
            padding: spacing.md,
            background: 'rgba(42, 25, 96, 0.5)',
            border: `1px solid ${colors.fairyGold}40`,
            borderRadius: '12px',
            color: colors.fairyGold,
            fontWeight: 600, fontSize: '14px',
            cursor: 'pointer',
            opacity: pending ? 0.6 : 1,
          }}
        >
          Проиграть (тест)
        </button>
        <button
          onClick={() => onComplete(0)}
          disabled={pending}
          style={{
            flex: 1,
            padding: spacing.md,
            background: colors.fairyGold,
            border: 'none',
            borderRadius: '12px',
            color: colors.nightBlue,
            fontWeight: 700, fontSize: '15px',
            cursor: 'pointer',
            opacity: pending ? 0.6 : 1,
          }}
        >
          Победить (тест)
        </button>
      </div>
    </div>
  )
}
