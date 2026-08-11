'use client'

import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { useCallback, useEffect, useMemo, useState } from 'react'

import { haptics } from '@/lib/haptics'
import { fmtNum } from '@/lib/format'
import {
  chainIndex,
  hashSeed,
  makeRng,
  planSteps,
  reelPattern,
  type Step,
  type StepKind,
} from '@/lib/gacha-director'
import { RARITY, rarityOf, topRarity } from '@/lib/rarity'
import {
  sfxBurst,
  sfxCharge,
  sfxFanfare,
  sfxFlip,
  sfxRainbow,
  sfxReveal,
  sfxSparkle,
  sfxTease,
} from '@/lib/sfx'
import type { DrawnCard } from '@/types/db'

import { CardBack, CardVisual } from './CardVisual'
import { ChainStage } from './effects/ChainStage'
import { CrackStage } from './effects/CrackStage'
import { CutInStage } from './effects/CutInStage'
import { DrumStage } from './effects/DrumStage'
import { FreezeStage } from './effects/FreezeStage'
import { Particles } from './effects/Particles'
import { RainbowFlash } from './effects/RainbowFlash'
import { ReelStage } from './effects/ReelStage'

/** 導入演出が終わったあとの段階 */
type Mode = 'intro' | 'reveal' | 'chain' | 'summary'

/** 連続演出の尺(ms) */
const CHAIN_MS = 1900

/**
 * 常設レイヤー（背景色・パーティクル・レインボー）を、
 * どの段階から出してよいかの一覧。
 *
 * - color … レアリティ色。リールが止まる前に出すと結果が割れるので伏せる
 * - particles … 粒子。色を出してよくなってから
 * - rainbow … 虹。最高レアの“payoff”なので、割れ〜開放まで引っ張る
 *
 * フリーズは出た時点で最高レア確定なので色は出してよいが、
 * 虹と粒子まで出すと画面が白く飽和して「凍った」感じが消える。
 * ここを一覧で持っているのは、その手の綱引きを 1 か所で調整するため。
 */
type Layers = { color: boolean; particles: boolean; rainbow: boolean }

const STEP_LAYERS: Record<StepKind, Layers> = {
  freeze: { color: true, particles: false, rainbow: false },
  charge: { color: false, particles: false, rainbow: false },
  drum: { color: false, particles: false, rainbow: false },
  reel: { color: false, particles: false, rainbow: false },
  cutin: { color: true, particles: true, rainbow: false },
  tease: { color: true, particles: true, rainbow: false },
  crack: { color: true, particles: true, rainbow: true },
  burst: { color: true, particles: true, rainbow: true },
}

/** 導入が終わったあとのレイヤー。結果一覧は読ませたいので虹も粒子も止める */
const MODE_LAYERS: Record<Exclude<Mode, 'intro'>, Layers> = {
  reveal: { color: true, particles: true, rainbow: true },
  chain: { color: true, particles: true, rainbow: true },
  summary: { color: true, particles: false, rainbow: false },
}

export function GachaOverlay({
  cards,
  packTitle,
  onClose,
  onDrawAgain,
  plan: planOverride,
}: {
  cards: DrawnCard[]
  packTitle: string
  onClose: () => void
  onDrawAgain?: () => void
  /** 演出プレビュー用。渡すと director の代わりにこの手順を再生する */
  plan?: Step[]
}) {
  const reduceMotion = useReducedMotion()
  const [stepIdx, setStepIdx] = useState(0)
  const [rawMode, setMode] = useState<Mode>('intro')
  const [index, setIndex] = useState(0)
  const [chainShown, setChainShown] = useState(false)

  // 「視差効果を減らす」設定の人には演出を流さず、結果だけ見せる。
  // state を書き換えるのではなく描画時に読み替えることで、
  // 設定が途中で変わっても破綻しない。
  const mode: Mode = reduceMotion ? 'summary' : rawMode

  const best = topRarity(cards.map((c) => c.rarity))
  const bestTier = RARITY[best].tier
  const bestStyle = RARITY[best]

  // 手順は抽選結果から決まる。
  // planSteps はガセ演出を乱数で混ぜるが、draw_id を種にすることで
  // 同じ抽選なら何度描画しても同じ構成になる（＝描画中に演出が変わらない）。
  const plan = useMemo(
    () =>
      planOverride ??
      planSteps(bestTier, makeRng(hashSeed(cards[0]?.draw_id ?? ''))),
    [planOverride, bestTier, cards]
  )

  // 導入演出中だけ step が入る。reveal 以降は undefined になり、
  // 下の描画はこの有無で「導入か本編か」を分けている。
  const step = mode === 'intro' ? plan[stepIdx] : undefined

  // 10連の途中に挟む連続演出の位置
  const chainAt = useMemo(
    () => chainIndex(cards.map((c) => rarityOf(c.rarity).tier)),
    [cards]
  )

  const layers = step ? STEP_LAYERS[step.kind] : MODE_LAYERS[mode as Exclude<Mode, 'intro'>]
  const colorShown = layers.color
  const rainbow = bestTier >= 4 && layers.rainbow

  // 演出中の裏スクロールを止める
  useEffect(() => {
    document.body.classList.add('gacha-locked')
    return () => document.body.classList.remove('gacha-locked')
  }, [])

  // ------------------------------------------------------------------
  // 導入演出のタイムライン。
  // 手順の尺を積み上げて、各ステップの開始時刻に setStepIdx を撃つ。
  //
  // 効果音は「単純な演出（charge/tease/burst）はここで鳴らし、
  // 内部に独自の間を持つ演出（reel/drum/cutin/freeze/crack）は
  // コンポーネント自身が鳴らす」という分担にしている。
  // 後者は自分の進行と音を合わせる必要があるため。
  // ------------------------------------------------------------------
  useEffect(() => {
    if (reduceMotion) return

    const timers: ReturnType<typeof setTimeout>[] = []
    let at = 0

    plan.forEach((s, i) => {
      timers.push(
        setTimeout(() => {
          setStepIdx(i)
          fireStepSound(s, bestTier, bestStyle.color)
        }, at)
      )
      at += s.ms
    })

    timers.push(setTimeout(() => setMode('reveal'), at))

    return () => timers.forEach(clearTimeout)
    // マウント時に1度だけ組む。cards は同一ドローの結果で不変。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // カードが1枚表示されるたびに鳴らす
  useEffect(() => {
    if (mode !== 'reveal') return
    const card = cards[index]
    if (!card) return
    const tier = rarityOf(card.rarity).tier
    sfxFlip()
    const t = setTimeout(() => {
      sfxReveal(tier)
      haptics.reveal(tier)
      if (tier >= 4) {
        sfxFanfare()
        void fireConfetti(rarityOf(card.rarity).color)
      }
    }, 380)
    return () => clearTimeout(t)
  }, [mode, index, cards])

  const advance = useCallback(() => {
    if (mode !== 'reveal') return

    if (index >= cards.length - 1) {
      setMode('summary')
      return
    }

    const next = index + 1

    // 大物の直前で 1 度だけ連続演出を挟む
    if (next === chainAt && !chainShown) {
      setChainShown(true)
      setMode('chain')
      setTimeout(() => {
        setIndex(next)
        setMode('reveal')
      }, CHAIN_MS)
      return
    }

    setIndex(next)
  }, [mode, index, cards.length, chainAt, chainShown])

  const skipToSummary = useCallback(() => setMode('summary'), [])

  // キーボード操作（Space/Enter で送る、Esc で結果へ）
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        if (mode === 'summary') onClose()
        else skipToSummary()
      } else if (e.key === ' ' || e.key === 'Enter') {
        if (mode === 'reveal') {
          e.preventDefault()
          advance()
        }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [mode, advance, skipToSummary, onClose])

  const totalValue = cards.reduce((s, c) => s + c.point_value, 0)

  return (
    <div
      className="fixed inset-0 z-50 overflow-hidden bg-black/95"
      role="dialog"
      aria-modal="true"
      aria-label="ガチャ結果"
    >
      {/* 全フェーズ通して敷く常設レイヤー */}
      <BackdropGlow
        color={bestStyle.color}
        tier={bestTier}
        colorShown={colorShown}
      />
      {rainbow && <RainbowFlash intense={mode === 'intro'} />}
      {layers.particles && <Particles tier={bestTier} color={bestStyle.color} />}

      {/* スキップ */}
      {mode !== 'summary' && (
        <button
          type="button"
          onClick={skipToSummary}
          className="absolute right-4 top-4 z-30 rounded-full border border-white/25 bg-black/50 px-4 py-2 text-sm font-medium text-white/80 backdrop-blur transition hover:bg-black/70 hover:text-white"
        >
          スキップ
        </button>
      )}

      <AnimatePresence mode="wait">
        {step?.kind === 'freeze' && <FreezeStage key="freeze" ms={step.ms} />}

        {step?.kind === 'charge' && <ChargeStage key="charge" />}

        {step?.kind === 'drum' && (
          <DrumStage key="drum" ms={step.ms} color={bestStyle.color} />
        )}

        {step?.kind === 'reel' && (
          <ReelStage
            key="reel"
            ms={step.ms}
            tier={bestTier}
            pattern={reelPattern(bestTier)}
          />
        )}

        {step?.kind === 'cutin' && (
          <CutInStage
            key="cutin"
            ms={step.ms}
            tier={bestTier}
            color={bestStyle.color}
          />
        )}

        {step?.kind === 'tease' && (
          <TeaseStage key="tease" color={bestStyle.color} tier={bestTier} />
        )}

        {step?.kind === 'crack' && (
          <CrackStage key="crack" ms={step.ms} color={bestStyle.color} />
        )}

        {step?.kind === 'burst' && (
          <BurstStage key="burst" color={bestStyle.color} tier={bestTier} />
        )}

        {mode === 'chain' && (
          <ChainStage
            key="chain"
            ms={CHAIN_MS}
            color={bestStyle.color}
            remaining={cards.length - index - 1}
          />
        )}

        {mode === 'reveal' && (
          <RevealStage
            key={`reveal-${index}`}
            card={cards[index]}
            index={index}
            total={cards.length}
            onAdvance={advance}
          />
        )}

        {mode === 'summary' && (
          <SummaryStage
            key="summary"
            cards={cards}
            packTitle={packTitle}
            totalValue={totalValue}
            onClose={onClose}
            onDrawAgain={onDrawAgain}
          />
        )}
      </AnimatePresence>
    </div>
  )
}

/** 単純な演出の効果音。複雑な演出は各コンポーネントが自分で鳴らす */
function fireStepSound(step: Step, tier: number, color: string) {
  switch (step.kind) {
    case 'charge':
      sfxCharge(step.ms / 1000)
      haptics.charge()
      break
    case 'tease':
      sfxTease(tier)
      break
    case 'burst':
      sfxBurst(tier)
      haptics.burst()
      if (tier >= 4) {
        sfxRainbow()
        sfxSparkle(16)
      }
      if (tier >= 3) void fireConfetti(color)
      break
    default:
      break
  }
}

/* ==================================================================
   背景
   ================================================================== */
function BackdropGlow({
  color,
  tier,
  colorShown,
}: {
  color: string
  tier: number
  colorShown: boolean
}) {
  // 色を伏せる区間はニュートラルな青紫にしておく（＝ネタバレ防止）
  const c = colorShown ? color : '#5b5bff'

  return (
    <>
      <motion.div
        className="pointer-events-none absolute inset-0"
        animate={{
          background: [
            `radial-gradient(circle at 50% 50%, ${c}33, transparent 60%)`,
            `radial-gradient(circle at 50% 50%, ${c}55, transparent 70%)`,
          ],
        }}
        transition={{ duration: 1.6, repeat: Infinity, repeatType: 'reverse' }}
      />
      {colorShown && tier >= 3 && (
        <motion.div
          className="pointer-events-none absolute left-1/2 top-1/2 h-[160vmax] w-[160vmax] -translate-x-1/2 -translate-y-1/2 opacity-25"
          style={{
            background: `conic-gradient(from 0deg, transparent 0deg, ${color} 12deg, transparent 24deg, transparent 36deg, ${color} 48deg, transparent 60deg)`,
          }}
          animate={{ rotate: 360 }}
          transition={{ duration: 12, repeat: Infinity, ease: 'linear' }}
        />
      )}
    </>
  )
}

/* ==================================================================
   チャージ — エネルギーが集まる
   ================================================================== */
function ChargeStage() {
  return (
    <motion.div
      className="absolute inset-0 grid place-items-center"
      exit={{ opacity: 0, transition: { duration: 0.2 } }}
    >
      <div className="relative grid place-items-center">
        {/* 収束するリング */}
        {[0, 1, 2].map((i) => (
          <motion.div
            key={i}
            className="absolute rounded-full border-2 border-accent/70"
            initial={{ width: 420, height: 420, opacity: 0 }}
            animate={{ width: 90, height: 90, opacity: [0, 0.9, 0] }}
            transition={{
              duration: 1.1,
              repeat: Infinity,
              delay: i * 0.36,
              ease: 'easeIn',
            }}
          />
        ))}

        {/* 中心のコア */}
        <motion.div
          className="h-24 w-24 rounded-full"
          style={{
            background:
              'radial-gradient(circle, #fff 0%, #7b2dff 45%, transparent 72%)',
          }}
          animate={{ scale: [1, 1.22, 1], opacity: [0.75, 1, 0.75] }}
          transition={{ duration: 0.62, repeat: Infinity }}
        />

        {/* 吸い込まれる粒子 */}
        {Array.from({ length: 14 }).map((_, i) => {
          const angle = (i / 14) * Math.PI * 2
          const r = 220
          return (
            <motion.span
              key={i}
              className="absolute h-1.5 w-1.5 rounded-full bg-white"
              initial={{
                x: Math.cos(angle) * r,
                y: Math.sin(angle) * r,
                opacity: 0,
              }}
              animate={{ x: 0, y: 0, opacity: [0, 1, 0] }}
              transition={{
                duration: 0.95,
                repeat: Infinity,
                delay: (i % 7) * 0.13,
                ease: 'easeIn',
              }}
            />
          )
        })}
      </div>

      <motion.p
        className="absolute bottom-[22%] text-lg font-bold tracking-[0.35em] text-white/70"
        animate={{ opacity: [0.35, 1, 0.35] }}
        transition={{ duration: 1.1, repeat: Infinity }}
      >
        抽選中
      </motion.p>
    </motion.div>
  )
}

/* ==================================================================
   予告 — 色でレアリティを匂わせる（いわゆる色違い予告）
   ================================================================== */
function TeaseStage({ color, tier }: { color: string; tier: number }) {
  const shake = tier >= 3 ? 14 : tier >= 2 ? 7 : 3

  return (
    <motion.div
      className="absolute inset-0 grid place-items-center"
      animate={{ x: [0, -shake, shake, -shake / 2, shake / 2, 0] }}
      transition={{ duration: 0.45, repeat: 2 }}
      exit={{ opacity: 0, transition: { duration: 0.15 } }}
    >
      <motion.div
        className="h-40 w-40 rounded-full"
        style={{
          background: `radial-gradient(circle, #fff 0%, ${color} 40%, transparent 72%)`,
        }}
        animate={{ scale: [1, 1.5, 1.15, 1.7], opacity: [0.8, 1, 0.9, 1] }}
        transition={{ duration: 0.85 }}
      />

      {/* ひび割れのように走る光 */}
      {Array.from({ length: tier >= 3 ? 8 : 4 }).map((_, i) => (
        <motion.span
          key={i}
          className="absolute h-0.5 origin-left"
          style={{
            width: '46vmax',
            background: `linear-gradient(90deg, ${color}, transparent)`,
            rotate: `${(i / (tier >= 3 ? 8 : 4)) * 360}deg`,
          }}
          initial={{ scaleX: 0, opacity: 0 }}
          animate={{ scaleX: 1, opacity: [0, 1, 0] }}
          transition={{ duration: 0.55, delay: 0.15 + i * 0.03 }}
        />
      ))}

      {tier >= 3 && (
        <motion.p
          className="absolute bottom-[24%] text-4xl font-black italic"
          style={{ color, textShadow: `0 0 24px ${color}` }}
          initial={{ scale: 0.3, opacity: 0, rotate: -8 }}
          animate={{ scale: 1, opacity: 1, rotate: -4 }}
          transition={{ type: 'spring', stiffness: 320, damping: 12 }}
        >
          {RARITY[tier >= 4 ? 'S' : 'A'].hype}
        </motion.p>
      )}
    </motion.div>
  )
}

/* ==================================================================
   開封 — フラッシュ
   ================================================================== */
function BurstStage({ color, tier }: { color: string; tier: number }) {
  return (
    <motion.div
      className="absolute inset-0"
      exit={{ opacity: 0, transition: { duration: 0.25 } }}
    >
      <motion.div
        className="absolute inset-0 bg-white"
        initial={{ opacity: 0 }}
        animate={{ opacity: [0, 1, 0.2] }}
        transition={{ duration: 0.4, times: [0, 0.25, 1] }}
      />
      <motion.div
        className="absolute left-1/2 top-1/2 rounded-full"
        style={{ background: color }}
        initial={{ width: 0, height: 0, x: '-50%', y: '-50%', opacity: 0.9 }}
        animate={{ width: '180vmax', height: '180vmax', opacity: 0 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
      />
      {/* 最高レアだけ、追い打ちで虹の輪を広げる */}
      {tier >= 4 && (
        <motion.div
          className="absolute left-1/2 top-1/2 rounded-full mix-blend-screen"
          style={{
            background:
              'conic-gradient(from 0deg, red, orange, yellow, lime, cyan, blue, magenta, red)',
          }}
          initial={{ width: 0, height: 0, x: '-50%', y: '-50%', opacity: 0.85 }}
          animate={{ width: '200vmax', height: '200vmax', opacity: 0 }}
          transition={{ duration: 0.75, delay: 0.12, ease: 'easeOut' }}
        />
      )}
    </motion.div>
  )
}

/* ==================================================================
   カード公開
   ================================================================== */
function RevealStage({
  card,
  index,
  total,
  onAdvance,
}: {
  card: DrawnCard
  index: number
  total: number
  onAdvance: () => void
}) {
  const r = rarityOf(card.rarity)
  const isRare = r.tier >= 3

  return (
    <motion.div
      className="absolute inset-0 flex cursor-pointer flex-col items-center justify-center px-6"
      onClick={onAdvance}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.18 } }}
    >
      {total > 1 && (
        <p className="absolute top-6 left-1/2 -translate-x-1/2 text-sm font-bold tracking-widest text-white/60">
          {index + 1} / {total}
        </p>
      )}

      {/* レア以上は後光を出す */}
      {isRare && (
        <motion.div
          className="absolute h-[70vmin] w-[70vmin] rounded-full"
          style={{
            background: `radial-gradient(circle, ${r.glow} 0%, transparent 65%)`,
          }}
          animate={{ scale: [1, 1.12, 1], opacity: [0.5, 0.85, 0.5] }}
          transition={{ duration: 1.8, repeat: Infinity }}
        />
      )}

      {/* カード本体：裏から表へ3D反転 */}
      <div className="relative w-[62vmin] max-w-[300px] [perspective:1400px]">
        <motion.div
          className="relative [transform-style:preserve-3d]"
          initial={{ rotateY: 180, scale: 0.75 }}
          animate={{ rotateY: 0, scale: 1 }}
          transition={{
            duration: 0.75,
            delay: 0.12,
            ease: [0.22, 1, 0.36, 1],
          }}
        >
          {/* 表 */}
          <div className="[backface-visibility:hidden]">
            <CardVisual
              name={card.name}
              rarity={card.rarity}
              imageUrl={card.image_url}
              holo={isRare}
              priority
            />
          </div>
          {/* 裏 */}
          <div className="absolute inset-0 [backface-visibility:hidden] [transform:rotateY(180deg)]">
            <CardBack />
          </div>
        </motion.div>
      </div>

      {/* カード名・レアリティ */}
      <motion.div
        className="mt-6 text-center"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.7 }}
      >
        <motion.span
          className="inline-block rounded-lg px-3 py-1 text-sm font-black text-black"
          style={{ background: r.color }}
          initial={{ scale: 2.4, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 400, damping: 14, delay: 0.62 }}
        >
          {r.label}
        </motion.span>

        <p className="mt-3 text-xl font-bold text-white">{card.name}</p>
        <p className="mt-1 text-sm text-white/60">
          ポイント交換：{fmtNum(card.point_value)}pt
        </p>
      </motion.div>

      <motion.p
        className="absolute bottom-10 text-sm text-white/50"
        animate={{ opacity: [0.3, 1, 0.3] }}
        transition={{ duration: 1.4, repeat: Infinity }}
      >
        タップして{index < total - 1 ? '次へ' : '結果を見る'}
      </motion.p>
    </motion.div>
  )
}

/* ==================================================================
   結果一覧
   ================================================================== */
function SummaryStage({
  cards,
  packTitle,
  totalValue,
  onClose,
  onDrawAgain,
}: {
  cards: DrawnCard[]
  packTitle: string
  totalValue: number
  onClose: () => void
  onDrawAgain?: () => void
}) {
  return (
    <motion.div
      className="absolute inset-0 overflow-y-auto"
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
    >
      <div className="mx-auto w-full max-w-2xl px-5 py-10">
        <p className="text-center text-sm text-white/50">{packTitle}</p>
        <h2 className="mt-1 text-center text-3xl font-black">
          <span className="text-gradient">結果</span>
        </h2>

        <div className="mt-8 grid grid-cols-3 gap-3 sm:grid-cols-5">
          {cards.map((c, i) => (
            <motion.div
              key={c.draw_id}
              initial={{ opacity: 0, scale: 0.7, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ delay: i * 0.055, type: 'spring', stiffness: 260 }}
            >
              <CardVisual
                name={c.name}
                rarity={c.rarity}
                imageUrl={c.image_url}
                holo={rarityOf(c.rarity).tier >= 3}
              />
            </motion.div>
          ))}
        </div>

        <div className="mt-8 rounded-2xl border border-line bg-surface/70 p-5 text-center">
          <p className="text-sm text-white/60">ポイント交換した場合の合計</p>
          <p className="mt-1 text-3xl font-black text-gold">
            {fmtNum(totalValue)}
            <span className="ml-1 text-base">pt</span>
          </p>
          <p className="mt-3 text-xs leading-relaxed text-white/50">
            獲得したカードはマイページから
            <br />
            「発送」か「ポイント交換」を選べます。
          </p>
        </div>

        <div className="mt-6 flex flex-col gap-3">
          {onDrawAgain && (
            <button
              type="button"
              onClick={onDrawAgain}
              className="w-full rounded-xl bg-linear-to-r from-brand to-brand-2 py-4 text-base font-black text-white transition hover:brightness-110"
            >
              もう一度引く
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-xl border border-line bg-surface py-3.5 text-base font-bold text-white/80 transition hover:text-white"
          >
            閉じる
          </button>
        </div>
      </div>
    </motion.div>
  )
}

/* ==================================================================
   紙吹雪（重いので必要になった瞬間に読み込む）
   ================================================================== */
async function fireConfetti(color: string) {
  if (typeof window === 'undefined') return
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return

  const { default: confetti } = await import('canvas-confetti')

  confetti({
    particleCount: 90,
    spread: 78,
    origin: { y: 0.55 },
    colors: [color, '#ffffff', '#ffc93c'],
    disableForReducedMotion: true,
  })
  setTimeout(() => {
    confetti({
      particleCount: 55,
      angle: 60,
      spread: 60,
      origin: { x: 0, y: 0.6 },
      colors: [color, '#ffffff'],
      disableForReducedMotion: true,
    })
    confetti({
      particleCount: 55,
      angle: 120,
      spread: 60,
      origin: { x: 1, y: 0.6 },
      colors: [color, '#ffffff'],
      disableForReducedMotion: true,
    })
  }, 180)
}
