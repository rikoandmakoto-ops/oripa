'use client'

import { motion } from 'motion/react'

/**
 * 7色に光るレインボー演出。SSR 以上でだけ敷く常設レイヤー。
 *
 * 回転する虹色の光条 + 全体の色相回し + 端の虹縁の 3 枚重ね。
 * 単体で完結させてあるので、どのフェーズの上にかぶせても成立する。
 */

/** conic-gradient 用（角度指定） */
const RAINBOW =
  'red 0deg, orange 51deg, yellow 102deg, lime 153deg, cyan 204deg, blue 255deg, magenta 306deg, red 360deg'

/** linear-gradient 用（％指定）。上と同じ並びを割合で書いたもの */
const RAINBOW_LINEAR =
  'red 0%, orange 14%, yellow 28%, lime 42%, cyan 57%, blue 71%, magenta 85%, red 100%'

export function RainbowFlash({ intense = false }: { intense?: boolean }) {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {/* 回転する虹の光条 */}
      <motion.div
        className="absolute left-1/2 top-1/2 h-[200vmax] w-[200vmax] -translate-x-1/2 -translate-y-1/2 mix-blend-screen"
        style={{
          background: `conic-gradient(from 0deg, ${RAINBOW})`,
          maskImage:
            'radial-gradient(circle, transparent 8%, black 30%, black 55%, transparent 78%)',
          WebkitMaskImage:
            'radial-gradient(circle, transparent 8%, black 30%, black 55%, transparent 78%)',
        }}
        animate={{
          rotate: 360,
          opacity: intense ? [0.35, 0.55, 0.35] : [0.18, 0.3, 0.18],
        }}
        transition={{
          rotate: { duration: 7, repeat: Infinity, ease: 'linear' },
          opacity: { duration: 1.6, repeat: Infinity },
        }}
      />

      {/* 画面全体の虹の脈動 */}
      <motion.div
        className="absolute inset-0 mix-blend-overlay"
        style={{
          background: `linear-gradient(115deg, ${RAINBOW_LINEAR})`,
          backgroundSize: '300% 300%',
        }}
        animate={{
          backgroundPosition: ['0% 50%', '100% 50%', '0% 50%'],
          // 全画面に overlay で虹をかけるレイヤー。強くすると
          // 画面全体が色カブりして、割れも文字も読めなくなる
          opacity: intense ? [0.2, 0.32, 0.2] : [0.1, 0.18, 0.1],
        }}
        transition={{ duration: 3.2, repeat: Infinity, ease: 'linear' }}
      />

      {/* 縁の虹光。中央のカードを邪魔せず“虹だ”と分からせる。
          conic はそのままだと色の境目が三角形に見えてしまうので、
          薄めに敷いて境界を目立たせない。 */}
      <motion.div
        className="absolute inset-0"
        style={{
          background: `conic-gradient(from 90deg, ${RAINBOW})`,
          maskImage:
            'radial-gradient(ellipse at center, transparent 46%, black 96%)',
          WebkitMaskImage:
            'radial-gradient(ellipse at center, transparent 46%, black 96%)',
        }}
        animate={{
          opacity: intense ? [0.2, 0.34, 0.2] : [0.14, 0.26, 0.14],
          rotate: [0, -360],
        }}
        transition={{
          opacity: { duration: 1.9, repeat: Infinity },
          rotate: { duration: 14, repeat: Infinity, ease: 'linear' },
        }}
      />
    </div>
  )
}
