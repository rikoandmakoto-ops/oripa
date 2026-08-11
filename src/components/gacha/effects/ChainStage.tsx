'use client'

import { motion } from 'motion/react'
import { useEffect } from 'react'

import { haptics } from '@/lib/haptics'
import { sfxChain } from '@/lib/sfx'

/**
 * 連続演出。10連の途中に 1 度だけ割り込む。
 *
 * 一番いいカードの直前に挟むことで、
 * 「残りのどれかに大物がいる」という溜めを作るのが狙い。
 * director の chainIndex() が挿入位置を決める。
 */
export function ChainStage({
  ms,
  color,
  remaining,
}: {
  ms: number
  color: string
  remaining: number
}) {
  const sec = ms / 1000

  useEffect(() => {
    sfxChain()
    haptics.charge()
  }, [])

  return (
    <motion.div
      className="absolute inset-0 grid place-items-center overflow-hidden bg-black/70"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.2 } }}
      transition={{ duration: 0.15 }}
    >
      {/* 上下から閉じる帯。挟まれた感を出す */}
      {([-1, 1] as const).map((dir) => (
        <motion.div
          key={dir}
          className={`absolute inset-x-0 h-[34vh] ${dir === -1 ? 'top-0' : 'bottom-0'}`}
          style={{
            background: `linear-gradient(${dir === -1 ? 180 : 0}deg, ${color}cc, transparent)`,
          }}
          initial={{ y: dir * 200, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 220, damping: 22 }}
        />
      ))}

      {/* 流れる帯 */}
      <motion.div
        className="absolute inset-x-0 h-24 overflow-hidden"
        style={{ background: color, boxShadow: `0 0 60px ${color}` }}
        initial={{ scaleY: 0 }}
        animate={{ scaleY: 1 }}
        transition={{ duration: 0.22, ease: 'easeOut' }}
      >
        <motion.div
          className="flex h-full items-center whitespace-nowrap text-4xl font-black text-black/80"
          animate={{ x: ['0%', '-50%'] }}
          transition={{ duration: 2.4, repeat: Infinity, ease: 'linear' }}
        >
          {Array.from({ length: 8 }).map((_, i) => (
            <span key={i} className="px-6">
              CHANCE
            </span>
          ))}
        </motion.div>
      </motion.div>

      {/* 本文 */}
      <div className="relative z-10 text-center">
        <motion.p
          className="text-5xl font-black italic text-white sm:text-6xl"
          style={{ textShadow: `0 0 30px ${color}, 0 0 70px ${color}` }}
          initial={{ scale: 2.6, opacity: 0, rotate: -10 }}
          animate={{ scale: 1, opacity: 1, rotate: -4 }}
          transition={{ type: 'spring', stiffness: 380, damping: 14, delay: 0.18 }}
        >
          まだ終わらない
        </motion.p>
        <motion.p
          className="mt-4 text-lg font-bold tracking-widest text-white/85"
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
        >
          残り {remaining} 枚に大物が眠っている
        </motion.p>
      </div>

      {/* 締めのフラッシュ */}
      <motion.div
        className="absolute inset-0 bg-white"
        initial={{ opacity: 0 }}
        animate={{ opacity: [0, 0, 0.85, 0] }}
        transition={{ duration: sec, times: [0, 0.78, 0.88, 1] }}
      />
    </motion.div>
  )
}
