'use client'

import { motion } from 'motion/react'
import { useEffect } from 'react'

import { sfxFreeze } from '@/lib/sfx'

/**
 * フリーズ演出。
 *
 * パチンコのフリーズと同じ役割で、**出た時点で最高レア確定**の合図。
 * 画面の時間が止まり、色が抜け、霜が張ってから一気に解放される。
 *
 * 「何も起きていない時間」をあえて長く取るのが肝で、
 * 派手さではなく“止まっていること”自体で異常を伝える。
 */
/**
 * 霜が張る4辺。内側に向かってフェードさせる。
 *
 * 4枚が重なるので、1枚ずつは薄く・早く消えるようにしないと
 * 画面全体が白く飛んで「凍った」ではなく「霧」になってしまう。
 */
const FROST_EDGES = [
  { className: 'inset-x-0 top-0 h-[34vh]', to: 'bottom' },
  { className: 'inset-x-0 bottom-0 h-[34vh]', to: 'top' },
  { className: 'inset-y-0 left-0 w-[30vw]', to: 'right' },
  { className: 'inset-y-0 right-0 w-[30vw]', to: 'left' },
] as const

export function FreezeStage({ ms }: { ms: number }) {
  const sec = ms / 1000

  useEffect(() => {
    sfxFreeze()
  }, [])

  return (
    <motion.div
      className="absolute inset-0 overflow-hidden"
      exit={{ opacity: 0, transition: { duration: 0.2 } }}
    >
      {/* 突入の白飛び */}
      <motion.div
        className="absolute inset-0 bg-white"
        initial={{ opacity: 1 }}
        animate={{ opacity: 0 }}
        transition={{ duration: 0.22, ease: 'easeOut' }}
      />

      {/* 色が抜けて時間が止まる。
          同時に暗く落として、上に乗る霜と文字のコントラストを確保する。 */}
      <motion.div
        className="absolute inset-0 bg-black/55"
        style={{ backdropFilter: 'grayscale(1) contrast(1.3)' }}
        initial={{ opacity: 0 }}
        animate={{ opacity: [0, 1, 1, 0] }}
        transition={{ duration: sec, times: [0, 0.14, 0.86, 1] }}
      />

      {/* 四辺から張る霜 */}
      {FROST_EDGES.map((edge) => (
        <motion.div
          key={edge.className}
          className={`absolute ${edge.className}`}
          style={{
            background: `linear-gradient(to ${edge.to}, rgba(200,240,255,.7), rgba(120,200,255,.14) 38%, transparent 68%)`,
          }}
          initial={{ opacity: 0, scale: 0.4 }}
          animate={{ opacity: [0, 0.55, 0.55, 0], scale: [0.4, 1, 1, 1.2] }}
          transition={{
            duration: sec,
            times: [0, 0.36, 0.82, 1],
            ease: 'easeOut',
          }}
        />
      ))}

      {/* 氷の結晶（放射状のスパイク） */}
      <div className="absolute inset-0 grid place-items-center">
        {Array.from({ length: 16 }).map((_, i) => (
          <motion.span
            key={i}
            className="absolute origin-left"
            style={{
              height: i % 2 === 0 ? 2 : 1,
              width: '55vmax',
              background:
                'linear-gradient(90deg, rgba(255,255,255,.9), rgba(150,220,255,.25), transparent)',
              rotate: `${(i / 16) * 360 + 11}deg`,
            }}
            initial={{ scaleX: 0, opacity: 0 }}
            animate={{ scaleX: [0, 1, 1, 1], opacity: [0, 0.8, 0.8, 0] }}
            transition={{
              duration: sec,
              times: [0, 0.42, 0.84, 1],
              delay: (i % 5) * 0.04,
            }}
          />
        ))}
      </div>

      {/* 走査線のグリッチ。止まった画面が軋んでいる感じを足す */}
      {[0, 1, 2].map((i) => (
        <motion.div
          key={i}
          className="absolute inset-x-0 h-[6vh] bg-white/70 mix-blend-overlay"
          style={{ top: `${18 + i * 26}%` }}
          initial={{ opacity: 0, x: 0 }}
          animate={{ opacity: [0, 0.9, 0, 0.7, 0], x: [0, -22, 14, -8, 0] }}
          transition={{
            duration: 0.42,
            delay: 0.24 + i * 0.14,
            repeat: 1,
            repeatDelay: sec * 0.34,
          }}
        />
      ))}

      {/* 中央で脈打つ核。解放の直前だけ強くなる */}
      <motion.div
        className="absolute left-1/2 top-1/2 h-40 w-40 -translate-x-1/2 -translate-y-1/2 rounded-full"
        style={{
          background:
            'radial-gradient(circle, #fff 0%, rgba(150,220,255,.75) 40%, transparent 70%)',
        }}
        initial={{ scale: 0, opacity: 0 }}
        animate={{
          scale: [0, 0.9, 0.95, 3.4],
          opacity: [0, 0.7, 0.7, 0],
        }}
        transition={{ duration: sec, times: [0, 0.34, 0.84, 1] }}
      />

      <motion.p
        className="absolute inset-x-0 bottom-[24%] text-center text-3xl font-black tracking-[0.5em] text-white"
        style={{ textShadow: '0 0 30px rgba(150,220,255,.95)' }}
        initial={{ opacity: 0, letterSpacing: '1.2em' }}
        animate={{ opacity: [0, 1, 1, 0] }}
        transition={{ duration: sec, times: [0, 0.4, 0.85, 1] }}
      >
        FREEZE
      </motion.p>
    </motion.div>
  )
}
