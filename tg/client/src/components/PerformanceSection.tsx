import { useT } from '@/i18n'
import { colors } from '@/theme'
import { useFxStore } from '@/stores/fxStore'

/**
 * Диагностическая секция в Настройках. На некоторых Android WebView после
 * сворачивания/восстановления Mini App страница начинает мерцать много раз
 * в секунду. Природа неясна (canvas-rAF, CSS-keyframes или position:fixed
 * фон) — даём игроку выключить эффекты по одному и самому найти виновника.
 *
 * Стиль и общая структура — копия других секций в HomePage (sound, theme).
 */
export function PerformanceSection() {
  const t = useT()
  const {
    disableSparkles,
    disableMist,
    disableBgImage,
    disableMusicHandlers,
    setDisableSparkles,
    setDisableMist,
    setDisableBgImage,
    setDisableMusicHandlers,
    setEcoAll,
  } = useFxStore()

  const allOff = disableSparkles && disableMist && disableBgImage && disableMusicHandlers

  const rows: Array<{ key: string; label: string; off: boolean; set: (v: boolean) => void }> = [
    { key: 'music',    label: t.home.settingsPerfMusic,    off: disableMusicHandlers, set: setDisableMusicHandlers },
    { key: 'sparkles', label: t.home.settingsPerfSparkles, off: disableSparkles,      set: setDisableSparkles },
    { key: 'mist',     label: t.home.settingsPerfMist,     off: disableMist,          set: setDisableMist },
    { key: 'bg',       label: t.home.settingsPerfBg,       off: disableBgImage,       set: setDisableBgImage },
  ]

  return (
    <div style={{ marginBottom: '28px' }}>
      <div style={{
        color: colors.textOnDarkSecond,
        fontSize: '12px',
        fontWeight: 600,
        marginBottom: '8px',
        textTransform: 'uppercase',
        letterSpacing: '0.5px',
      }}>
        {t.home.settingsSectionPerf}
      </div>
      <div style={{
        color: colors.textOnDarkMuted,
        fontSize: '11px',
        marginBottom: '12px',
        lineHeight: 1.4,
      }}>
        {t.home.settingsPerfHint}
      </div>

      {/* Кнопка «всё разом» */}
      <button
        onClick={() => setEcoAll(!allOff)}
        style={{
          width: '100%',
          padding: '10px 16px',
          marginBottom: '10px',
          background: allOff ? `${colors.fairyGold}22` : 'rgba(255,255,255,0.05)',
          border: `1px solid ${allOff ? `${colors.fairyGold}66` : 'rgba(255,255,255,0.18)'}`,
          borderRadius: '10px',
          color: allOff ? colors.fairyGold : colors.textOnDark,
          fontSize: '13px',
          fontWeight: 600,
          cursor: 'pointer',
          textAlign: 'left',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <span>{t.home.settingsPerfEcoAll}</span>
        <span style={{ fontSize: '11px', opacity: 0.8 }}>
          {allOff ? t.home.settingsPerfOff : t.home.settingsPerfOn}
        </span>
      </button>

      {/* Индивидуальные переключатели */}
      {rows.map(r => (
        <div
          key={r.key}
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '6px',
            padding: '8px 12px',
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.10)',
            borderRadius: '8px',
          }}
        >
          <span style={{ color: colors.textOnDark, fontSize: '13px' }}>{r.label}</span>
          <button
            onClick={() => r.set(!r.off)}
            style={{
              padding: '4px 12px',
              background: r.off ? 'rgba(255,255,255,0.06)' : `${colors.fairyGold}22`,
              border: `1px solid ${r.off ? 'rgba(255,255,255,0.25)' : `${colors.fairyGold}55`}`,
              borderRadius: '8px',
              color: r.off ? 'rgba(255,255,255,0.70)' : colors.fairyGold,
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            {r.off ? t.home.settingsPerfOff : t.home.settingsPerfOn}
          </button>
        </div>
      ))}
    </div>
  )
}
