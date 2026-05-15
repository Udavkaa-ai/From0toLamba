import { useEffect, useMemo, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { Application, Container, Graphics } from 'pixi.js'
import { rngFromSeed } from './seedRng'
import { colors, spacing } from '@/theme'
import { playSound } from '@/sounds'
import type { MiniGameDifficulty } from './BuratinoGame'

const tg = (window as any).Telegram?.WebApp
const haptic = tg?.HapticFeedback

const REFERENCE_SECONDS = 7
const PLAY_SECONDS = 25
const RECIPE_LENGTH = 5
const FLY_MS = 550        // длительность падения ингредиента в котёл
const SHAKE_MS = 420      // длительность взрыва+тряски при ошибке

interface BabaYagaGameProps {
  seed: string
  difficulty: MiniGameDifficulty
  onComplete: (errorCount: number) => void
  /** Если задано — сразу показываем котёл и финальную сцену (после F5). */
  restoredErrorCount?: number | null
}

// 12 узнаваемых ингредиентов. Из них для каждой партии выбираются RECIPE_LENGTH
// (=5) случайно — так подбор разный каждый раз, как и просил тестировщик.
type Ingredient =
  | 'frog' | 'mushroom' | 'spider' | 'skull' | 'bat'
  | 'eye' | 'snake' | 'bone' | 'pumpkin'
  | 'acorn' | 'bottle' | 'worm'
const ALL_INGREDIENTS: Ingredient[] = [
  'frog', 'mushroom', 'spider', 'skull', 'bat',
  'eye', 'snake', 'bone', 'pumpkin',
  'acorn', 'bottle', 'worm',
]

// ── Процедурное рисование ингредиентов (2D Pixi, без 3D) ──────────────────

// Лягушка — крупная круглая голова, глаза-«шарики» сверху, рот-улыбка
function drawFrog(g: Graphics, size: number) {
  const green = 0x4A8A3E
  const greenD = 0x2A5022
  // Тело-голова
  g.ellipse(0, size * 0.1, size * 0.55, size * 0.42).fill(green).stroke({ width: 2.5, color: greenD })
  // Глаза-шарики
  g.circle(-size * 0.32, -size * 0.22, size * 0.2).fill(green).stroke({ width: 2.5, color: greenD })
  g.circle(size * 0.32, -size * 0.22, size * 0.2).fill(green).stroke({ width: 2.5, color: greenD })
  // Белок глаз
  g.circle(-size * 0.32, -size * 0.22, size * 0.13).fill(0xFFFFFF)
  g.circle(size * 0.32, -size * 0.22, size * 0.13).fill(0xFFFFFF)
  // Зрачки
  g.circle(-size * 0.32, -size * 0.19, size * 0.07).fill(0x0D1735)
  g.circle(size * 0.32, -size * 0.19, size * 0.07).fill(0x0D1735)
  // Рот-улыбка
  g.arc(0, size * 0.05, size * 0.28, 0.1 * Math.PI, 0.9 * Math.PI).stroke({ width: 3, color: greenD })
  // Ноздри
  g.circle(-size * 0.08, -size * 0.05, size * 0.025).fill(greenD)
  g.circle(size * 0.08, -size * 0.05, size * 0.025).fill(greenD)
}

// Мухомор — красная шляпка с белыми точками + белая ножка с юбочкой
function drawMushroom(g: Graphics, size: number) {
  // Ножка
  g.roundRect(-size * 0.16, size * 0.05, size * 0.32, size * 0.5, 4).fill(0xF8F2E0).stroke({ width: 2, color: 0x8C6200 })
  // Юбочка
  g.ellipse(0, size * 0.15, size * 0.22, size * 0.06).fill(0xE0CC9A).stroke({ width: 1.5, color: 0x8C6200 })
  // Шляпка (купол)
  const cap: number[] = []
  const segments = 20
  for (let i = 0; i <= segments; i++) {
    const t = i / segments
    const angle = Math.PI * (1 - t)
    const x = Math.cos(angle) * size * 0.55
    const y = -size * 0.05 - Math.sin(angle) * size * 0.32
    cap.push(x, y)
  }
  cap.push(size * 0.55, size * 0.02)
  cap.push(-size * 0.55, size * 0.02)
  g.poly(cap).fill(0xC03030).stroke({ width: 2, color: 0x5A0808 })
  // Белые точки на шляпке
  g.circle(-size * 0.25, -size * 0.18, size * 0.07).fill(0xFFFAEC)
  g.circle(size * 0.15, -size * 0.22, size * 0.08).fill(0xFFFAEC)
  g.circle(size * 0.32, -size * 0.05, size * 0.06).fill(0xFFFAEC)
  g.circle(-size * 0.05, -size * 0.1, size * 0.05).fill(0xFFFAEC)
}

// Череп — крупный с глазницами и зубами
function drawSkull(g: Graphics, size: number) {
  // Купол
  g.circle(0, -size * 0.05, size * 0.45).fill(0xEDE3D0).stroke({ width: 2.5, color: 0x6F5A30 })
  // Глазницы
  g.circle(-size * 0.17, -size * 0.1, size * 0.13).fill(0x0D0510)
  g.circle(size * 0.17, -size * 0.1, size * 0.13).fill(0x0D0510)
  // Огонёк в глазах (для атмосферы)
  g.circle(-size * 0.17, -size * 0.1, size * 0.04).fill(0xFF6020)
  g.circle(size * 0.17, -size * 0.1, size * 0.04).fill(0xFF6020)
  // Нос
  g.poly([0, size * 0.0, -size * 0.06, size * 0.15, 0, size * 0.12, size * 0.06, size * 0.15]).fill(0x0D0510)
  // Челюсть
  g.roundRect(-size * 0.28, size * 0.22, size * 0.56, size * 0.2, 3).fill(0xEDE3D0).stroke({ width: 2, color: 0x6F5A30 })
  for (let i = 0; i < 5; i++) {
    g.rect(-size * 0.24 + i * size * 0.1, size * 0.22, size * 0.05, size * 0.13).fill(0x6F5A30)
  }
}

// Паук — круглое тело, голова поменьше, 8 ног, красные глаза
function drawSpider(g: Graphics, size: number) {
  const dark = 0x1A1024
  // 8 ног, по 4 с каждой стороны
  for (let i = 0; i < 4; i++) {
    const ly = -size * 0.12 + i * size * 0.1
    g.moveTo(-size * 0.2, ly)
      .quadraticCurveTo(-size * 0.45, ly - size * 0.05, -size * 0.55, ly + size * 0.18)
      .stroke({ width: 2.5, color: dark })
    g.moveTo(size * 0.2, ly)
      .quadraticCurveTo(size * 0.45, ly - size * 0.05, size * 0.55, ly + size * 0.18)
      .stroke({ width: 2.5, color: dark })
  }
  // Тело
  g.ellipse(0, size * 0.1, size * 0.3, size * 0.32).fill(dark).stroke({ width: 2.5, color: 0x000000 })
  // Голова
  g.circle(0, -size * 0.2, size * 0.2).fill(dark).stroke({ width: 2.5, color: 0x000000 })
  // Красные глаза
  g.circle(-size * 0.08, -size * 0.23, size * 0.045).fill(0xFF4040)
  g.circle(size * 0.08, -size * 0.23, size * 0.045).fill(0xFF4040)
  g.circle(-size * 0.05, -size * 0.15, size * 0.03).fill(0xFF4040)
  g.circle(size * 0.05, -size * 0.15, size * 0.03).fill(0xFF4040)
  // Паутинка-нить
  g.moveTo(0, -size * 0.4).lineTo(0, -size * 0.75).stroke({ width: 1, color: 0xCCCCDD })
}

// Летучая мышь — силуэт с крыльями и ушками
function drawBat(g: Graphics, size: number) {
  const dark = 0x3A2A50
  const darkD = 0x1A1024
  // Уши
  g.poly([-size * 0.16, -size * 0.25, -size * 0.22, -size * 0.55, -size * 0.08, -size * 0.32]).fill(dark).stroke({ width: 2, color: darkD })
  g.poly([size * 0.16, -size * 0.25, size * 0.22, -size * 0.55, size * 0.08, -size * 0.32]).fill(dark).stroke({ width: 2, color: darkD })
  // Голова
  g.circle(0, -size * 0.2, size * 0.2).fill(dark).stroke({ width: 2, color: darkD })
  // Глаза
  g.circle(-size * 0.08, -size * 0.2, size * 0.04).fill(0xFFCB45)
  g.circle(size * 0.08, -size * 0.2, size * 0.04).fill(0xFFCB45)
  g.circle(-size * 0.08, -size * 0.2, size * 0.02).fill(0x000000)
  g.circle(size * 0.08, -size * 0.2, size * 0.02).fill(0x000000)
  // Клыки
  g.poly([-size * 0.04, -size * 0.08, -size * 0.06, -size * 0.02, -size * 0.02, -size * 0.04]).fill(0xFFFAEC)
  g.poly([size * 0.04, -size * 0.08, size * 0.06, -size * 0.02, size * 0.02, -size * 0.04]).fill(0xFFFAEC)
  // Тело
  g.ellipse(0, size * 0.05, size * 0.15, size * 0.18).fill(dark).stroke({ width: 2, color: darkD })
  // Крылья — изогнутые
  g.moveTo(-size * 0.12, -size * 0.05)
    .quadraticCurveTo(-size * 0.45, -size * 0.15, -size * 0.6, size * 0.1)
    .quadraticCurveTo(-size * 0.55, size * 0.2, -size * 0.4, size * 0.18)
    .quadraticCurveTo(-size * 0.3, size * 0.05, -size * 0.12, size * 0.18)
    .closePath().fill(dark).stroke({ width: 2, color: darkD })
  g.moveTo(size * 0.12, -size * 0.05)
    .quadraticCurveTo(size * 0.45, -size * 0.15, size * 0.6, size * 0.1)
    .quadraticCurveTo(size * 0.55, size * 0.2, size * 0.4, size * 0.18)
    .quadraticCurveTo(size * 0.3, size * 0.05, size * 0.12, size * 0.18)
    .closePath().fill(dark).stroke({ width: 2, color: darkD })
}

// Глаз — огромное глазное яблоко с цветной радужкой
function drawEye(g: Graphics, size: number) {
  // Контур века
  g.ellipse(0, 0, size * 0.55, size * 0.4).fill(0xF5E4C7).stroke({ width: 2.5, color: 0x6F5A30 })
  // Сосуды (тонкие линии)
  g.moveTo(-size * 0.45, -size * 0.1).quadraticCurveTo(-size * 0.35, size * 0.05, -size * 0.25, size * 0.1).stroke({ width: 1, color: 0xC04040, alpha: 0.55 })
  g.moveTo(size * 0.45, size * 0.05).quadraticCurveTo(size * 0.32, size * 0.0, size * 0.25, -size * 0.05).stroke({ width: 1, color: 0xC04040, alpha: 0.55 })
  // Радужка
  g.circle(0, 0, size * 0.25).fill(0x2A8060).stroke({ width: 2, color: 0x103820 })
  g.circle(0, 0, size * 0.18).fill(0x4FD89C)
  // Зрачок
  g.circle(0, 0, size * 0.1).fill(0x000000)
  // Блик
  g.circle(-size * 0.05, -size * 0.05, size * 0.04).fill(0xFFFFFF)
}

// Змея — свернувшаяся клубком, с узором и языком
function drawSnake(g: Graphics, size: number) {
  const dark = 0x2A5022
  const lite = 0x6BA040
  // Большая спираль — внешний виток
  g.ellipse(0, size * 0.05, size * 0.5, size * 0.4).fill(lite).stroke({ width: 2.5, color: dark })
  // Внутренний виток
  g.ellipse(size * 0.05, size * 0.05, size * 0.25, size * 0.22).fill(dark)
  g.ellipse(size * 0.05, size * 0.05, size * 0.2, size * 0.18).fill(lite)
  // Полоски-узор
  for (let i = 0; i < 4; i++) {
    const angle = (i / 4) * Math.PI * 2
    const cx = Math.cos(angle) * size * 0.38
    const cy = Math.sin(angle) * size * 0.32 + size * 0.05
    g.ellipse(cx, cy, size * 0.05, size * 0.08).fill(dark)
  }
  // Голова — справа сверху
  g.ellipse(size * 0.35, -size * 0.3, size * 0.16, size * 0.12).fill(lite).stroke({ width: 2, color: dark })
  // Глаза
  g.circle(size * 0.3, -size * 0.33, size * 0.03).fill(0xFFCB45)
  g.circle(size * 0.4, -size * 0.32, size * 0.03).fill(0xFFCB45)
  // Раздвоенный язык
  g.moveTo(size * 0.4, -size * 0.22).lineTo(size * 0.5, -size * 0.18).stroke({ width: 1.5, color: 0xC04040 })
  g.moveTo(size * 0.5, -size * 0.18).lineTo(size * 0.55, -size * 0.22).stroke({ width: 1.5, color: 0xC04040 })
  g.moveTo(size * 0.5, -size * 0.18).lineTo(size * 0.55, -size * 0.13).stroke({ width: 1.5, color: 0xC04040 })
}

// Косточка — классическая собачья кость с двумя «шариками» на концах
function drawBone(g: Graphics, size: number) {
  const lite = 0xF8F2E0
  const sh = 0xC0B080
  // Левый конец
  g.circle(-size * 0.35, -size * 0.25, size * 0.16).fill(lite).stroke({ width: 2, color: sh })
  g.circle(-size * 0.35, size * 0.25, size * 0.16).fill(lite).stroke({ width: 2, color: sh })
  // Правый конец
  g.circle(size * 0.35, -size * 0.25, size * 0.16).fill(lite).stroke({ width: 2, color: sh })
  g.circle(size * 0.35, size * 0.25, size * 0.16).fill(lite).stroke({ width: 2, color: sh })
  // Средняя часть (поверх соединяющая)
  g.rect(-size * 0.35, -size * 0.08, size * 0.7, size * 0.16).fill(lite).stroke({ width: 2, color: sh })
  // Тень — лёгкая линия посередине
  g.moveTo(-size * 0.3, size * 0.0).lineTo(size * 0.3, size * 0.0).stroke({ width: 1, color: sh, alpha: 0.5 })
}

// Тыква — оранжевая с рёбрами и зелёным стеблем
function drawPumpkin(g: Graphics, size: number) {
  const orange = 0xE9842B
  const orangeD = 0x8C4E10
  // Стебель
  g.rect(-size * 0.05, -size * 0.55, size * 0.1, size * 0.15).fill(0x4A7020).stroke({ width: 1.5, color: 0x2A4010 })
  // Листик
  g.poly([size * 0.05, -size * 0.5, size * 0.2, -size * 0.55, size * 0.1, -size * 0.42]).fill(0x6BA040).stroke({ width: 1, color: 0x2A4010 })
  // Тыква — несколько эллипсов для эффекта рёбер
  g.ellipse(0, size * 0.05, size * 0.52, size * 0.4).fill(orange).stroke({ width: 2, color: orangeD })
  g.ellipse(-size * 0.28, size * 0.05, size * 0.22, size * 0.38).fill(orange).stroke({ width: 1.5, color: orangeD, alpha: 0.7 })
  g.ellipse(size * 0.28, size * 0.05, size * 0.22, size * 0.38).fill(orange).stroke({ width: 1.5, color: orangeD, alpha: 0.7 })
  g.ellipse(0, size * 0.05, size * 0.16, size * 0.4).fill(orange).stroke({ width: 1.5, color: orangeD, alpha: 0.7 })
  // Вертикальные рёбра-линии
  g.moveTo(-size * 0.22, -size * 0.25).lineTo(-size * 0.22, size * 0.32).stroke({ width: 1.5, color: orangeD })
  g.moveTo(size * 0.22, -size * 0.25).lineTo(size * 0.22, size * 0.32).stroke({ width: 1.5, color: orangeD })
}

// Жёлудь — коричневый плод с штрихованной шляпкой
function drawAcorn(g: Graphics, size: number) {
  // Плод (овал)
  g.ellipse(0, size * 0.1, size * 0.3, size * 0.4).fill(0xC9941A).stroke({ width: 2, color: 0x6A4810 })
  // Блик на плоде
  g.ellipse(-size * 0.1, size * 0.0, size * 0.08, size * 0.18).fill(0xE6B040)
  // Шапка-крышечка
  g.ellipse(0, -size * 0.2, size * 0.34, size * 0.18).fill(0x6A4810).stroke({ width: 2, color: 0x3A2810 })
  // Узор «чешуек» на шапке
  for (let i = 0; i < 4; i++) {
    const x = -size * 0.18 + i * size * 0.12
    g.circle(x, -size * 0.2, size * 0.04).fill(0x3A2810)
  }
  // Хвостик
  g.rect(-size * 0.025, -size * 0.42, size * 0.05, size * 0.08).fill(0x3A2810)
  g.circle(0, -size * 0.42, size * 0.05).fill(0x3A2810)
}

// Склянка-зелье — стеклянная бутылочка с пробкой и светящейся жидкостью
function drawBottle(g: Graphics, size: number) {
  // Пробка
  g.rect(-size * 0.1, -size * 0.5, size * 0.2, size * 0.12).fill(0x6A4810).stroke({ width: 1.5, color: 0x3A2810 })
  // Горлышко
  g.rect(-size * 0.08, -size * 0.4, size * 0.16, size * 0.12).fill({ color: 0xCCDDEE, alpha: 0.5 }).stroke({ width: 2, color: 0x4A6A90 })
  // Тело бутылки (шарообразное)
  g.circle(0, size * 0.1, size * 0.32).fill({ color: 0xCCDDEE, alpha: 0.4 }).stroke({ width: 2, color: 0x4A6A90 })
  // Жидкость внутри (зеленоватая, светится)
  g.circle(0, size * 0.15, size * 0.25).fill({ color: 0x6BA040, alpha: 0.85 })
  // Пузырьки в жидкости
  g.circle(-size * 0.1, size * 0.1, size * 0.04).fill({ color: 0xFFFAEC, alpha: 0.7 })
  g.circle(size * 0.05, size * 0.2, size * 0.03).fill({ color: 0xFFFAEC, alpha: 0.7 })
  g.circle(-size * 0.05, size * 0.25, size * 0.025).fill({ color: 0xFFFAEC, alpha: 0.7 })
  // Блик-полоска (стекло)
  g.ellipse(-size * 0.15, size * 0.05, size * 0.04, size * 0.15).fill({ color: 0xFFFFFF, alpha: 0.5 })
}

// Червяк — розовый зигзагообразный, с глазками
function drawWorm(g: Graphics, size: number) {
  const pink = 0xE89098
  const pinkD = 0xA04060
  // Тело — последовательность кружочков по зигзагу
  const segs = 7
  const points: Array<[number, number]> = []
  for (let i = 0; i < segs; i++) {
    const t = i / (segs - 1)
    const x = -size * 0.4 + t * size * 0.8
    const y = Math.sin(t * Math.PI * 2.5) * size * 0.18
    points.push([x, y])
  }
  // Соединяющая толстая линия
  for (let i = 0; i < points.length - 1; i++) {
    g.moveTo(points[i][0], points[i][1]).lineTo(points[i + 1][0], points[i + 1][1])
      .stroke({ width: size * 0.22, color: pink, alignment: 0.5 })
  }
  for (const [x, y] of points) {
    g.circle(x, y, size * 0.13).fill(pink).stroke({ width: 1.5, color: pinkD })
  }
  // Голова (последний кружок крупнее)
  const head = points[points.length - 1]
  g.circle(head[0], head[1], size * 0.16).fill(pink).stroke({ width: 2, color: pinkD })
  g.circle(head[0] - size * 0.05, head[1] - size * 0.04, size * 0.025).fill(0x000000)
  g.circle(head[0] + size * 0.04, head[1] - size * 0.04, size * 0.025).fill(0x000000)
}

const DRAWERS: Record<Ingredient, (g: Graphics, size: number) => void> = {
  frog: drawFrog,
  mushroom: drawMushroom,
  spider: drawSpider,
  skull: drawSkull,
  bat: drawBat,
  eye: drawEye,
  snake: drawSnake,
  bone: drawBone,
  pumpkin: drawPumpkin,
  acorn: drawAcorn,
  bottle: drawBottle,
  worm: drawWorm,
}

/** Рисуем ингредиент без рамки и фона — только сам предмет. Состояние
 *  (правильно/неправильно/в покое) передаётся анимациями (полёт, тряска,
 *  взрыв, пузыри), а не цветом рамки. */
function drawIngredientCard(g: Graphics, ing: Ingredient, w: number, h: number, _state: 'normal' | 'correct' | 'wrong' | 'consumed') {
  DRAWERS[ing](g, Math.min(w, h) * 0.46)
}

/** Большой котёл — рисуем процедурно через Pixi.Graphics: высокий, с глубоким
 *  телом, ободком, ручками-кольцами и ножками. Координаты в системе котла:
 *  y=0 — верхний край отверстия, h ≈ полная высота от ободка до низа ножек. */
function drawCauldron(g: Graphics, w: number, h: number) {
  const bodyColor = 0x2A1A20
  const bodyShade = 0x1A1018
  const rimColor = 0x6B4A28
  // Бочкообразное тело: используем безье, чтобы было реально объёмное.
  // y=0 на верху ободка, y=h*0.9 у нижней округлости.
  // Левая стенка → дно → правая стенка
  g.moveTo(-w * 0.48, h * 0.05)
    .bezierCurveTo(-w * 0.55, h * 0.45,  -w * 0.45, h * 0.85,  -w * 0.3, h * 0.88)
    .lineTo(w * 0.3, h * 0.88)
    .bezierCurveTo(w * 0.45, h * 0.85,  w * 0.55, h * 0.45,  w * 0.48, h * 0.05)
    .closePath()
    .fill(bodyColor)
    .stroke({ width: 3, color: rimColor })
  // Затенение справа
  g.moveTo(w * 0.2, h * 0.1)
    .bezierCurveTo(w * 0.42, h * 0.45,  w * 0.36, h * 0.78,  w * 0.18, h * 0.85)
    .lineTo(w * 0.2, h * 0.1)
    .closePath()
    .fill({ color: bodyShade, alpha: 0.6 })
  // Ободок-эллипс наверху (видимая овальная грань отверстия)
  g.ellipse(0, h * 0.02, w * 0.48, h * 0.1).fill(0x4A2A20).stroke({ width: 3, color: rimColor })
  // Тёмное жерло котла внутри
  g.ellipse(0, h * 0.03, w * 0.43, h * 0.085).fill(0x150810)
  // Бурлящая жидкость
  g.ellipse(0, h * 0.03, w * 0.4, h * 0.07).fill({ color: 0x6A3030, alpha: 0.7 })
  g.ellipse(-w * 0.1, h * 0.01, w * 0.08, h * 0.025).fill({ color: 0xC0608A, alpha: 0.8 })
  g.ellipse(w * 0.15, h * 0.0, w * 0.06, h * 0.02).fill({ color: 0xC0608A, alpha: 0.8 })
  // Кольца-ручки по бокам (на уровне ободка)
  g.ellipse(-w * 0.5, h * 0.08, w * 0.07, h * 0.035)
    .fill({ color: 0, alpha: 0 })
    .stroke({ width: 4, color: rimColor })
  g.ellipse(w * 0.5, h * 0.08, w * 0.07, h * 0.035)
    .fill({ color: 0, alpha: 0 })
    .stroke({ width: 4, color: rimColor })
  // Ножки — три коротких куба, чтобы выглядели «приземистыми»
  g.rect(-w * 0.32, h * 0.84, w * 0.1, h * 0.13).fill(rimColor).stroke({ width: 1.5, color: bodyShade })
  g.rect(-w * 0.05, h * 0.86, w * 0.1, h * 0.12).fill(rimColor).stroke({ width: 1.5, color: bodyShade })
  g.rect(w * 0.22, h * 0.84, w * 0.1, h * 0.13).fill(rimColor).stroke({ width: 1.5, color: bodyShade })
}

/** Раскладка котла и слотов из размера канваса. Используется и в Pixi-рендере,
 *  и в React DOM-overlay для хит-зон. Координаты в CSS-пикселях, origin (0,0) —
 *  верхний левый угол канваса; для слотов x,y — центр квадрата. */
function computeLayout(W: number, H: number) {
  const cauldronW = Math.min(W * 0.62, 280)
  const cauldronH = cauldronW * 0.85
  const cauldronCX = W / 2
  const cauldronTopY = H - cauldronH - 12
  const cauldronMouthY = cauldronTopY + cauldronH * 0.03

  const slotsAreaTop = 12
  const slotsAreaBottom = cauldronTopY - 12
  const slotsAreaH = Math.max(120, slotsAreaBottom - slotsAreaTop)
  const rowGap = 10
  const colGap = 10
  const sideMargin = 10
  const row1Count = 3
  const row2Count = 2
  const maxSlotByH = (slotsAreaH - rowGap) / 2
  // Верхний ряд из 3 слотов + 2 промежутка — лимитирующий по ширине
  const maxSlotByW = (W - sideMargin * 2 - colGap * (row1Count - 1)) / row1Count
  const slotW = Math.max(56, Math.min(maxSlotByH, maxSlotByW, 130))
  const slotH = slotW
  const row1Y = slotsAreaTop + slotH / 2 + 4
  const row2Y = row1Y + slotH + rowGap
  const row1TotalW = row1Count * slotW + (row1Count - 1) * colGap
  const row2TotalW = row2Count * slotW + (row2Count - 1) * colGap
  const row1StartX = (W - row1TotalW) / 2 + slotW / 2
  const row2StartX = (W - row2TotalW) / 2 + slotW / 2
  const positions: Array<{ x: number; y: number }> = []
  for (let i = 0; i < row1Count; i++) {
    positions.push({ x: row1StartX + i * (slotW + colGap), y: row1Y })
  }
  for (let i = 0; i < row2Count; i++) {
    positions.push({ x: row2StartX + i * (slotW + colGap), y: row2Y })
  }
  return {
    cauldronW, cauldronH, cauldronCX, cauldronTopY, cauldronMouthY,
    slotW, slotH, positions,
  }
}

function shuffle<T>(arr: T[], rng: () => number): T[] {
  const out = arr.slice()
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

// === Главный компонент ====================================================

interface SlotAnim {
  /** Состояние слота: idle (в покое) / flying (летит в котёл) /
   *  shake (взрыв при ошибке) / reappearing (всплывает на новом месте) */
  state: 'idle' | 'flying' | 'shake' | 'reappearing' | 'consumed'
  /** Время начала текущего состояния в performance.now() мс */
  startedAt: number
  /** Куда лететь (центр котла) — заполняется в момент перехода в flying */
  targetX: number
  targetY: number
  /** Home-позиция в текущей раскладке */
  homeX: number
  homeY: number
}

interface SlotState {
  ingredient: Ingredient
  anim: SlotAnim
}

interface Bubble {
  startedAt: number
  durationMs: number
  x0: number
  y0: number
  driftX: number
  radius: number
}

interface ExplosionParticle {
  startedAt: number
  durationMs: number
  x: number
  y: number
  vx: number
  vy: number
}

export function BabaYagaGame({ seed, onComplete, restoredErrorCount }: BabaYagaGameProps) {
  const isFrozen = restoredErrorCount !== null && restoredErrorCount !== undefined
  const refMount = useRef<HTMLDivElement>(null)
  const refApp = useRef<Application | null>(null)
  const doneRef = useRef(isFrozen)
  const rngRef = useRef(rngFromSeed(seed))
  const errorsRef = useRef(0)
  const collectedRef = useRef(0)
  const stepRef = useRef(0)
  const onCompleteRef = useRef(onComplete)
  useEffect(() => { onCompleteRef.current = onComplete }, [onComplete])

  // Recipe — 7 уникальных ингредиентов из 8 в случайном порядке
  const recipe = useMemo<Ingredient[]>(() => {
    const pool = shuffle(ALL_INGREDIENTS, rngRef.current).slice(0, RECIPE_LENGTH)
    return shuffle(pool, rngRef.current)
  }, [])

  const [phase, setPhase] = useState<'reference' | 'play'>(isFrozen ? 'play' : 'reference')
  const [refCountdown, setRefCountdown] = useState(REFERENCE_SECONDS)
  const [playCountdown, setPlayCountdown] = useState(PLAY_SECONDS)
  const [collected, setCollected] = useState(0)
  const [, forceRerender] = useState(0)

  // Размеры канваса. Мониторим через ResizeObserver и используем для
  // расчёта раскладки в DOM-overlay (хит-зоны слотов) и в Pixi-рендере.
  const [canvasDims, setCanvasDims] = useState<{ w: number; h: number } | null>(null)

  // Слоты — текущая раскладка 7 ингредиентов
  const slotsRef = useRef<SlotState[]>([])
  const bubblesRef = useRef<Bubble[]>([])
  const explosionsRef = useRef<ExplosionParticle[]>([])

  // Инициализация: первая раскладка = recipe (на reference визуально
  // показывает порядок «слева направо, сверху вниз»)
  if (slotsRef.current.length === 0) {
    slotsRef.current = recipe.map(ing => ({
      ingredient: ing,
      anim: { state: 'idle' as const, startedAt: 0, targetX: 0, targetY: 0, homeX: 0, homeY: 0 },
    }))
  }

  /** errorCount = неправильные клики + несобранные ингредиенты.
   *  Стандартная лесенка по ошибкам: 0 = идеально, 1 = победа, ≥2 = провал. */
  const complete = () => {
    if (doneRef.current) return
    doneRef.current = true
    const missing = Math.max(0, RECIPE_LENGTH - collectedRef.current)
    const ec = errorsRef.current + missing
    haptic?.notificationOccurred(ec === 0 ? 'success' : ec === 1 ? 'warning' : 'error')
    playSound(ec <= 1 ? 'win' : 'lose')
    onCompleteRef.current(ec)
    // Финальная сцена: оставшиеся слоты по одному падают в котёл с задержкой
    triggerDrain()
  }

  // Финальная сцена: после complete() ставим оставшиеся слоты на «летят
  // в котёл» с шагом ~450мс между каждым. Drain активен → finalizeCorrectPick
  // на flying-завершении не вызывается, слот просто исчезает в котле
  // (state='consumed'), а сверху вылетают зелёные пузыри.
  const drainModeRef = useRef(false)
  const triggerDrain = () => {
    drainModeRef.current = true
    const slots = slotsRef.current
    const idle = slots.filter(s => s.anim.state === 'idle')
    idle.forEach((slot, idx) => {
      setTimeout(() => {
        if (!refApp.current || !canvasDims) return
        const { cauldronCX, cauldronMouthY } = computeLayout(canvasDims.w, canvasDims.h)
        slot.anim.state = 'flying'
        slot.anim.startedAt = performance.now()
        slot.anim.targetX = cauldronCX
        slot.anim.targetY = cauldronMouthY
      }, idx * 450)
    })
  }

  // Мониторим размер канваса — для DOM-overlay хит-зон и совпадающей с Pixi
  // В frozen-режиме (после F5) сразу запускаем drain — финальная сцена с
  // падающими в котёл ингредиентами вместо статичной раскладки.
  useEffect(() => {
    if (!isFrozen) return
    if (!canvasDims) return
    const id = setTimeout(triggerDrain, 200)
    return () => clearTimeout(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isFrozen, canvasDims])

  // раскладки. autoDensity:true делает app.canvas.style.width в CSS-пикселях,
  // что совпадает с ResizeObserver.contentRect.
  useEffect(() => {
    if (!refMount.current) return
    const el = refMount.current
    const update = () => {
      const rect = el.getBoundingClientRect()
      setCanvasDims({ w: rect.width, h: rect.height })
    }
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  useEffect(() => {
    if (isFrozen) return
    if (phase !== 'reference') return
    setRefCountdown(REFERENCE_SECONDS)
    const id = setInterval(() => {
      setRefCountdown(prev => {
        if (prev <= 1) {
          clearInterval(id)
          // Перед стартом игры перетасовываем ингредиенты: в reference они
          // лежали в порядке рецепта (для запоминания), на игру — должны
          // оказаться на других местах, иначе первый шаг тривиален.
          const slots = slotsRef.current
          const ings = slots.map(s => s.ingredient)
          for (let i = ings.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1))
            ;[ings[i], ings[j]] = [ings[j], ings[i]]
          }
          const now = performance.now()
          for (let i = 0; i < slots.length; i++) {
            slots[i].ingredient = ings[i]
            slots[i].anim = {
              state: 'reappearing',
              startedAt: now,
              targetX: 0, targetY: 0,
              homeX: slots[i].anim.homeX,
              homeY: slots[i].anim.homeY,
            }
          }
          setPhase('play')
          return 0
        }
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(id)
  }, [phase, isFrozen])

  useEffect(() => {
    if (isFrozen) return
    if (phase !== 'play') return
    setPlayCountdown(PLAY_SECONDS)
    const id = setInterval(() => {
      setPlayCountdown(prev => {
        if (prev <= 1) {
          clearInterval(id)
          complete()
          return 0
        }
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, isFrozen])

  // ── Pixi init ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!refMount.current) return
    let app: Application | null = null
    let cancelled = false
    ;(async () => {
      app = new Application()
      await app.init({
        resizeTo: refMount.current!,
        backgroundAlpha: 0,
        antialias: true,
        resolution: window.devicePixelRatio || 1,
        autoDensity: true,
      })
      if (cancelled || !refMount.current) {
        app.destroy(true, { children: true })
        return
      }
      refMount.current.appendChild(app.canvas)
      // SVG-декор с position:absolute стакается над static canvas — без явного
      // z-index канвас оказывается под SVG, и тапы могут не доходить. Поднимаем.
      app.canvas.style.position = 'relative'
      app.canvas.style.zIndex = '1'
      refApp.current = app
    })()
    return () => {
      cancelled = true
      if (refApp.current) {
        try { refApp.current.destroy(true, { children: true }) } catch { /* noop */ }
        refApp.current = null
      }
    }
  }, [])

  // ── Главный рендер-цикл через rAF ────────────────────────────────────────
  // Каждый кадр: очищаем сцену → рисуем котёл → 7 слотов с их анимациями
  // → пузыри → искры взрывов. Никаких отдельных pixi-контейнеров «надолго»
  // — всё пересоздаётся каждый кадр, так проще управлять анимациями.
  useEffect(() => {
    let raf = 0
    let cancelled = false
    const tick = () => {
      const app = refApp.current
      if (cancelled) return
      if (!app) {
        raf = requestAnimationFrame(tick)
        return
      }

      const W = app.screen.width
      const H = app.screen.height
      app.stage.removeChildren()

      const layout = computeLayout(W, H)
      const { cauldronW, cauldronH, cauldronCX, cauldronTopY, cauldronMouthY,
              slotW, slotH, positions } = layout
      void cauldronMouthY  // используется ниже в обработчиках
      const cauldronG = new Graphics()
      drawCauldron(cauldronG, cauldronW, cauldronH)
      const cCtr = new Container()
      cCtr.x = cauldronCX
      cCtr.y = cauldronTopY
      cCtr.addChild(cauldronG)
      app.stage.addChild(cCtr)

      const now = performance.now()
      const slots = slotsRef.current

      // ── Слоты ──────────────────────────────────────────────────────────
      for (let i = 0; i < slots.length; i++) {
        const slot = slots[i]
        const pos = positions[i] ?? { x: W / 2, y: H / 2 }
        slot.anim.homeX = pos.x
        slot.anim.homeY = pos.y

        let drawX = pos.x
        let drawY = pos.y
        let scale = 1
        let alpha = 1
        let rotation = 0
        let cardState: 'normal' | 'correct' | 'wrong' | 'consumed' = 'normal'
        let drawCard = true

        if (slot.anim.state === 'consumed') {
          drawCard = false  // в котле — не рисуем
        } else if (slot.anim.state === 'flying') {
          const t = Math.min(1, (now - slot.anim.startedAt) / FLY_MS)
          const eased = t * t
          drawX = pos.x + (slot.anim.targetX - pos.x) * eased
          drawY = pos.y + (slot.anim.targetY - pos.y) * eased
          scale = 1 - eased * 0.6
          alpha = 1 - Math.max(0, (t - 0.8) / 0.2)
          rotation = eased * Math.PI * 0.6
          cardState = 'correct'
        } else if (slot.anim.state === 'shake') {
          const t = Math.min(1, (now - slot.anim.startedAt) / SHAKE_MS)
          const shake = Math.sin(t * Math.PI * 8) * (1 - t) * 6
          drawX = pos.x + shake
          drawY = pos.y - Math.sin(t * Math.PI) * 4
          rotation = shake * 0.03
          cardState = 'wrong'
        } else if (slot.anim.state === 'reappearing') {
          const t = Math.min(1, (now - slot.anim.startedAt) / 300)
          scale = 0.6 + 0.4 * t + (t > 0.7 ? (1 - t) * 0.4 : 0)
          alpha = t
        }

        if (drawCard) {
          const ctr = new Container()
          const cardG = new Graphics()
          drawIngredientCard(cardG, slot.ingredient, slotW, slotH, cardState)
          ctr.addChild(cardG)
          ctr.x = drawX
          ctr.y = drawY
          ctr.scale.set(scale)
          ctr.rotation = rotation
          ctr.alpha = alpha
          // Тапы обрабатываются в DOM-overlay (см. JSX ниже), здесь Pixi
          // только рисует. Это надёжнее, чем pointertap на перерисовываемых
          // каждый кадр контейнерах — у них pointerdown и pointerup попадают
          // на разные инстансы, и тап не регистрируется.
          app.stage.addChild(ctr)
        }

        // Переходы между состояниями
        if (slot.anim.state === 'flying' && now - slot.anim.startedAt >= FLY_MS) {
          if (drainModeRef.current) {
            // Финальное падение: слот «съеден» котлом, не возвращается
            slot.anim.state = 'consumed'
            if (canvasDims) {
              const { cauldronCX, cauldronMouthY } = computeLayout(canvasDims.w, canvasDims.h)
              spawnBubbles(cauldronCX, cauldronMouthY)
            }
          } else {
            finalizeCorrectPick()
          }
        } else if (slot.anim.state === 'shake' && now - slot.anim.startedAt >= SHAKE_MS) {
          slot.anim.state = 'idle'
        } else if (slot.anim.state === 'reappearing' && now - slot.anim.startedAt >= 300) {
          slot.anim.state = 'idle'
        }
      }

      // ── Зелёные пузыри над котлом (правильный ответ) ──────────────────
      const bubbles = bubblesRef.current
      const bubblesGfx = new Graphics()
      for (let i = bubbles.length - 1; i >= 0; i--) {
        const b = bubbles[i]
        const t = (now - b.startedAt) / b.durationMs
        if (t < 0) continue   // ещё не стартовал (с задержкой)
        if (t >= 1) { bubbles.splice(i, 1); continue }
        const eased = 1 - Math.pow(1 - t, 2)
        const cx = b.x0 + b.driftX * eased
        const cy = b.y0 - (cauldronH * 0.85) * eased
        const a = 1 - t
        bubblesGfx.circle(cx, cy, b.radius * (0.7 + 0.3 * (1 - t)))
          .fill({ color: 0x80E090, alpha: a * 0.85 })
          .stroke({ width: 1.5, color: 0x4FD89C, alpha: a * 0.95 })
      }
      app.stage.addChild(bubblesGfx)

      // ── Искры взрыва (неправильный ответ) ─────────────────────────────
      const exps = explosionsRef.current
      const expsGfx = new Graphics()
      for (let i = exps.length - 1; i >= 0; i--) {
        const p = exps[i]
        const t = (now - p.startedAt) / p.durationMs
        if (t >= 1) { exps.splice(i, 1); continue }
        const cx = p.x + p.vx * t
        const cy = p.y + p.vy * t + (220 * t * t)
        const r = 5 * (1 - t * 0.5)
        const a = 1 - t
        expsGfx.circle(cx, cy, r)
          .fill({ color: t < 0.4 ? 0xFFCB45 : 0xFF6020, alpha: a })
      }
      app.stage.addChild(expsGfx)

      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => {
      cancelled = true
      cancelAnimationFrame(raf)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase])

  // ── Обработчики ──────────────────────────────────────────────────────────

  const onPickSlot = (slotIdx: number) => {
    if (doneRef.current || isFrozen) return
    if (phase !== 'play') return
    if (!canvasDims) return
    const slot = slotsRef.current[slotIdx]
    if (!slot || slot.anim.state !== 'idle') return
    const { cauldronCX, cauldronMouthY } = computeLayout(canvasDims.w, canvasDims.h)

    const expected = recipe[stepRef.current]
    const isCorrect = slot.ingredient === expected
    if (isCorrect) {
      slot.anim.state = 'flying'
      slot.anim.startedAt = performance.now()
      slot.anim.targetX = cauldronCX
      slot.anim.targetY = cauldronMouthY
      haptic?.notificationOccurred('success')
      playSound('seal')
    } else {
      slot.anim.state = 'shake'
      slot.anim.startedAt = performance.now()
      errorsRef.current += 1
      haptic?.notificationOccurred('error')
      playSound('lose')
      spawnExplosion(slot.anim.homeX, slot.anim.homeY)
      forceRerender(x => x + 1)
    }
  }

  const spawnExplosion = (x: number, y: number) => {
    const now = performance.now()
    for (let i = 0; i < 14; i++) {
      const angle = (i / 14) * Math.PI * 2 + Math.random() * 0.4
      const speed = 80 + Math.random() * 60
      explosionsRef.current.push({
        startedAt: now,
        durationMs: 600,
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 40,
      })
    }
  }

  const spawnBubbles = (cauldronCX: number, cauldronTopY: number) => {
    const now = performance.now()
    for (let i = 0; i < 8; i++) {
      bubblesRef.current.push({
        startedAt: now + i * 40,
        durationMs: 900 + Math.random() * 400,
        x0: cauldronCX + (Math.random() - 0.5) * 60,
        y0: cauldronTopY,
        driftX: (Math.random() - 0.5) * 50,
        radius: 4 + Math.random() * 5,
      })
    }
  }

  /** Ингредиент долетел до котла. Шафлим 7 слотов и запускаем reappearing. */
  const finalizeCorrectPick = () => {
    const slots = slotsRef.current
    const ingredients = slots.map(s => s.ingredient)
    // Перетасовываем — каждое правильное действие даёт новую раскладку.
    // Math.random здесь намеренно (rngRef быстро вычерпывается за игру).
    for (let i = ingredients.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[ingredients[i], ingredients[j]] = [ingredients[j], ingredients[i]]
    }
    if (canvasDims) {
      const { cauldronCX, cauldronMouthY } = computeLayout(canvasDims.w, canvasDims.h)
      spawnBubbles(cauldronCX, cauldronMouthY)
    }
    const now = performance.now()
    for (let i = 0; i < slots.length; i++) {
      slots[i].ingredient = ingredients[i]
      slots[i].anim = {
        state: 'reappearing',
        startedAt: now,
        targetX: 0, targetY: 0,
        homeX: slots[i].anim.homeX,
        homeY: slots[i].anim.homeY,
      }
    }
    stepRef.current += 1
    collectedRef.current += 1
    setCollected(collectedRef.current)
    if (collectedRef.current >= RECIPE_LENGTH) {
      complete()
    }
  }

  // ── JSX ──────────────────────────────────────────────────────────────────

  return (
    <div style={{
      flex: 1, display: 'flex', flexDirection: 'column',
      maxWidth: '500px', margin: '0 auto', width: '100%', boxSizing: 'border-box',
      padding: spacing.md,
    }}>
      <div style={{
        textAlign: 'center',
        color: phase === 'reference' ? colors.fairyGold : (playCountdown <= 5 && !isFrozen ? colors.danger : colors.fairyGold),
        fontWeight: 700, fontSize: '17px',
      }}>
        {isFrozen
          ? 'Котёл Бабы Яги · разобрано'
          : phase === 'reference'
            ? `Запомни порядок · ${refCountdown}`
            : `Котёл Бабы Яги · ${playCountdown} сек`}
      </div>
      <div style={{
        color: colors.textMuted, fontSize: '12px', textAlign: 'center',
        marginBottom: spacing.sm, lineHeight: 1.4,
      }}>
        {phase === 'reference'
          ? 'Слева направо, сверху вниз — порядок броска ингредиентов'
          : isFrozen
            ? 'Уже сыграно'
            : `Шаг ${Math.min(collected + 1, RECIPE_LENGTH)} из ${RECIPE_LENGTH}. Бросай ингредиенты в котёл по порядку`}
      </div>

      {/* Прогресс-точки 7 шт (только в play, не во frozen) */}
      {phase === 'play' && !isFrozen && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          style={{
            display: 'flex', gap: 6, justifyContent: 'center',
            marginBottom: spacing.sm,
          }}
        >
          {Array.from({ length: RECIPE_LENGTH }).map((_, i) => {
            const filled = i < collected
            const isCurrent = i === collected
            const borderColor = filled ? colors.success : isCurrent ? colors.fairyGold : colors.cardBorder
            const bgColor = filled ? `${colors.success}22` : isCurrent ? `${colors.fairyGold}22` : 'rgba(255,255,255,0.04)'
            return (
              <div key={i} style={{
                width: 22, height: 22, borderRadius: '50%',
                background: bgColor,
                border: `2px solid ${borderColor}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 12, fontWeight: 800,
                color: filled ? colors.success : isCurrent ? colors.fairyGold : colors.textMuted,
                transition: 'all 0.25s',
              }}>
                {filled ? '✓' : isCurrent ? '?' : '·'}
              </div>
            )
          })}
        </motion.div>
      )}

      {/* Канвас с котлом и ингредиентами */}
      <div
        ref={refMount}
        style={{
          flex: 1, width: '100%', minHeight: 460,
          touchAction: 'manipulation', position: 'relative',
          borderRadius: 16, overflow: 'hidden',
          background: `
            radial-gradient(ellipse at 50% 100%, rgba(40,60,40,0.6) 0%, transparent 70%),
            linear-gradient(to bottom, #0F1322 0%, #1A2030 40%, #1F2828 70%, #18221C 100%)
          `,
          boxShadow: 'inset 0 0 80px rgba(0,40,20,0.4)',
        }}
      >
        {/* SVG-декор: коряги по краям + болотные огоньки */}
        <svg
          viewBox="0 0 320 400"
          preserveAspectRatio="xMidYMax slice"
          style={{
            position: 'absolute', inset: 0, width: '100%', height: '100%',
            pointerEvents: 'none', opacity: 0.7, zIndex: 0,
          }}
        >
          <defs>
            <radialGradient id="bogfire1" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#90E060" stopOpacity="0.8" />
              <stop offset="100%" stopColor="#90E060" stopOpacity="0" />
            </radialGradient>
          </defs>
          <path d="M 0 380 Q 30 360 25 340 Q 22 320 35 310 L 25 320 L 18 305 L 8 320 L 0 350 Z"
                fill="#1A1A1A" opacity="0.8" />
          <path d="M 320 390 Q 290 370 295 348 Q 298 326 285 318 L 295 328 L 302 313 L 312 326 L 320 358 Z"
                fill="#1A1A1A" opacity="0.8" />
          <circle cx="50" cy="280" r="14" fill="url(#bogfire1)">
            <animate attributeName="opacity" values="0.4;1;0.4" dur="3s" repeatCount="indefinite" />
          </circle>
          <circle cx="280" cy="300" r="10" fill="url(#bogfire1)">
            <animate attributeName="opacity" values="1;0.3;1" dur="2.5s" repeatCount="indefinite" />
          </circle>
          <circle cx="160" cy="50" r="8" fill="url(#bogfire1)">
            <animate attributeName="opacity" values="0.6;1;0.6" dur="4s" repeatCount="indefinite" />
          </circle>
        </svg>

        {/* DOM-overlay для тапов — Pixi-обработчики на пересоздаваемых каждый
            кадр контейнерах не успевают сопоставить pointerdown и pointerup.
            7 невидимых кнопок поверх канваса, тапы идут сюда. */}
        {!isFrozen && phase === 'play' && canvasDims && computeLayout(canvasDims.w, canvasDims.h).positions.map((pos, i) => {
          const layout = computeLayout(canvasDims.w, canvasDims.h)
          return (
            <button
              key={i}
              onClick={() => onPickSlot(i)}
              aria-label={`Слот ${i + 1}`}
              style={{
                position: 'absolute',
                left: pos.x - layout.slotW / 2,
                top: pos.y - layout.slotH / 2,
                width: layout.slotW,
                height: layout.slotH,
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                padding: 0,
                zIndex: 2,
                touchAction: 'manipulation',
                WebkitTapHighlightColor: 'transparent',
              }}
            />
          )
        })}
      </div>
    </div>
  )
}
