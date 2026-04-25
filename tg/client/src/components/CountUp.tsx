import { useEffect, useRef, useState } from 'react'

interface CountUpProps {
  value: number
  duration?: number          // мс
  decimals?: number          // знаков после запятой
  format?: (n: number) => string
}

/**
 * Плавный счётчик. При изменении `value` перебирает от предыдущего числа к новому
 * с easeOutCubic. По умолчанию — целые числа, без форматирования.
 *
 * Если разница большая — анимация всё равно займёт `duration` мс (не дольше).
 * Малые изменения тоже плавны, но быстрее визуально.
 */
export function CountUp({ value, duration = 800, decimals = 0, format }: CountUpProps) {
  const [displayed, setDisplayed] = useState(value)
  const fromRef = useRef(value)
  const startRef = useRef<number | null>(null)
  const rafRef = useRef<number | null>(null)

  useEffect(() => {
    if (value === displayed) return
    fromRef.current = displayed
    startRef.current = null

    const tick = (now: number) => {
      if (startRef.current === null) startRef.current = now
      const elapsed = now - startRef.current
      const t = Math.min(1, elapsed / duration)
      const eased = 1 - Math.pow(1 - t, 3)
      const current = fromRef.current + (value - fromRef.current) * eased
      setDisplayed(current)
      if (t < 1) {
        rafRef.current = requestAnimationFrame(tick)
      } else {
        setDisplayed(value)
      }
    }

    rafRef.current = requestAnimationFrame(tick)
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, duration])

  const text = format ? format(displayed) : displayed.toFixed(decimals)
  return <>{text}</>
}
