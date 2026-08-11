'use client'

import { motion } from 'motion/react'
import { useEffect, useMemo } from 'react'

import { makeRng } from '@/lib/gacha-director'
import { haptics } from '@/lib/haptics'
import { sfxCrack, sfxShatter } from '@/lib/sfx'

/**
 * 画面割れ演出。最高レア専用。
 *
 * 中心から放射状にヒビが走り、少し溜めてから破片になって吹き飛ぶ。
 * ヒビが入った時点で当たりが確定しているので、
 * 「割れるまでの間」をしっかり取って引っ張る。
 */

const SPOKES = 13
const R = 190 // viewBox の外まで伸ばして端まで割る

type Crack = {
  /** 中心から外へのジグザグな折れ線 */
  points: [number, number][]
  /** 破片が飛ぶ向き（rad） */
  angle: number
}

function buildCracks(): Crack[] {
  // 割れ方はシード固定。描画のたびにヒビが動くと破片と噛み合わなくなる。
  const rnd = makeRng(0x5eed)
  return Array.from({ length: SPOKES }, (_, i) => {
    // 等間隔だと機械的なので少しだけ散らす
    const angle = (i / SPOKES) * Math.PI * 2 + (rnd() - 0.5) * 0.35
    const points: [number, number][] = [[0, 0]]
    let r = 0
    while (r < R) {
      r += R / 4 + rnd() * (R / 6)
      // 進むほど本筋から逸れるようにして、ガラスらしい折れ方にする
      const wobble = (rnd() - 0.5) * 0.22 * (r / R)
      points.push([
        Math.cos(angle + wobble) * Math.min(r, R),
        Math.sin(angle + wobble) * Math.min(r, R),
      ])
    }
    return { points, angle }
  })
}

export function CrackStage({ ms, color }: { ms: number; color: string }) {
  const sec = ms / 1000
  // ヒビが描かれる → 溜め → 砕ける、の3区間
  const drawSec = sec * 0.44
  const shatterAt = sec * 0.62

  const cracks = useMemo(() => buildCracks(), [])

  useEffect(() => {
    // ヒビ1本ごとに「ピシッ」を鳴らす
    cracks.forEach((_, i) => {
      sfxCrack((i * drawSec) / cracks.length, 1 + (i % 4) * 0.12)
    })
    const t = setTimeout(() => {
      sfxShatter()
      haptics.burst()
    }, shatterAt * 1000)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <motion.div
      className="absolute inset-0 overflow-hidden"
      exit={{ opacity: 0, transition: { duration: 0.2 } }}
      // ヒビが走っている間、画面を震わせる
      animate={{ x: [0, -6, 6, -4, 4, -2, 0], y: [0, 4, -4, 2, -2, 0, 0] }}
      transition={{ duration: drawSec, repeat: 1 }}
    >
      {/* 割れ目から漏れる光 */}
      <motion.div
        className="absolute inset-0"
        style={{
          background: `radial-gradient(circle at 50% 50%, ${color}, transparent 55%)`,
        }}
        initial={{ opacity: 0 }}
        animate={{ opacity: [0, 0.35, 0.9, 0] }}
        transition={{ duration: sec, times: [0, 0.44, 0.62, 1] }}
      />

      <svg
        className="absolute inset-0 h-full w-full"
        viewBox="-100 -100 200 200"
        preserveAspectRatio="xMidYMid slice"
      >
        {/* 破片。溜めが終わってから外へ飛ぶ */}
        {cracks.map((c, i) => {
          const next = cracks[(i + 1) % cracks.length]
          const mid = c.angle + (Math.PI * 2) / SPOKES / 2
          const d = [
            'M 0 0',
            ...c.points.slice(1).map(([x, y]) => `L ${x} ${y}`),
            ...[...next.points].reverse().map(([x, y]) => `L ${x} ${y}`),
            'Z',
          ].join(' ')

          return (
            <motion.path
              key={`shard-${i}`}
              d={d}
              fill="rgba(8,8,16,.94)"
              stroke="rgba(255,255,255,.5)"
              strokeWidth={0.6}
              initial={{ opacity: 1, x: 0, y: 0, rotate: 0, scale: 1 }}
              animate={{
                opacity: [1, 1, 0],
                x: [0, 0, Math.cos(mid) * 190],
                y: [0, 0, Math.sin(mid) * 190],
                rotate: [0, 0, (i % 2 === 0 ? 1 : -1) * (30 + i * 4)],
                scale: [1, 1, 0.75],
              }}
              transition={{
                duration: sec,
                times: [0, 0.62, 1],
                ease: 'easeIn',
              }}
            />
          )
        })}

        {/* ヒビの線そのもの。破片より前に描いて光らせる */}
        {cracks.map((c, i) => (
          <motion.polyline
            key={`crack-${i}`}
            points={c.points.map(([x, y]) => `${x},${y}`).join(' ')}
            fill="none"
            stroke="#ffffff"
            strokeWidth={1.1}
            strokeLinecap="round"
            style={{ filter: `drop-shadow(0 0 3px ${color})` }}
            initial={{ pathLength: 0, opacity: 0 }}
            animate={{ pathLength: 1, opacity: [0, 1, 1, 0] }}
            transition={{
              pathLength: {
                duration: drawSec / 1.2,
                delay: (i * drawSec) / cracks.length,
                ease: 'easeOut',
              },
              opacity: { duration: sec, times: [0, 0.1, 0.62, 0.8] },
            }}
          />
        ))}
      </svg>

      {/* 砕けた瞬間のフラッシュ */}
      <motion.div
        className="absolute inset-0 bg-white"
        initial={{ opacity: 0 }}
        animate={{ opacity: [0, 0, 0.95, 0] }}
        transition={{ duration: sec, times: [0, 0.6, 0.68, 1] }}
      />
    </motion.div>
  )
}
