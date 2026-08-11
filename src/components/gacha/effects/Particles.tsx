'use client'

import { motion } from 'motion/react'
import { useMemo } from 'react'

import { makeRng } from '@/lib/gacha-director'

/**
 * パーティクル演出。
 *
 * 演出フェーズではなく「ずっと敷いておくレイヤー」として使う。
 * レアリティで粒の数・色・速さが変わり、最高レアだけ虹色になる。
 */

/** tier ごとの粒の数。0 のときは何も出さない */
const COUNT: Record<number, number> = { 0: 0, 1: 12, 2: 24, 3: 40, 4: 64 }

type Particle = {
  angle: number
  distance: number
  size: number
  delay: number
  duration: number
  hue: number
  drift: number
  gap: number
}

export function Particles({ tier, color }: { tier: number; color: string }) {
  const t = Math.min(4, Math.max(0, tier))
  const count = COUNT[t] ?? 0
  const rainbow = t >= 4

  // 粒の配置はシード固定。tier ごとに毎回同じ散り方になるが、
  // 数十粒が無限にループするので見た目には差が分からない。
  const particles = useMemo<Particle[]>(() => {
    const rnd = makeRng(0x9e37 + t * 7919)
    return Array.from({ length: count }, (_, i) => ({
      angle: rnd() * Math.PI * 2,
      distance: 140 + rnd() * 420,
      size: 2 + rnd() * (t >= 3 ? 6 : 3),
      delay: rnd() * 2.2,
      duration: 1.6 + rnd() * 1.8,
      hue: (i / Math.max(1, count)) * 360,
      // 上に舞い上がる分。金粉が浮くような動きにする
      drift: -40 - rnd() * 120,
      gap: rnd() * 0.6,
    }))
  }, [count, t])

  if (count === 0) return null

  return (
    <div className="pointer-events-none absolute inset-0 grid place-items-center overflow-hidden">
      {particles.map((p, i) => {
        const c = rainbow ? `hsl(${p.hue} 100% 65%)` : color
        return (
          <motion.span
            key={i}
            className="absolute rounded-full"
            style={{
              width: p.size,
              height: p.size,
              background: c,
              boxShadow: `0 0 ${p.size * 3}px ${c}`,
            }}
            initial={{ x: 0, y: 0, opacity: 0, scale: 0.4 }}
            animate={{
              x: Math.cos(p.angle) * p.distance,
              y: Math.sin(p.angle) * p.distance + p.drift,
              opacity: [0, 1, 1, 0],
              scale: [0.4, 1, 0.9, 0.2],
            }}
            transition={{
              duration: p.duration,
              delay: p.delay,
              repeat: Infinity,
              repeatDelay: p.gap,
              ease: 'easeOut',
            }}
          />
        )
      })}
    </div>
  )
}
