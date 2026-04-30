// Звуковой движок — всё синтезируется через Web Audio API, без файлов

export type SoundName = 'tap' | 'invest' | 'day' | 'win' | 'lose' | 'rankup' | 'seal'

const MUTED_KEY = 'sound_muted'
const VOLUME_KEY = 'sound_volume'

let _ctx: AudioContext | null = null

function ctx(): AudioContext {
  if (!_ctx) _ctx = new AudioContext()
  // Браузер может приостановить контекст без жеста — возобновляем
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

// ─── Вспомогательные примитивы ─────────────────────────────────────────────

function gain(c: AudioContext, value: number): GainNode {
  const g = c.createGain()
  g.gain.value = value
  g.connect(c.destination)
  return g
}

function sine(c: AudioContext, freq: number, start: number, dur: number, g: GainNode) {
  const osc = c.createOscillator()
  osc.type = 'sine'
  osc.frequency.value = freq
  osc.connect(g)
  osc.start(start)
  osc.stop(start + dur)
}

function ramp(
  c: AudioContext,
  g: GainNode,
  startVal: number,
  endVal: number,
  startTime: number,
  endTime: number,
) {
  g.gain.setValueAtTime(startVal, startTime)
  g.gain.linearRampToValueAtTime(endVal, endTime)
}

// ─── Звуки ──────────────────────────────────────────────────────────────────

function playTap(c: AudioContext, vol: number) {
  const g = gain(c, vol * 0.35)
  const now = c.currentTime
  ramp(c, g, 0.35 * vol, 0, now, now + 0.08)
  sine(c, 900, now, 0.08, g)
}

function playInvest(c: AudioContext, vol: number) {
  // Звон монеты: высокая нота + быстрый спад
  const g = gain(c, vol * 0.5)
  const now = c.currentTime
  ramp(c, g, 0.5 * vol, 0, now, now + 0.35)
  const osc = c.createOscillator()
  osc.type = 'sine'
  osc.frequency.setValueAtTime(1400, now)
  osc.frequency.linearRampToValueAtTime(1100, now + 0.35)
  osc.connect(g)
  osc.start(now)
  osc.stop(now + 0.35)
}

function playDay(c: AudioContext, vol: number) {
  // Мягкий «свист» перехода: sweep вверх
  const g = gain(c, vol * 0.4)
  const now = c.currentTime
  ramp(c, g, 0, vol * 0.4, now, now + 0.05)
  ramp(c, g, vol * 0.4, 0, now + 0.15, now + 0.35)
  const osc = c.createOscillator()
  osc.type = 'sine'
  osc.frequency.setValueAtTime(400, now)
  osc.frequency.linearRampToValueAtTime(800, now + 0.35)
  osc.connect(g)
  osc.start(now)
  osc.stop(now + 0.35)
}

function playWin(c: AudioContext, vol: number) {
  // Три восходящие ноты: до-ми-соль
  const notes = [523, 659, 784]
  notes.forEach((freq, i) => {
    const t = c.currentTime + i * 0.12
    const g = gain(c, 0)
    ramp(c, g, vol * 0.45, 0, t, t + 0.22)
    sine(c, freq, t, 0.22, g)
  })
}

function playLose(c: AudioContext, vol: number) {
  // Нисходящий тон с небольшим дрожанием
  const g = gain(c, vol * 0.45)
  const now = c.currentTime
  ramp(c, g, vol * 0.45, 0, now, now + 0.45)
  const osc = c.createOscillator()
  osc.type = 'sawtooth'
  osc.frequency.setValueAtTime(350, now)
  osc.frequency.linearRampToValueAtTime(180, now + 0.45)
  const filt = c.createBiquadFilter()
  filt.type = 'lowpass'
  filt.frequency.value = 600
  osc.connect(filt)
  filt.connect(g)
  osc.start(now)
  osc.stop(now + 0.45)
}

function playRankup(c: AudioContext, vol: number) {
  // Мини-фанфара: четыре ноты вверх
  const notes = [523, 659, 784, 1047]
  notes.forEach((freq, i) => {
    const t = c.currentTime + i * 0.13
    const g = gain(c, 0)
    ramp(c, g, vol * 0.5, vol * 0.1, t, t + 0.25)
    ramp(c, g, vol * 0.1, 0, t + 0.25, t + 0.4)
    sine(c, freq, t, 0.4, g)
  })
}

function playSeal(c: AudioContext, vol: number) {
  // Тихий щелчок для выбора печати
  const g = gain(c, vol * 0.25)
  const now = c.currentTime
  ramp(c, g, vol * 0.25, 0, now, now + 0.06)
  sine(c, 600, now, 0.06, g)
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
