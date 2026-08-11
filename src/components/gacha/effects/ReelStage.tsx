'use client'

import { motion } from 'motion/react'
import { useEffect, useState } from 'react'

import { REEL_SYMBOLS } from '@/lib/gacha-director'
import { sfxReelSpin, sfxReelStop, sfxTenpai } from '@/lib/sfx'

/**
 * パチスロ風リール演出。
 *
 * 3本のリールが左から順に止まり、揃った出目でレアリティを示唆する。
 * 出目そのものは director が決めるので、ここは「決まった目に止める」だけ。
 */

const SYM_H = 78
/** 帯に並べるシンボルの周回数。止まる位置より十分に長く取る */
const COPIES = 12
/** 何周目で止めるか */
const LAND_COPY = 10
/** 見せる回転量（周） */
const SPINS = 8

const N = REEL_SYMBOLS.length
const STRIP = Array.from({ length: COPIES * N }, (_, i) => REEL_SYMBOLS[i % N])

/** シンボルごとの色。格の高い目ほど派手にする */
const SYM_STYLE: Record<number, { color: string; glow: string }> = {
  0: { color: '#ff3d6e', glow: 'rgba(255,61,110,.9)' }, // 7
  1: { color: '#ffc93c', glow: 'rgba(255,201,60,.9)' }, // ★
  2: { color: '#a855f7', glow: 'rgba(168,85,247,.8)' }, // ◆
  3: { color: '#38bdf8', glow: 'rgba(56,189,248,.7)' }, // BAR
}
const SYM_DEFAULT = { color: '#7b8296', glow: 'rgba(120,130,150,.4)' }

function symStyle(i: number) {
  return SYM_STYLE[i] ?? SYM_DEFAULT
}

export function ReelStage({
  pattern,
  ms,
  tier,
}: {
  pattern: [number, number, number]
  ms: number
  tier: number
}) {
  const [stopped, setStopped] = useState(0)

  // 3本目だけ遅らせると「あと1本」の溜めが効く。
  // 高レアではさらに引っ張って“スベリ”を演出する。
  const stopAt = [
    ms * 0.42,
    ms * 0.63,
    ms * (tier >= 3 ? 0.95 : 0.8),
  ] as const

  const isTenpai = pattern[0] === pattern[1]
  const allMatch = isTenpai && pattern[1] === pattern[2]

  // 効果音はマウント時にまとめて予約する。
  // WebAudio 側で正確な時刻に鳴るので、setTimeout でのズレを避けられる。
  useEffect(() => {
    sfxReelSpin(stopAt[2] / 1000)
    stopAt.forEach((t, i) => sfxReelStop(i, t / 1000))
    if (isTenpai) sfxTenpai()
    // マウント時に1度だけ。出目は演出中に変わらない。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 止まった本数を進めて、テンパイ・全揃いの見た目を切り替える
  useEffect(() => {
    const timers = stopAt.map((t, i) =>
      setTimeout(() => setStopped(i + 1), t)
    )
    return () => timers.forEach(clearTimeout)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const lit = allMatch && stopped === 3
  const litColor = symStyle(pattern[2]).color

  return (
    <motion.div
      className="absolute inset-0 grid place-items-center"
      initial={{ opacity: 0, scale: 0.94 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 1.08, transition: { duration: 0.25 } }}
      transition={{ duration: 0.25 }}
    >
      {/* 全揃い時の後光 */}
      {lit && (
        <motion.div
          className="pointer-events-none absolute h-[90vmin] w-[90vmin] rounded-full"
          style={{
            background: `radial-gradient(circle, ${symStyle(pattern[2]).glow} 0%, transparent 62%)`,
          }}
          initial={{ scale: 0.2, opacity: 0 }}
          animate={{ scale: [0.2, 1.15, 1], opacity: [0, 0.9, 0.55] }}
          transition={{ duration: 0.6 }}
        />
      )}

      <motion.div
        className="relative rounded-2xl border-2 p-3"
        style={{
          borderColor: lit ? litColor : 'rgba(255,255,255,.18)',
          background:
            'linear-gradient(180deg, rgba(10,10,18,.95), rgba(22,18,40,.95))',
          boxShadow: lit
            ? `0 0 60px -4px ${symStyle(pattern[2]).glow}`
            : '0 12px 60px -20px rgba(0,0,0,.9)',
        }}
        // テンパイした瞬間に筐体を揺らす
        animate={
          stopped === 2 && isTenpai
            ? { x: [0, -5, 5, -3, 3, 0] }
            : lit
              ? { scale: [1, 1.06, 1] }
              : {}
        }
        transition={{ duration: lit ? 0.4 : 0.35, repeat: lit ? 0 : 2 }}
      >
        <div className="flex gap-2">
          {pattern.map((target, i) => (
            <Reel
              key={i}
              target={target}
              durationMs={stopAt[i]}
              spinning={stopped <= i}
            />
          ))}
        </div>

        {/* 中央のペイライン */}
        <motion.div
          className="pointer-events-none absolute inset-x-1 top-1/2 h-[2px] -translate-y-1/2"
          style={{ background: lit ? litColor : 'rgba(255,255,255,.25)' }}
          animate={lit ? { opacity: [1, 0.3, 1] } : { opacity: 0.35 }}
          transition={{ duration: 0.45, repeat: lit ? 3 : 0 }}
        />
      </motion.div>

      {/* 煽り文言 */}
      <motion.p
        className="absolute bottom-[20%] text-lg font-black tracking-[0.3em]"
        style={{ color: lit ? litColor : 'rgba(255,255,255,.55)' }}
        animate={{ opacity: [0.4, 1, 0.4] }}
        transition={{ duration: 0.9, repeat: Infinity }}
      >
        {lit ? '揃った！' : stopped === 2 && isTenpai ? 'テンパイ！' : '抽選中'}
      </motion.p>
    </motion.div>
  )
}

/** リール1本 */
function Reel({
  target,
  durationMs,
  spinning,
}: {
  target: number
  durationMs: number
  spinning: boolean
}) {
  // 帯の座標。中央の枠に target が来る位置を終点にする
  const yAt = (copy: number) => SYM_H - (copy * N + target) * SYM_H
  const yEnd = yAt(LAND_COPY)
  const yStart = yAt(LAND_COPY - SPINS)

  const dur = durationMs / 1000

  return (
    <div
      className="relative overflow-hidden rounded-lg border border-white/10 bg-black/70"
      style={{ width: 76, height: SYM_H * 3 }}
    >
      <motion.div
        className="absolute inset-x-0 top-0"
        initial={{ y: yStart }}
        animate={{
          // 大半を一定速で回してから、最後だけ overshoot して収まる
          y: [yStart, yStart + (yEnd - yStart) * 0.9, yEnd + SYM_H * 0.14, yEnd],
        }}
        transition={{
          duration: dur,
          times: [0, 0.72, 0.9, 1],
          ease: ['linear', 'easeOut', 'easeInOut'],
        }}
        style={{
          filter: spinning ? 'blur(3px)' : 'none',
          transition: 'filter .12s',
        }}
      >
        {STRIP.map((s, i) => {
          const st = symStyle(i % N)
          return (
            <div
              key={i}
              className="grid place-items-center font-black"
              style={{
                height: SYM_H,
                fontSize: s === 'BAR' ? 22 : 40,
                color: st.color,
                textShadow: `0 0 14px ${st.glow}`,
              }}
            >
              {s}
            </div>
          )
        })}
      </motion.div>

      {/* 上下の暗がり。中央の窓だけを見せる */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'linear-gradient(180deg, rgba(0,0,0,.92) 0%, transparent 28%, transparent 72%, rgba(0,0,0,.92) 100%)',
        }}
      />
    </div>
  )
}
