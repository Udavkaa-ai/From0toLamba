// Звуковой движок — синтез через Web Audio API, без файлов.
// Эстетика: приглушённые щелчки дерева/пергамента, шелест страниц — под антураж сказочной Руси.

export type SoundName = 'tap' | 'invest' | 'day' | 'win' | 'lose' | 'rankup' | 'seal'

const MUTED_KEY = 'sound_muted'
const VOLUME_KEY = 'sound_volume'

let _ctx: AudioContext | null = null

function ctx(): AudioContext {
  if (!_ctx) _ctx = new AudioContext()
  if (_ctx.state === 'suspended') _ctx.resume()
  return _ctx
}

export function isMuted(): boolean {
  return localStorage.getItem(MUTED_KEY) === 'true'
}

export function setMuted(v: boolean): void {
  localStorage.setItem(MUTED_KEY, String(v))
}

export function getVolume(): number {
  const raw = localStorage.getItem(VOLUME_KEY)
  return raw !== null ? Math.max(0, Math.min(1, Number(raw))) : 0.5
}

export function setVolume(v: number): void {
  localStorage.setItem(VOLUME_KEY, String(Math.max(0, Math.min(1, v))))
}

// ─── Примитивы ──────────────────────────────────────────────────────────────

// Белый шум — основа для шелеста пергамента
function noiseBuffer(c: AudioContext, dur: number): AudioBuffer {
  const len = Math.ceil(c.sampleRate * dur)
  const buf = c.createBuffer(1, len, c.sampleRate)
  const data = buf.getChannelData(0)
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1
  return buf
}

function playNoise(
  c: AudioContext,
  dur: number,
  lpFreq: number,   // lowpass — срезаем высокие, оставляем бумажный шорох
  peakGain: number,
  attackRatio = 0.15, // доля от dur на атаку
): void {
  const src = c.createBufferSource()
  src.buffer = noiseBuffer(c, dur)

  const filt = c.createBiquadFilter()
  filt.type = 'lowpass'
  filt.frequency.value = lpFreq
  filt.Q.value = 0.7

  const g = c.createGain()
  const now = c.currentTime
  const attack = now + dur * attackRatio
  const end = now + dur
  g.gain.setValueAtTime(0, now)
  g.gain.linearRampToValueAtTime(peakGain, attack)
  g.gain.linearRampToValueAtTime(0, end)

  src.connect(filt)
  filt.connect(g)
  g.connect(c.destination)
  src.start(now)
  src.stop(end)
}

// Короткий глухой удар (дерево, войлок) — синус на низкой частоте с быстрым спадом
function playThud(
  c: AudioContext,
  freq: number,
  dur: number,
  peakGain: number,
): void {
  const osc = c.createOscillator()
  osc.type = 'sine'

  // Частота чуть падает — как настоящий удар
  const now = c.currentTime
  osc.frequency.setValueAtTime(freq, now)
  osc.frequency.exponentialRampToValueAtTime(freq * 0.6, now + dur)

  const filt = c.createBiquadFilter()
  filt.type = 'lowpass'
  filt.frequency.value = freq * 3
  filt.Q.value = 1

  const g = c.createGain()
  g.gain.setValueAtTime(peakGain, now)
  g.gain.exponentialRampToValueAtTime(0.001, now + dur)

  osc.connect(filt)
  filt.connect(g)
  g.connect(c.destination)
  osc.start(now)
  osc.stop(now + dur)
}

// Тихий колокольчик — синус с медленным затуханием, отфильтрованный
function playBell(
  c: AudioContext,
  freq: number,
  startAt: number,
  dur: number,
  peakGain: number,
): void {
  const osc = c.createOscillator()
  osc.type = 'sine'
  osc.frequency.value = freq

  const filt = c.createBiquadFilter()
  filt.type = 'bandpass'
  filt.frequency.value = freq
  filt.Q.value = 8   // узкая полоса — мягкий, почти деревянный тон

  const g = c.createGain()
  g.gain.setValueAtTime(0, startAt)
  g.gain.linearRampToValueAtTime(peakGain, startAt + 0.01)
  g.gain.exponentialRampToValueAtTime(0.001, startAt + dur)

  osc.connect(filt)
  filt.connect(g)
  g.connect(c.destination)
  osc.start(startAt)
  osc.stop(startAt + dur)
}

// ─── Звуки ──────────────────────────────────────────────────────────────────

// Тихий щелчок деревянной кнопки — короткий удар + чуть шелеста
function playTap(c: AudioContext, vol: number) {
  playThud(c, 180, 0.07, vol * 0.4)
  playNoise(c, 0.06, 400, vol * 0.08)
}

// Монета падает на деревянный стол: два удара (подброс + укладка)
function playInvest(c: AudioContext, vol: number) {
  playThud(c, 260, 0.12, vol * 0.45)
  setTimeout(() => playThud(c, 220, 0.09, vol * 0.25), 90)
}

// Шелест страницы: перелистывание пергамента
function playDay(c: AudioContext, vol: number) {
  playNoise(c, 0.28, 1200, vol * 0.55, 0.08)
  // Лёгкий хлопок в конце — страница легла
  setTimeout(() => playThud(c, 140, 0.1, vol * 0.15), 220)
}

// Удача: мягкий перезвон двух колокольчиков
function playWin(c: AudioContext, vol: number) {
  const now = c.currentTime
  playBell(c, 520, now,        0.5, vol * 0.35)
  playBell(c, 780, now + 0.14, 0.45, vol * 0.28)
}

// Неудача: глухой двойной стук — как захлопнутая книга
function playLose(c: AudioContext, vol: number) {
  playThud(c, 120, 0.18, vol * 0.45)
  setTimeout(() => playThud(c, 100, 0.15, vol * 0.3), 110)
}

// Повышение чина: три колокольчика лесенкой + финальный шелест
function playRankup(c: AudioContext, vol: number) {
  const now = c.currentTime
  playBell(c, 440, now,        0.6, vol * 0.3)
  playBell(c, 550, now + 0.17, 0.55, vol * 0.3)
  playBell(c, 660, now + 0.34, 0.7, vol * 0.35)
  playNoise(c, 0.35, 900, vol * 0.2, 0.4)
}

// Печать на пергамент: глухой мягкий удар, как штамп по воску
function playSeal(c: AudioContext, vol: number) {
  playThud(c, 200, 0.08, vol * 0.3)
  playNoise(c, 0.07, 600, vol * 0.1)
}

// ─── Публичный API ───────────────────────────────────────────────────────────

const SOUNDS: Record<SoundName, (c: AudioContext, vol: number) => void> = {
  tap:    playTap,
  invest: playInvest,
  day:    playDay,
  win:    playWin,
  lose:   playLose,
  rankup: playRankup,
  seal:   playSeal,
}

export function playSound(name: SoundName): void {
  if (isMuted()) return
  try {
    SOUNDS[name](ctx(), getVolume())
  } catch {
    // AudioContext может быть недоступен (SSR, старый браузер) — молча игнорируем
  }
}
