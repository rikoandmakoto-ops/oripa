'use client'

import { motion } from 'motion/react'
import { useEffect } from 'react'

import { RARITY } from '@/lib/rarity'
import { sfxCutIn } from '@/lib/sfx'

/**
 * カットイン演出。
 *
 * 集中線 → 斜めのパネルが横から叩き込まれる → 煽り文字、の 3 段構え。
 * 最高レアでは反対側からもう一枚返して二段構えにする。
 */
export function CutInStage({
  ms,
  tier,
  color,
}: {
  ms: number
  tier: number
  color: string
}) {
  const sec = ms / 1000
  const double = tier >= 4
  const hype = RARITY[tier >= 4 ? 'S' : tier >= 3 ? 'A' : 'B'].hype

  useEffect(() => {
    sfxCutIn(tier)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <motion.div
      className="absolute inset-0 overflow-hidden"
      exit={{ opacity: 0, transition: { duration: 0.18 } }}
    >
      {/* 集中線 */}
      <SpeedLines color={color} />

      {/* 1枚目：左から */}
      <CutPanel color={color} from="left" delay={0.08} duration={sec} />

      {/* 2枚目：最高レアのみ、右から返す */}
      {double && (
        <CutPanel color="#ffffff" from="right" delay={0.42} duration={sec} />
      )}

      {/* 煽り文字 */}
      <motion.div
        className="absolute inset-0 grid place-items-center"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: double ? 0.62 : 0.3 }}
      >
        <motion.span
          className="text-6xl font-black italic sm:text-7xl"
          style={{
            color: '#fff',
            WebkitTextStroke: `2px ${color}`,
            textShadow: `0 0 30px ${color}, 0 0 60px ${color}`,
          }}
          initial={{ scale: 3, opacity: 0, rotate: -12 }}
          animate={{ scale: 1, opacity: 1, rotate: -6 }}
          transition={{
            type: 'spring',
            stiffness: 420,
            damping: 13,
            delay: double ? 0.62 : 0.3,
          }}
        >
          {hype}
        </motion.span>
      </motion.div>
    </motion.div>
  )
}

/** 斜めに叩き込まれるパネル1枚 */
function CutPanel({
  color,
  from,
  delay,
  duration,
}: {
  color: string
  from: 'left' | 'right'
  delay: number
  duration: number
}) {
  const dir = from === 'left' ? -1 : 1

  return (
    <motion.div
      className="absolute left-1/2 top-1/2 h-[38vmin] w-[150vmax]"
      style={{
        // 斜めに走らせる。上下は帯の外なので背景が透ける
        background: `linear-gradient(90deg, transparent, ${color}dd 18%, #ffffff 50%, ${color}dd 82%, transparent)`,
        boxShadow: `0 0 80px ${color}`,
        rotate: `${dir * -14}deg`,
        x: '-50%',
        y: '-50%',
        mixBlendMode: 'screen',
      }}
      initial={{ scaleX: 0, opacity: 0, skewX: dir * 24 }}
      animate={{
        scaleX: [0, 1, 1, 1.06],
        opacity: [0, 1, 0.9, 0],
        skewX: [dir * 24, 0, 0, dir * -8],
      }}
      transition={{
        duration: Math.max(0.5, duration - delay),
        times: [0, 0.16, 0.6, 1],
        delay,
        ease: 'easeOut',
      }}
    />
  )
}

/** 中心に向かう集中線 */
function SpeedLines({ color }: { color: string }) {
  return (
    <div className="pointer-events-none absolute inset-0 grid place-items-center">
      {Array.from({ length: 28 }).map((_, i) => (
        <motion.span
          key={i}
          className="absolute origin-left"
          style={{
            height: i % 3 === 0 ? 3 : 1.5,
            width: '60vmax',
            background: `linear-gradient(90deg, transparent, ${color})`,
            rotate: `${(i / 28) * 360}deg`,
          }}
          initial={{ scaleX: 0.15, opacity: 0 }}
          animate={{ scaleX: [0.15, 1, 0.4], opacity: [0, 0.85, 0] }}
          transition={{
            duration: 0.5,
            delay: (i % 6) * 0.035,
            repeat: 1,
          }}
        />
      ))}
    </div>
  )
}
