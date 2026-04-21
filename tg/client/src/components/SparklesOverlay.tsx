import { useEffect, useRef } from 'react'
import { colors } from '@/theme'

interface Sparkle {
  x: number
  y: number
  size: number
  opacity: number
  speed: number
  phase: number
}

export function SparklesOverlay({ count = 22 }: { count?: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const sparklesRef = useRef<Sparkle[]>([])
  const animRef = useRef<number>(0)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const resize = () => {
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
    }
    resize()
    window.addEventListener('resize', resize)

    // Инициализируем искры
    sparklesRef.current = Array.from({ length: count }, () => ({
      x: Math.random() * window.innerWidth,
      y: Math.random() * window.innerHeight,
      size: 1 + Math.random() * 3,
      opacity: 0.1 + Math.random() * 0.6,
      speed: 0.3 + Math.random() * 0.8,
      phase: Math.random() * Math.PI * 2,
    }))

    let frame = 0
    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      frame++

      for (const s of sparklesRef.current) {
        const pulse = Math.sin(frame * s.speed * 0.03 + s.phase)
        const alpha = s.opacity * (0.4 + 0.6 * Math.abs(pulse))
        const scale = s.size * (0.8 + 0.4 * Math.abs(pulse))

        ctx.save()
        ctx.globalAlpha = alpha
        ctx.fillStyle = colors.fairyGold
        ctx.beginPath()
        // Рисуем ромб-искру
        ctx.translate(s.x, s.y)
        ctx.moveTo(0, -scale)
        ctx.lineTo(scale * 0.4, 0)
        ctx.lineTo(0, scale)
        ctx.lineTo(-scale * 0.4, 0)
        ctx.closePath()
        ctx.fill()
        ctx.restore()
      }

      animRef.current = requestAnimationFrame(animate)
    }
    animate()

    return () => {
      cancelAnimationFrame(animRef.current)
      window.removeEventListener('resize', resize)
    }
  }, [count])

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 0,
      }}
    />
  )
}
