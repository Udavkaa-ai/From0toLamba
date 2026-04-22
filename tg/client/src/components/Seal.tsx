// Процедурная купеческая печать — детерминированная SVG.
// 7 параметров, полностью деривируются из seed-строки.

const SHAPES = [
  'circle', 'square', 'diamond', 'hexagon', 'octagon',
  'triangleUp', 'triangleDown', 'shield',
] as const
type Shape = typeof SHAPES[number]

const ROTATIONS = [0, 15, 30, 45] as const
type Rotation = typeof ROTATIONS[number]

const COLORS = [
  { key: 'gold',    primary: '#D4A017', secondary: '#6B3E00' },
  { key: 'bronze',  primary: '#A0522D', secondary: '#4A1F07' },
  { key: 'crimson', primary: '#8B2E2E', secondary: '#3F1010' },
  { key: 'emerald', primary: '#2F6F47', secondary: '#0F2E1B' },
  { key: 'indigo',  primary: '#3B4F8A', secondary: '#16223F' },
] as const
type SealColor = typeof COLORS[number]

const RING_COUNTS = [0, 1, 2, 3] as const
type RingCount = typeof RING_COUNTS[number]

const BORDER_STYLES = ['solid', 'double', 'teeth'] as const
type BorderStyle = typeof BORDER_STYLES[number]

const DOT_COUNTS = [0, 4, 6, 8, 12] as const
type DotCount = typeof DOT_COUNTS[number]

/** Центральная эмблема — объединение трёх классов: зверь | буква | знак */
const ANIMALS = ['bear', 'wolf', 'deer', 'falcon', 'boar', 'fish'] as const
const LETTERS = ['А', 'Б', 'В', 'К', 'М', 'Р', 'С'] as const
const MOTIFS  = ['anchor', 'key', 'feather', 'horseshoe'] as const

type Animal = typeof ANIMALS[number]
type Letter = typeof LETTERS[number]
type Motif  = typeof MOTIFS[number]

type Emblem =
  | { kind: 'animal'; value: Animal }
  | { kind: 'letter'; value: Letter }
  | { kind: 'motif';  value: Motif  }

const ALL_EMBLEMS: Emblem[] = [
  ...ANIMALS.map(v => ({ kind: 'animal', value: v } as Emblem)),
  ...LETTERS.map(v => ({ kind: 'letter', value: v } as Emblem)),
  ...MOTIFS.map(v  => ({ kind: 'motif',  value: v } as Emblem)),
]

export interface SealParams {
  shape: Shape
  rotation: Rotation
  color: SealColor
  rings: RingCount
  border: BorderStyle
  dots: DotCount
  emblem: Emblem
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

/** Несколько «каналов» из одного seed, чтобы параметры не коррелировали */
function hashChannel(seed: string, channel: string): number {
  return hash(`${seed}::${channel}`)
}

export function generateReferenceSeal(seed: string): SealParams {
  return {
    shape:    pickBy(SHAPES,       hashChannel(seed, 'shape')),
    rotation: pickBy(ROTATIONS,    hashChannel(seed, 'rot')),
    color:    pickBy(COLORS,       hashChannel(seed, 'color')),
    rings:    pickBy(RING_COUNTS,  hashChannel(seed, 'rings')),
    border:   pickBy(BORDER_STYLES, hashChannel(seed, 'border')),
    dots:     pickBy(DOT_COUNTS,   hashChannel(seed, 'dots')),
    emblem:   pickBy(ALL_EMBLEMS,  hashChannel(seed, 'emblem')),
  }
}

// ─── Мутация ──────────────────────────────────────────────────────────────

type MutTarget = 'shape' | 'color' | 'rotation' | 'rings' | 'border' | 'dots' | 'emblemClass' | 'emblemSame'

const MUT_POOLS: Record<CharterDifficulty, MutTarget[]> = {
  EASY:   ['shape', 'color'],
  MEDIUM: ['emblemClass', 'rings', 'rotation'],
  HARD:   ['emblemSame', 'dots', 'border'],
}

/** «Похожие» эмблемы внутри одного класса — для HARD-мутаций */
const SIMILAR_ANIMAL: Record<Animal, Animal> = {
  bear: 'wolf',   wolf: 'bear',
  deer: 'falcon', falcon: 'deer',
  boar: 'bear',   fish: 'falcon',
}
const SIMILAR_LETTER: Record<Letter, Letter> = {
  'А': 'Б', 'Б': 'В', 'В': 'А',
  'К': 'М', 'М': 'К',
  'Р': 'С', 'С': 'Р',
}
const SIMILAR_MOTIF: Record<Motif, Motif> = {
  anchor: 'key',       key: 'anchor',
  feather: 'horseshoe', horseshoe: 'feather',
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
): SealParams {
  const h = hash(`${seed}:cell${index}:mut`)
  const pool = MUT_POOLS[difficulty]
  const target = pool[h % pool.length]
  const out: SealParams = { ...ref }
  const step = (h >>> 4) + 1

  switch (target) {
    case 'shape':
      out.shape = nextInList(SHAPES, ref.shape, step)
      break
    case 'color':
      out.color = nextInList(COLORS, ref.color, step)
      break
    case 'rotation':
      out.rotation = nextInList(ROTATIONS, ref.rotation, step)
      break
    case 'rings':
      out.rings = nextInList(RING_COUNTS, ref.rings, step)
      break
    case 'border':
      out.border = nextInList(BORDER_STYLES, ref.border, step)
      break
    case 'dots':
      out.dots = nextInList(DOT_COUNTS, ref.dots, step)
      break
    case 'emblemClass': {
      // Меняем класс эмблемы (буква→зверь, зверь→знак и т.д.)
      const classes: Array<Emblem['kind']> = ['animal', 'letter', 'motif']
      const currentIdx = classes.indexOf(ref.emblem.kind)
      const nextKind = classes[(currentIdx + 1 + (step % 2)) % 3]
      if (nextKind === 'animal') out.emblem = { kind: 'animal', value: pickBy(ANIMALS, h >>> 7) }
      else if (nextKind === 'letter') out.emblem = { kind: 'letter', value: pickBy(LETTERS, h >>> 7) }
      else out.emblem = { kind: 'motif', value: pickBy(MOTIFS, h >>> 7) }
      break
    }
    case 'emblemSame': {
      // Меняем эмблему в том же классе на похожую
      if (ref.emblem.kind === 'animal') out.emblem = { kind: 'animal', value: SIMILAR_ANIMAL[ref.emblem.value] }
      else if (ref.emblem.kind === 'letter') out.emblem = { kind: 'letter', value: SIMILAR_LETTER[ref.emblem.value] }
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
): SealParams {
  const ref = generateReferenceSeal(refSeed)
  return isForged ? mutateSeal(ref, refSeed, index, difficulty) : ref
}

// ─── SVG-рендер ────────────────────────────────────────────────────────────

interface SealProps {
  params: SealParams
  size?: number
  dim?: boolean
  ring?: 'tp' | 'fp' | 'fn' | null
  selected?: boolean
}

export function Seal({ params, size = 72, dim = false, ring = null, selected = false }: SealProps) {
  const { shape, rotation, color, rings, border, dots, emblem } = params
  const opacity = dim ? 0.35 : 1
  const ringColor = ring === 'tp' ? '#4CAF50' : ring === 'fp' ? '#F44336' : ring === 'fn' ? '#FF9800' : null

  return (
    <svg viewBox="0 0 100 100" width={size} height={size} style={{ opacity, display: 'block' }}>
      {/* Точки-розетка (не поворачиваются — ось симметрии печати) */}
      {renderDots(dots, color)}

      {/* Форма + концентрические кольца + ободок — единая группа, поворачивается */}
      <g transform={`rotate(${rotation} 50 50)`}>
        {renderShape(shape, color, 36)}
        {renderRings(shape, rings, color)}
        {renderBorderStyle(shape, border, color)}
      </g>

      {/* Центральная эмблема — без поворота, чтобы читаемо */}
      {renderEmblem(emblem, color)}

      {/* Оценочная обводка (TP/FP/FN) */}
      {ringColor && (
        <circle cx="50" cy="50" r="48" fill="none" stroke={ringColor} strokeWidth="3" />
      )}
      {/* Выбор игрока */}
      {selected && !ringColor && (
        <circle cx="50" cy="50" r="48" fill="none" stroke="#FFB800" strokeWidth="3" strokeDasharray="4 3" />
      )}
    </svg>
  )
}

// ── Формы ──────────────────────────────────────────────────────────────────

function renderShape(shape: Shape, color: SealColor, r: number) {
  const fill = color.primary
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
    dots.push(<circle key={i} cx={x} cy={y} r="1.8" fill={color.secondary} />)
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
  if (emblem.kind === 'letter') {
    return (
      <text
        x="50" y="51"
        textAnchor="middle" dominantBaseline="central"
        fontSize="34"
        fontFamily="'Times New Roman', serif"
        fontWeight="700"
        fill={fill}
      >
        {emblem.value}
      </text>
    )
  }
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
