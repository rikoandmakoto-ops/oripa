'use client'

import { motion } from 'motion/react'
import { useEffect, useState } from 'react'

import { haptics } from '@/lib/haptics'
import { sfxDrum } from '@/lib/sfx'

/**
 * 和太鼓カウントダウン。
 * 「ドン！ドン！ドン！」と 3 発叩いて、最後の一発で開放する。
 * 叩くたびに太鼓が潰れ、衝撃波が広がる。
 */
export function DrumStage({ ms, color }: { ms: number; color: string }) {
  const [beat, setBeat] = useState(0)
  // 3 発 + 余韻ぶんで尺を割る
  const interval = ms / 3.4

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = []
    for (let i = 0; i < 3; i++) {
      timers.push(
        setTimeout(() => {
          setBeat(i + 1)
          // 後の一発ほど深く重く
          sfxDrum(0.5 + i * 0.25)
          haptics.burst()
        }, i * interval)
      )
    }
    return () => timers.forEach(clearTimeout)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <motion.div
      className="absolute inset-0 grid place-items-center"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.2 } }}
    >
      <motion.div
        className="relative grid place-items-center"
        // 叩くたびに跳ねさせたいので、beat を key にして毎回アニメを撃ち直す
        key={beat}
        animate={beat > 0 ? { scale: [1.14, 1], y: [-8, 0] } : {}}
        transition={{ type: 'spring', stiffness: 700, damping: 18 }}
      >
        {/* 衝撃波 */}
        {beat > 0 &&
          [0, 1].map((i) => (
            <motion.div
              key={`${beat}-${i}`}
              className="absolute rounded-full border-2"
              style={{ borderColor: color }}
              initial={{ width: 180, height: 180, opacity: 0.75 }}
              animate={{ width: 700, height: 700, opacity: 0 }}
              transition={{ duration: 0.75, delay: i * 0.09, ease: 'easeOut' }}
            />
          ))}

        {/* 太鼓本体。叩かれた瞬間に横に潰れる */}
        <motion.div
          className="grid h-44 w-44 place-items-center rounded-full"
          style={{
            background:
              'radial-gradient(circle at 38% 32%, #f7e6c8 0%, #e6c79a 42%, #b8875a 72%, #6b4526 100%)',
            boxShadow: `0 0 60px -8px ${color}, inset 0 -10px 30px rgba(0,0,0,.45)`,
            border: '10px solid #2b1a10',
          }}
          animate={beat > 0 ? { scaleX: [1.16, 1], scaleY: [0.86, 1] } : {}}
          transition={{ type: 'spring', stiffness: 500, damping: 12 }}
        >
          <motion.span
            className="text-6xl font-black text-[#2b1a10]"
            key={beat}
            initial={{ scale: 2.2, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 500, damping: 16 }}
          >
            {beat === 0 ? '' : 3 - (beat - 1)}
          </motion.span>
        </motion.div>
      </motion.div>

      <motion.p
        className="absolute bottom-[22%] text-2xl font-black tracking-[0.4em]"
        style={{ color, textShadow: `0 0 20px ${color}` }}
        animate={{ opacity: [0.5, 1, 0.5] }}
        transition={{ duration: 0.6, repeat: Infinity }}
      >
        まもなく開放
      </motion.p>
    </motion.div>
  )
}
