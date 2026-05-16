import { motion } from 'framer-motion'
import { useLangStore, type Lang } from '@/stores/langStore'
import { colors , gradients } from '@/theme'

const OPTIONS: { lang: Lang; flag: string; label: string; sub: string }[] = [
  { lang: 'ru', flag: '🇷🇺', label: 'Русский', sub: 'Сказочная Русь в оригинале' },
  { lang: 'en', flag: '🇬🇧', label: 'English', sub: 'Russian fairy-tale lore in English' },
]

export function LanguagePicker({ onPicked }: { onPicked: () => void }) {
  const { setLang } = useLangStore()

  const pick = (l: Lang) => {
    setLang(l)
    onPicked()
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      style={{
        position: 'fixed', inset: 0, zIndex: 500,
        background: `linear-gradient(160deg, #0a0118 0%, #060412 60%, #0d1735 100%)`,
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        padding: '32px 24px',
      }}
    >
      {/* Декоративные звёздочки */}
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden' }}>
        {['15% 20%','80% 15%','10% 75%','85% 70%','50% 8%','30% 88%'].map((pos, i) => (
          <div key={i} style={{ position: 'absolute', left: pos.split(' ')[0], top: pos.split(' ')[1], color: `${colors.fairyGold}40`, fontSize: i % 2 === 0 ? '16px' : '10px' }}>✦</div>
        ))}
      </div>

      {/* Заголовок */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
        style={{ textAlign: 'center', marginBottom: '40px' }}
      >
        <div style={{ fontSize: '48px', marginBottom: '12px' }}>🏪</div>
        <div style={{ color: colors.fairyGold, fontSize: '22px', fontWeight: 700, marginBottom: '6px' }}>
          Из грязи в князи
        </div>
        <div style={{ color: colors.textOnDarkMuted, fontSize: '13px' }}>
          From Rags to Riches
        </div>
      </motion.div>

      {/* Выбор языка */}
      <div style={{ width: '100%', maxWidth: '320px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {OPTIONS.map(({ lang, flag, label, sub }, i) => (
          <motion.button
            key={lang}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.25 + i * 0.1 }}
            whileTap={{ scale: 0.97 }}
            onClick={() => pick(lang)}
            style={{
              display: 'flex', alignItems: 'center', gap: '16px',
              padding: '18px 20px',
              background: `gradients.modal`,
              border: `1px solid ${colors.fairyGold}40`,
              borderRadius: '16px',
              cursor: 'pointer',
              textAlign: 'left',
              transition: 'border-color 0.2s',
            }}
          >
            <span style={{ fontSize: '32px', lineHeight: 1 }}>{flag}</span>
            <div>
              <div style={{ color: colors.fairyGold, fontSize: '17px', fontWeight: 700 }}>{label}</div>
              <div style={{ color: colors.textOnDarkMuted, fontSize: '12px', marginTop: '2px' }}>{sub}</div>
            </div>
          </motion.button>
        ))}
      </div>
    </motion.div>
  )
}
