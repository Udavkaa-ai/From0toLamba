// Процедурная купеческая печать — детерминированная SVG.
// 6 параметров, полностью деривируются из seed-строки.
// Динамическое вращение клетки добавляется на уровне страницы (CSS-анимация).

import { useRef } from 'react'

const SHAPES = [
  'circle', 'square', 'diamond', 'hexagon', 'octagon',
  'triangleUp', 'triangleDown', 'shield',
] as const
type Shape = typeof SHAPES[number]

// Primary — заметно ярче фона ячейки (#0A0818), чтобы подделка с тонкой мутацией
// оттенка всё ещё читалась. Secondary — тёмный, для контрастных линий и эмблемы поверх primary.
const COLORS = [
  { key: 'gold',    primary: '#E8B833', secondary: '#5A3100' },
  { key: 'bronze',  primary: '#C97A3E', secondary: '#4A2208' },
  { key: 'crimson', primary: '#D14B4B', secondary: '#4D1010' },
  { key: 'emerald', primary: '#4FA577', secondary: '#123322' },
  { key: 'indigo',  primary: '#6275C4', secondary: '#1A2348' },
  { key: 'violet',  primary: '#A855F7', secondary: '#2E1065' },
  { key: 'teal',    primary: '#2DD4BF', secondary: '#0F4440' },
] as const

/** Палитра печати — из COLORS или со сдвинутым тоном (hue shift). */
interface SealColor {
  key: string
  primary: string
  secondary: string
}

const RING_COUNTS = [0, 1, 2, 3] as const
type RingCount = typeof RING_COUNTS[number]

const BORDER_STYLES = ['solid', 'double', 'teeth'] as const
type BorderStyle = typeof BORDER_STYLES[number]

const DOT_COUNTS = [0, 4, 6, 8, 12] as const
type DotCount = typeof DOT_COUNTS[number]

/** Центральная эмблема — зверь или знак */
const ANIMALS = ['bear', 'wolf', 'deer', 'falcon', 'boar', 'fish'] as const
const MOTIFS  = ['anchor', 'key', 'feather', 'horseshoe', 'crown', 'sword', 'flame'] as const

type Animal = typeof ANIMALS[number]
type Motif  = typeof MOTIFS[number]

type Emblem =
  | { kind: 'animal'; value: Animal }
  | { kind: 'motif';  value: Motif  }

const ALL_EMBLEMS: Emblem[] = [
  ...ANIMALS.map(v => ({ kind: 'animal', value: v } as Emblem)),
  ...MOTIFS.map(v  => ({ kind: 'motif',  value: v } as Emblem)),
]

export interface SealParams {
  shape: Shape
  color: SealColor
  rings: RingCount
  border: BorderStyle
  dots: DotCount
  emblem: Emblem
  innerScale: number  // масштаб рисунка внутри ячейки, 1.0 = норма
}

export type CharterDifficulty = 'EASY' | 'MEDIUM' | 'HARD'

// ─── Хэш и детерминированный выбор ─────────────────────────────────────────

function hash(s: string): number {
  let h = 2166136261 >>> 0
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619) >>> 0
  }
  return h >>> 0
}

function pickBy<T>(arr: readonly T[], n: number): T {
  return arr[Math.abs(n) % arr.length]
}

/** Сдвиг тона (HSL hue) на N градусов. Яркость и насыщенность не трогаем —
 *  меняется именно оттенок. Угол подбирается эмпирически под читаемость на OLED. */
function shiftHue(hex: string, degrees: number): string {
  const r = parseInt(hex.slice(1, 3), 16) / 255
  const g = parseInt(hex.slice(3, 5), 16) / 255
  const b = parseInt(hex.slice(5, 7), 16) / 255
  const max = Math.max(r, g, b), min = Math.min(r, g, b)
  const l = (max + min) / 2
  let h = 0, s = 0
  if (max !== min) {
    const d = max - min
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
    if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) * 60
    else if (max === g) h = ((b - r) / d + 2) * 60
    else h = ((r - g) / d + 4) * 60
  }
  h = (h + degrees + 360) % 360

  const c = (1 - Math.abs(2 * l - 1)) * s
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1))
  const m = l - c / 2
  let [r2, g2, b2] = [0, 0, 0]
  if (h < 60)       [r2, g2, b2] = [c, x, 0]
  else if (h < 120) [r2, g2, b2] = [x, c, 0]
  else if (h < 180) [r2, g2, b2] = [0, c, x]
  else if (h < 240) [r2, g2, b2] = [0, x, c]
  else if (h < 300) [r2, g2, b2] = [x, 0, c]
  else              [r2, g2, b2] = [c, 0, x]

  const toHex = (v: number) => Math.round((v + m) * 255).toString(16).padStart(2, '0')
  return '#' + toHex(r2) + toHex(g2) + toHex(b2)
}

/** Несколько «каналов» из одного seed, чтобы параметры не коррелировали */
function hashChannel(seed: string, channel: string): number {
  return hash(`${seed}::${channel}`)
}

export function generateReferenceSeal(seed: string): SealParams {
  return {
    shape:      pickBy(SHAPES,        hashChannel(seed, 'shape')),
    color:      pickBy(COLORS,        hashChannel(seed, 'color')),
    rings:      pickBy(RING_COUNTS,   hashChannel(seed, 'rings')),
    border:     pickBy(BORDER_STYLES, hashChannel(seed, 'border')),
    dots:       pickBy(DOT_COUNTS,    hashChannel(seed, 'dots')),
    emblem:     pickBy(ALL_EMBLEMS,   hashChannel(seed, 'emblem')),
    innerScale: 1.0,
  }
}

// ─── Мутация ──────────────────────────────────────────────────────────────

export type MutTarget =
  | 'shape'      // схожая форма (шестигранник → восьмигранник)
  | 'rings'      // число концентрических колец (1/2/3)
  | 'emblemSame' // визуально похожий силуэт в том же классе
  | 'colorHue'   // сдвиг тона ±20° — только оттенок, без смены цвета
  | 'dots'       // число точек-розетки
  | 'size'       // масштаб печати ±15%

const MUT_POOLS: Record<CharterDifficulty, MutTarget[]> = {
  EASY:   ['shape', 'rings', 'size'],
  MEDIUM: ['emblemSame', 'colorHue', 'rings', 'size'],
  HARD:   ['dots', 'colorHue', 'rings'],
}

// Чем выше чин, тем больше видов мутаций встречается в грамоте.
// На скоморохе — только форма (просто); на купце добавляются размер и точки;
// выше — цвет и кольца (тонкие отличия).
export const RANK_MUT_POOLS: Record<string, MutTarget[]> = {
  NEWBIE:       ['shape'],
  AMBASSADOR:   ['shape', 'size', 'dots'],
  ANALYST:      ['shape', 'size', 'dots', 'colorHue', 'rings', 'emblemSame'],
  SHARK:        ['shape', 'size', 'dots', 'colorHue', 'rings', 'emblemSame'],
  LAMBO_SENSEI: ['shape', 'size', 'dots', 'colorHue', 'rings', 'emblemSame'],
}

/** Визуально схожие формы — переходы между соседними геометриями, без зеркал */
const SIMILAR_SHAPE: Record<Shape, Shape> = {
  circle:      'hexagon',
  square:      'diamond',
  diamond:     'square',
  hexagon:     'octagon',
  octagon:     'hexagon',
  triangleUp:  'shield',      // оба с острой вершиной сверху
  triangleDown: 'diamond',    // оба с острым концом снизу
  shield:      'triangleUp',
}

/** Визуально схожие эмблемы — подбор по силуэту, не по смыслу */
const SIMILAR_ANIMAL: Record<Animal, Animal> = {
  bear:   'boar',    // оба: круглая голова, схожий профиль
  boar:   'bear',
  wolf:   'deer',    // оба: острые выступы вверх (уши / рога)
  deer:   'wolf',
  falcon: 'fish',    // оба: горизонтальный вытянутый силуэт
  fish:   'falcon',
}
const SIMILAR_MOTIF: Record<Motif, Motif> = {
  feather:   'flame',      // оба: вытянутый суживающийся каплевидный силуэт
  flame:     'feather',
  anchor:    'sword',      // оба: вертикальная ось + горизонтальная перекладина
  sword:     'anchor',
  key:       'crown',      // оба: декоративный верх + вертикальное/горизонтальное основание
  crown:     'key',
  horseshoe: 'anchor',     // оба: дугообразный изгиб + симметрия
}

function nextInList<T>(arr: readonly T[], current: T, step: number): T {
  const i = arr.indexOf(current as T)
  const safeStep = ((step % (arr.length - 1)) + (arr.length - 1)) % (arr.length - 1) + 1
  return arr[(i + safeStep) % arr.length]
}

export function mutateSeal(
  ref: SealParams,
  seed: string,
  index: number,
  difficulty: CharterDifficulty,
  rankPool?: MutTarget[],
): SealParams {
  const h = hash(`${seed}:cell${index}:mut`)
  const pool = rankPool ?? MUT_POOLS[difficulty]
  const target = pool[h % pool.length]
  const out: SealParams = { ...ref }
  const step = (h >>> 4) + 1

  switch (target) {
    case 'shape':
      // Схожая форма — без зеркал, без радикальных смен (шестигранник → восьмигранник)
      out.shape = SIMILAR_SHAPE[ref.shape]
      break
    case 'rings':
      out.rings = nextInList(RING_COUNTS, ref.rings, step)
      break
    case 'dots':
      out.dots = DOT_COUNTS[(DOT_COUNTS.indexOf(ref.dots) + 2) % DOT_COUNTS.length]
      break
    case 'colorHue': {
      // Только сдвиг тона ±20° — насыщенность и яркость не меняются
      const direction = (h & 1) === 0 ? 1 : -1
      out.color = {
        key: ref.color.key + (direction > 0 ? '-warm' : '-cool'),
        primary: shiftHue(ref.color.primary, 20 * direction),
        secondary: shiftHue(ref.color.secondary, 20 * direction),
      }
      break
    }
    case 'size': {
      // Крупнее или мельче — противоположно базовому (1.0)
      out.innerScale = ((h >> 3) & 1) === 0 ? 0.85 : 1.15
      break
    }
    case 'emblemSame': {
      // Визуально похожий силуэт в том же классе
      if (ref.emblem.kind === 'animal') out.emblem = { kind: 'animal', value: SIMILAR_ANIMAL[ref.emblem.value] }
      else out.emblem = { kind: 'motif', value: SIMILAR_MOTIF[ref.emblem.value] }
      break
    }
  }
  return out
}

export function sealForCell(
  refSeed: string,
  index: number,
  isForged: boolean,
  difficulty: CharterDifficulty,
  rank?: string,
): SealParams {
  const ref = generateReferenceSeal(refSeed)
  if (!isForged) return ref
  const rankPool = rank ? RANK_MUT_POOLS[rank] : undefined
  return mutateSeal(ref, refSeed, index, difficulty, rankPool)
}

// ─── SVG-рендер ────────────────────────────────────────────────────────────

interface SealProps {
  params: SealParams
  size?: number
  dim?: boolean
}

/** Рисует только саму печать — обводка TP/FP/FN и selected живёт на ячейке-кнопке,
 *  чтобы не перекрывать точки-розетку по периметру.
 *
 *  Визуал: радиальный градиент на основе создаёт эффект тиснёной восковой печати
 *  (светлый блик top-left → тёмная глубина bottom-right). Soft drop-shadow вокруг
 *  даёт ощущение объёма. Внутренний hairline-блик в верхней части — «глянец».
 *  Эмблема со своей мягкой тенью — выглядит выдавленной в основе. */
export function Seal({ params, size = 72, dim = false }: SealProps) {
  const { shape, color, rings, border, dots, emblem, innerScale = 1 } = params
  const opacity = dim ? 0.35 : 1
  const scaleTransform = innerScale !== 1 ? `translate(50 50) scale(${innerScale}) translate(-50 -50)` : undefined

  // Уникальные id градиентов на инстанс — иначе несколько печатей в одном DOM
  // подхватят один и тот же gradient и потеряют свой цвет.
  const gid = useUniqueId()
  const fillId = `seal-fill-${gid}`
  const glossId = `seal-gloss-${gid}`
  const embossId = `seal-emboss-${gid}`

  return (
    <svg
      viewBox="0 0 100 100"
      width={size}
      height={size}
      style={{
        opacity,
        display: 'block',
        // Soft outer glow + drop shadow — подчёркивают, что печать «лежит» на пергаменте
        filter: `drop-shadow(0 1.5px 1.5px rgba(0,0,0,0.55)) drop-shadow(0 0 2.5px ${color.primary}40)`,
      }}
    >
      <defs>
        {/* Радиальный градиент основной заливки — блик top-left, тень bottom-right */}
        <radialGradient id={fillId} cx="35%" cy="30%" r="75%">
          <stop offset="0%"   stopColor={lighten(color.primary, 0.35)} />
          <stop offset="55%"  stopColor={color.primary} />
          <stop offset="100%" stopColor={darken(color.primary, 0.35)} />
        </radialGradient>
        {/* Hairline-блик — тонкая полудуга в верхней части как глянец на стекле */}
        <linearGradient id={glossId} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%"  stopColor="#FFFFFF" stopOpacity="0.35" />
          <stop offset="60%" stopColor="#FFFFFF" stopOpacity="0" />
        </linearGradient>
        {/* Мягкая тень под эмблемой — ощущение тиснения */}
        <filter id={embossId} x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur in="SourceAlpha" stdDeviation="0.6" />
          <feOffset dx="0" dy="0.6" result="shadow" />
          <feComponentTransfer in="shadow" result="shadow2"><feFuncA type="linear" slope="0.55" /></feComponentTransfer>
          <feMerge>
            <feMergeNode in="shadow2" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Точки-розетка всегда на внешнем кольце, не масштабируются */}
      {renderDots(dots, color)}

      {/* Всё тело печати масштабируется от центра при мутации размера */}
      <g transform={scaleTransform}>
        {renderShape(shape, color, 36, `url(#${fillId})`)}
        <g style={{ pointerEvents: 'none' }}>
          {renderGloss(shape, glossId)}
        </g>
        {renderRings(shape, rings, color)}
        {renderBorderStyle(shape, border, color)}
        <g filter={`url(#${embossId})`}>{renderEmblem(emblem, color)}</g>
      </g>
    </svg>
  )
}

// ── Утилиты для рендера ────────────────────────────────────────────────────

let _idCounter = 0
function useUniqueId(): string {
  // Уникальность нужна, чтобы несколько печатей в одном DOM не подхватили
  // один gradient/filter id. Сохраняется на инстанс через useRef.
  const ref = useRef<string | null>(null)
  if (ref.current === null) ref.current = `s${(++_idCounter).toString(36)}`
  return ref.current
}

function clamp01(v: number): number { return Math.max(0, Math.min(1, v)) }

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '')
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]
}
function rgbToHex(r: number, g: number, b: number): string {
  const to = (v: number) => Math.round(clamp01(v / 255) * 255).toString(16).padStart(2, '0')
  return `#${to(r)}${to(g)}${to(b)}`
}
/** Смесь цвета с белым на factor [0..1] — для блика */
function lighten(hex: string, factor: number): string {
  const [r, g, b] = hexToRgb(hex)
  return rgbToHex(r + (255 - r) * factor, g + (255 - g) * factor, b + (255 - b) * factor)
}
/** Смесь цвета с чёрным на factor [0..1] — для тени */
function darken(hex: string, factor: number): string {
  const [r, g, b] = hexToRgb(hex)
  return rgbToHex(r * (1 - factor), g * (1 - factor), b * (1 - factor))
}

/** Полупрозрачный «глянец» — половинка фигуры сверху, чтобы создать стекло-эффект */
function renderGloss(shape: Shape, glossId: string) {
  // Простая полу-эллиптическая накладка по центру верхней части — вписывается
  // в любую форму без необходимости делать clip-path под каждую.
  return (
    <ellipse
      cx="50"
      cy="32"
      rx="22"
      ry="11"
      fill={`url(#${glossId})`}
      opacity="0.7"
    />
  )
}

// ── Формы ──────────────────────────────────────────────────────────────────

function renderShape(shape: Shape, color: SealColor, r: number, customFill?: string) {
  const fill = customFill ?? color.primary
  const stroke = color.secondary
  const common = { fill, stroke, strokeWidth: 2 }
  switch (shape) {
    case 'circle':
      return <circle cx="50" cy="50" r={r} {...common} />
    case 'square': {
      const s = r * 1.7
      return <rect x={50 - s / 2} y={50 - s / 2} width={s} height={s} {...common} />
    }
    case 'diamond':
      return <polygon points={`50,${50 - r} ${50 + r},50 50,${50 + r} ${50 - r},50`} {...common} />
    case 'hexagon':
      return <polygon points={regularPolygonPoints(50, 50, r, 6, -Math.PI / 2)} {...common} />
    case 'octagon':
      return <polygon points={regularPolygonPoints(50, 50, r, 8, -Math.PI / 8)} {...common} />
    case 'triangleUp':
      return <polygon points={regularPolygonPoints(50, 52, r + 2, 3, -Math.PI / 2)} {...common} />
    case 'triangleDown':
      return <polygon points={regularPolygonPoints(50, 48, r + 2, 3, Math.PI / 2)} {...common} />
    case 'shield':
      return (
        <path
          d="M 50 14 L 82 22 L 82 50 Q 82 78 50 88 Q 18 78 18 50 L 18 22 Z"
          {...common}
        />
      )
  }
}

function shapeOutline(shape: Shape, color: SealColor, r: number, strokeWidth = 1) {
  const stroke = color.secondary
  const common = { fill: 'none' as const, stroke, strokeWidth }
  switch (shape) {
    case 'circle':      return <circle cx="50" cy="50" r={r} {...common} />
    case 'square': {
      const s = r * 1.7
      return <rect x={50 - s / 2} y={50 - s / 2} width={s} height={s} {...common} />
    }
    case 'diamond':     return <polygon points={`50,${50 - r} ${50 + r},50 50,${50 + r} ${50 - r},50`} {...common} />
    case 'hexagon':     return <polygon points={regularPolygonPoints(50, 50, r, 6, -Math.PI / 2)} {...common} />
    case 'octagon':     return <polygon points={regularPolygonPoints(50, 50, r, 8, -Math.PI / 8)} {...common} />
    case 'triangleUp':  return <polygon points={regularPolygonPoints(50, 52, r + 2, 3, -Math.PI / 2)} {...common} />
    case 'triangleDown':return <polygon points={regularPolygonPoints(50, 48, r + 2, 3, Math.PI / 2)} {...common} />
    case 'shield':
      return <path d={`M 50 ${50 - r + 2} L ${50 + r - 6} ${50 - r + 10} L ${50 + r - 6} 50 Q ${50 + r - 6} ${50 + r - 2} 50 ${50 + r + 4} Q ${50 - r + 6} ${50 + r - 2} ${50 - r + 6} 50 L ${50 - r + 6} ${50 - r + 10} Z`} {...common} />
  }
}

function renderRings(shape: Shape, count: RingCount, color: SealColor) {
  if (count === 0) return null
  const rings = []
  const baseR = 30
  for (let i = 0; i < count; i++) {
    const r = baseR - i * 4
    if (r > 8) rings.push(<g key={i}>{shapeOutline(shape, color, r, 1)}</g>)
  }
  return <>{rings}</>
}

function renderBorderStyle(shape: Shape, border: BorderStyle, color: SealColor) {
  // Стиль дополняет форму отдельным декоративным ободком (независим от rings)
  const stroke = color.secondary
  if (border === 'solid') return null
  if (border === 'double') {
    return <g opacity="0.8">{shapeOutline(shape, color, 33, 1)}</g>
  }
  // teeth — серия штрихов по окружности
  return renderTeeth(50, 50, 34, 20, stroke)
}

function renderTeeth(cx: number, cy: number, r: number, count: number, stroke: string) {
  const lines = []
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2
    const x1 = cx + Math.cos(a) * r
    const y1 = cy + Math.sin(a) * r
    const x2 = cx + Math.cos(a) * (r - 4)
    const y2 = cy + Math.sin(a) * (r - 4)
    lines.push(<line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke={stroke} strokeWidth="1.2" />)
  }
  return <>{lines}</>
}

function renderDots(n: DotCount, color: SealColor) {
  if (n === 0) return null
  const dots = []
  const r = 44
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 - Math.PI / 2
    const x = 50 + Math.cos(a) * r
    const y = 50 + Math.sin(a) * r
    // Крупнее и ярче — раньше r=1.8 на secondary (тёмный) терялось под
    // вращением. Теперь точки видно, и разница 4↔8 читается.
    dots.push(<circle key={i} cx={x} cy={y} r="3" fill={color.primary} stroke={color.secondary} strokeWidth="0.6" />)
  }
  return <>{dots}</>
}

function regularPolygonPoints(cx: number, cy: number, r: number, n: number, startAngle: number): string {
  const pts = []
  for (let i = 0; i < n; i++) {
    const a = startAngle + (i / n) * Math.PI * 2
    pts.push(`${cx + Math.cos(a) * r},${cy + Math.sin(a) * r}`)
  }
  return pts.join(' ')
}

// ── Эмблемы ───────────────────────────────────────────────────────────────

function renderEmblem(emblem: Emblem, color: SealColor) {
  const fill = color.secondary
  if (emblem.kind === 'motif') return renderMotif(emblem.value, fill)
  return renderAnimal(emblem.value, fill)
}

function renderMotif(m: Motif, fill: string) {
  const stroke = fill
  switch (m) {
    case 'anchor':
      return (
        <g fill="none" stroke={stroke} strokeWidth="3" strokeLinecap="round">
          <circle cx="50" cy="34" r="3" fill={stroke} />
          <line x1="50" y1="37" x2="50" y2="65" />
          <line x1="40" y1="45" x2="60" y2="45" />
          <path d="M 37 60 Q 50 72 63 60" fill="none" />
        </g>
      )
    case 'key':
      return (
        <g fill="none" stroke={stroke} strokeWidth="3" strokeLinecap="round">
          <circle cx="50" cy="36" r="7" fill="none" />
          <line x1="50" y1="43" x2="50" y2="68" />
          <line x1="50" y1="58" x2="56" y2="58" />
          <line x1="50" y1="64" x2="58" y2="64" />
        </g>
      )
    case 'feather':
      return (
        <g>
          <path
            d="M 38 68 Q 40 50 50 36 Q 60 26 66 30 Q 62 40 54 50 Q 46 60 38 68 Z"
            fill={fill}
          />
          <line x1="38" y1="68" x2="32" y2="74" stroke={fill} strokeWidth="2" strokeLinecap="round" />
        </g>
      )
    case 'horseshoe':
      return (
        <g fill="none" stroke={stroke} strokeWidth="4" strokeLinecap="round">
          <path d="M 34 40 Q 34 66 50 66 Q 66 66 66 40" />
          <circle cx="34" cy="42" r="1.5" fill={stroke} />
          <circle cx="66" cy="42" r="1.5" fill={stroke} />
          <circle cx="38" cy="58" r="1.5" fill={stroke} />
          <circle cx="62" cy="58" r="1.5" fill={stroke} />
        </g>
      )
    case 'crown':
      return (
        <g fill={fill}>
          <path d="M 32 64 L 32 48 L 41 58 L 50 34 L 59 58 L 68 48 L 68 64 Z" />
          <rect x="32" y="64" width="36" height="6" rx="2" />
        </g>
      )
    case 'sword':
      return (
        <g fill={fill}>
          <rect x="48" y="24" width="4" height="34" rx="2" />
          <rect x="38" y="54" width="24" height="4" rx="2" />
          <path d="M 47 58 L 50 74 L 53 58 Z" />
        </g>
      )
    case 'flame':
      return (
        <g fill={fill}>
          <path d="M 50 28 Q 62 38 60 50 Q 66 44 62 54 Q 62 68 50 72 Q 38 68 38 54 Q 34 44 40 50 Q 38 38 50 28 Z" />
        </g>
      )
  }
}

/** Монохромные силуэты зверей — простые SVG-пути. */
function renderAnimal(a: Animal, fill: string) {
  switch (a) {
    case 'bear':
      // Круглая голова, две круглых уха, мордочка
      return (
        <g fill={fill}>
          <circle cx="38" cy="36" r="6" />
          <circle cx="62" cy="36" r="6" />
          <circle cx="50" cy="52" r="14" />
          <ellipse cx="50" cy="58" rx="6" ry="5" fill="#000" opacity="0.35" />
          <circle cx="50" cy="55" r="2" fill="#000" opacity="0.55" />
        </g>
      )
    case 'wolf':
      // Угловатая голова, острые уши
      return (
        <g fill={fill}>
          <polygon points="32,40 38,28 44,40" />
          <polygon points="56,40 62,28 68,40" />
          <path d="M 30 45 L 50 38 L 70 45 L 68 62 L 58 70 L 42 70 L 32 62 Z" />
          <path d="M 48 68 L 50 74 L 52 68 Z" fill="#000" opacity="0.4" />
        </g>
      )
    case 'deer':
      // Ветвистые рога + узкая голова
      return (
        <g fill="none" stroke={fill} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M 42 30 L 42 22 M 42 22 L 36 22 M 42 22 L 38 16 M 42 26 L 36 26" />
          <path d="M 58 30 L 58 22 M 58 22 L 64 22 M 58 22 L 62 16 M 58 26 L 64 26" />
          <ellipse cx="50" cy="56" rx="10" ry="16" fill={fill} />
          <circle cx="46" cy="52" r="1.5" fill="#000" />
          <circle cx="54" cy="52" r="1.5" fill="#000" />
        </g>
      )
    case 'falcon':
      // Распростёртые крылья V
      return (
        <g fill={fill}>
          <path d="M 20 50 Q 35 30 50 42 Q 65 30 80 50 Q 65 46 50 52 Q 35 46 20 50 Z" />
          <path d="M 46 48 L 50 70 L 54 48 Z" />
        </g>
      )
    case 'boar':
      // Массивная голова + клыки
      return (
        <g fill={fill}>
          <ellipse cx="50" cy="52" rx="16" ry="12" />
          <path d="M 36 54 L 30 62 L 34 62 Z" />
          <path d="M 64 54 L 70 62 L 66 62 Z" />
          <circle cx="48" cy="50" r="1.5" fill="#000" />
          <circle cx="56" cy="50" r="1.5" fill="#000" />
          <ellipse cx="50" cy="58" rx="5" ry="3" fill="#000" opacity="0.35" />
        </g>
      )
    case 'fish':
      // Простой силуэт рыбы
      return (
        <g fill={fill}>
          <path d="M 20 50 Q 36 32 62 50 Q 36 68 20 50 Z" />
          <polygon points="62,50 78,38 74,50 78,62" />
          <circle cx="32" cy="48" r="1.8" fill="#000" />
        </g>
      )
  }
}
