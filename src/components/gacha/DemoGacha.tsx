'use client'

import { useState } from 'react'

import { DEMO_PACKS, demoDraw, demoOdds, type DemoPack } from '@/lib/demo-packs'
import { categoryLabel, fmtNum, fmtPt } from '@/lib/format'
import { previewSteps, type Step, type StepKind } from '@/lib/gacha-director'
import { RARITY } from '@/lib/rarity'
import { prime } from '@/lib/sfx'
import type { DrawnCard, Rarity } from '@/types/db'

import { GachaOverlay } from './GachaOverlay'

const START_BALANCE = 50000

/** レアリティ別のフル演出。SSR は 0.2% なので引き当てを待たずに見られるようにする */
const EFFECT_DEMOS: { rarity: Rarity; label: string; hint: string }[] = [
  { rarity: 'D', label: '通常', hint: 'リール＋開封' },
  { rarity: 'B', label: 'チャンス', hint: '和太鼓＋色予告' },
  { rarity: 'A', label: '激アツ', hint: 'カットイン＋紙吹雪' },
  { rarity: 'S', label: '神引き', hint: 'フリーズ〜画面割れ全部乗せ' },
]

/**
 * 単体演出のプレビュー。
 * フル演出だと目当ての演出まで待たされるので、1つずつ切り出して見せる。
 * tier は「その演出が最も映えるレアリティ」を指定している。
 */
const STEP_DEMOS: {
  kind: StepKind
  tier: number
  label: string
  hint: string
}[] = [
  { kind: 'reel', tier: 4, label: 'リール回転', hint: '７揃いで最高レア' },
  { kind: 'reel', tier: 1, label: 'リール（ハズレ）', hint: 'テンパイから転落' },
  { kind: 'drum', tier: 3, label: 'ドラム', hint: '和太鼓カウントダウン' },
  { kind: 'cutin', tier: 4, label: 'カットイン', hint: '二段構えで返す' },
  { kind: 'freeze', tier: 4, label: 'フリーズ', hint: '出た時点で確定' },
  { kind: 'crack', tier: 4, label: '画面割れ', hint: 'ヒビ→粉砕' },
  { kind: 'burst', tier: 4, label: 'レインボー', hint: '虹色に光る開放' },
  { kind: 'tease', tier: 3, label: '色予告', hint: '色でレアを匂わせる' },
]

/** tier から代表レアリティを引く。単体演出プレビューで使う */
const RARITY_BY_TIER: Record<number, Rarity> = {
  0: 'D',
  1: 'C',
  2: 'B',
  3: 'A',
  4: 'S',
}

export function DemoGacha() {
  const [balance, setBalance] = useState(START_BALANCE)
  const [pack, setPack] = useState<DemoPack | null>(null)
  const [cards, setCards] = useState<DrawnCard[] | null>(null)
  const [seq, setSeq] = useState(0)
  const [lastCount, setLastCount] = useState(1)
  /** 演出プレビュー中は「もう一度引く」を出さない（ポイントを消費していないため） */
  const [isEffect, setIsEffect] = useState(false)
  /** 単体演出プレビューのときだけ入る。null なら director が構成を決める */
  const [plan, setPlan] = useState<Step[] | null>(null)

  function draw(target: DemoPack, count: number) {
    const cost = target.price_points * count
    if (balance < cost) return
    prime()
    setBalance((b) => b - cost)
    setIsEffect(false)
    setPlan(null)
    setLastCount(count)
    setSeq((s) => s + 1)
    setCards(demoDraw(target, count, seq + 1))
  }

  /** 指定レアリティのカードを1枚でっち上げる */
  function sampleCard(target: DemoPack, rarity: Rarity, id: string): DrawnCard {
    const sample =
      target.cards.find((c) => c.rarity === rarity) ?? target.cards[0]
    return {
      draw_id: `${target.id}-${id}`,
      card_id: `${target.id}-${id}-${rarity}`,
      name: sample.name,
      rarity: sample.rarity,
      image_url: null,
      point_value: sample.point_value,
      is_hit: sample.is_hit,
    }
  }

  /** ポイントを消費せず、指定レアリティのフル演出を再生する */
  function playEffect(target: DemoPack, rarity: Rarity) {
    prime()
    setIsEffect(true)
    setPlan(null)
    setLastCount(1)
    setSeq((s) => s + 1)
    setCards([sampleCard(target, rarity, `effect-${seq + 1}`)])
  }

  /** 単体の演出だけを切り出して再生する */
  function playStep(target: DemoPack, kind: StepKind, tier: number) {
    const rarity = RARITY_BY_TIER[tier] ?? 'S'
    prime()
    setIsEffect(true)
    setPlan(previewSteps(kind, tier))
    setLastCount(1)
    setSeq((s) => s + 1)
    setCards([sampleCard(target, rarity, `step-${kind}-${seq + 1}`)])
  }

  /**
   * 連続演出のプレビュー。
   * 10連の途中で割り込む演出なので、当たりを後ろ寄りに置いた10枚を作る。
   */
  function playChain(target: DemoPack) {
    prime()
    setIsEffect(true)
    setPlan(null)
    setLastCount(10)
    setSeq((s) => s + 1)
    setCards(
      Array.from({ length: 10 }, (_, i) =>
        sampleCard(target, i === 6 ? 'A' : 'D', `chain-${seq + 1}-${i}`)
      )
    )
  }

  return (
    <div className="py-4">
      <header className="text-center">
        <span className="inline-block rounded-full border border-brand/40 bg-brand/10 px-3 py-1 text-xs font-bold text-brand">
          DEMO
        </span>
        <h1 className="mt-3 text-2xl font-black sm:text-3xl">ガチャ体験デモ</h1>
        <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-ink-dim">
          ログインもポイント購入も不要。実際のオリパと同じ演出をそのまま体験できます。
          <br />
          カードと抽選結果はすべてデモ用のダミーデータです。
        </p>
      </header>

      <div className="mt-5 flex items-center justify-between rounded-xl border border-line bg-surface/60 px-4 py-3">
        <div>
          <span className="block text-xs text-ink-dim">デモ残高</span>
          <span className="text-xl font-black text-gold">{fmtPt(balance)}</span>
        </div>
        <button
          type="button"
          onClick={() => setBalance(START_BALANCE)}
          className="rounded-lg border border-line bg-surface px-3 py-2 text-xs font-bold transition hover:border-brand"
        >
          残高をリセット
        </button>
      </div>

      {pack === null ? (
        <PackList onSelect={setPack} />
      ) : (
        <PackDetail
          pack={pack}
          balance={balance}
          onBack={() => setPack(null)}
          onDraw={(count) => draw(pack, count)}
          onEffect={(rarity) => playEffect(pack, rarity)}
          onStep={(kind, tier) => playStep(pack, kind, tier)}
          onChain={() => playChain(pack)}
        />
      )}

      {cards && pack && (
        // seq を key にして、続けて引いたときに演出を最初からやり直させる
        <GachaOverlay
          key={seq}
          cards={cards}
          packTitle={pack.title}
          plan={plan ?? undefined}
          onClose={() => setCards(null)}
          onDrawAgain={
            !isEffect && balance >= pack.price_points * lastCount
              ? () => draw(pack, lastCount)
              : undefined
          }
        />
      )}
    </div>
  )
}

function PackList({ onSelect }: { onSelect: (p: DemoPack) => void }) {
  return (
    <section className="mt-6">
      <h2 className="text-sm font-bold text-ink-dim">パックを選ぶ</h2>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        {DEMO_PACKS.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => onSelect(p)}
            className="card-surface overflow-hidden rounded-2xl border border-line text-left transition hover:border-brand"
          >
            <div
              className={`flex h-28 items-center justify-center bg-linear-to-br ${p.accent}`}
            >
              <span className="px-4 text-center text-lg font-black text-white drop-shadow">
                {p.title}
              </span>
            </div>
            <div className="p-4">
              <span className="text-xs text-ink-dim">
                {categoryLabel(p.category)}
              </span>
              <p className="mt-1 text-sm leading-relaxed text-ink-dim">
                {p.catch}
              </p>
              <span className="mt-2 block font-black text-gold">
                {fmtPt(p.price_points)} / 1口
              </span>
            </div>
          </button>
        ))}
      </div>
    </section>
  )
}

function PackDetail({
  pack,
  balance,
  onBack,
  onDraw,
  onEffect,
  onStep,
  onChain,
}: {
  pack: DemoPack
  balance: number
  onBack: () => void
  onDraw: (count: number) => void
  onEffect: (rarity: Rarity) => void
  onStep: (kind: StepKind, tier: number) => void
  onChain: () => void
}) {
  const odds = demoOdds(pack)

  return (
    <section className="mt-6 pb-32">
      <button
        type="button"
        onClick={onBack}
        className="text-sm text-ink-dim transition hover:text-ink"
      >
        ← パック一覧に戻る
      </button>

      <div
        className={`mt-3 flex h-36 items-center justify-center rounded-2xl bg-linear-to-br ${pack.accent}`}
      >
        <span className="px-6 text-center text-xl font-black text-white drop-shadow">
          {pack.title}
        </span>
      </div>

      <p className="mt-3 text-sm leading-relaxed text-ink-dim">{pack.catch}</p>

      <h3 className="mt-6 text-sm font-bold">排出確率</h3>
      <ul className="mt-2 space-y-1.5">
        {odds.map(({ rarity, percent }) => {
          const style = RARITY[rarity]
          return (
            <li
              key={rarity}
              className="flex items-center gap-3 rounded-lg border border-line bg-surface/60 px-3 py-2"
            >
              <span
                className="w-11 shrink-0 rounded px-1.5 py-0.5 text-center text-xs font-black"
                style={{ background: style.gradient, color: '#07070c' }}
              >
                {style.label}
              </span>
              <span className="flex-1 text-xs text-ink-dim">
                {style.hype ? `${style.hype}演出` : '通常演出'}
              </span>
              <span className="text-sm font-bold tabular-nums">
                {percent < 1 ? percent.toFixed(2) : percent.toFixed(1)}%
              </span>
            </li>
          )
        })}
      </ul>

      <h3 className="mt-8 text-sm font-bold">演出プレビュー</h3>
      <p className="mt-1 text-xs leading-relaxed text-ink-dim">
        ポイントを消費せずに演出だけを確認できます。
      </p>

      <p className="mt-4 text-xs font-bold text-ink-dim">
        レアリティ別のフル演出
      </p>
      <div className="mt-2 grid grid-cols-2 gap-2">
        {EFFECT_DEMOS.map((e) => (
          <button
            key={e.rarity}
            type="button"
            onClick={() => onEffect(e.rarity)}
            className="rounded-xl border border-line bg-surface/60 px-3 py-2.5 text-left transition hover:border-brand"
            style={{ borderLeft: `3px solid ${RARITY[e.rarity].color}` }}
          >
            <span className="block text-sm font-bold">{e.label}</span>
            <span className="mt-0.5 block text-xs text-ink-dim">{e.hint}</span>
          </button>
        ))}
      </div>

      <p className="mt-5 text-xs font-bold text-ink-dim">単体の演出</p>
      <div className="mt-2 grid grid-cols-2 gap-2">
        {STEP_DEMOS.map((s) => (
          <button
            key={`${s.kind}-${s.tier}`}
            type="button"
            onClick={() => onStep(s.kind, s.tier)}
            className="rounded-xl border border-line bg-surface/60 px-3 py-2.5 text-left transition hover:border-brand"
          >
            <span className="block text-sm font-bold">{s.label}</span>
            <span className="mt-0.5 block text-xs text-ink-dim">{s.hint}</span>
          </button>
        ))}
      </div>

      <button
        type="button"
        onClick={onChain}
        className="mt-2 w-full rounded-xl border border-line bg-surface/60 px-3 py-2.5 text-left transition hover:border-brand"
      >
        <span className="block text-sm font-bold">連続演出（10連）</span>
        <span className="mt-0.5 block text-xs text-ink-dim">
          7枚目の当たりの直前に割り込みます
        </span>
      </button>

      <h3 className="mt-6 text-sm font-bold">主な当たりカード</h3>
      <ul className="mt-2 space-y-1.5">
        {pack.cards
          .filter((c) => c.is_hit)
          .map((c) => (
            <li
              key={c.name}
              className="flex items-center justify-between rounded-lg border border-line bg-surface/60 px-3 py-2"
            >
              <span className="text-sm">{c.name}</span>
              <span
                className="text-sm font-bold tabular-nums"
                style={{ color: RARITY[c.rarity].color }}
              >
                {fmtNum(c.point_value)}pt
              </span>
            </li>
          ))}
      </ul>

      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-bg/95 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur">
        <div className="mx-auto flex max-w-6xl gap-2">
          {[1, 10].map((count) => {
            const cost = pack.price_points * count
            const enough = balance >= cost
            return (
              <button
                key={count}
                type="button"
                disabled={!enough}
                onClick={() => onDraw(count)}
                className={`flex-1 rounded-xl py-3.5 font-black text-white transition ${
                  enough
                    ? `bg-linear-to-r ${pack.accent} hover:brightness-110`
                    : 'cursor-not-allowed bg-surface-2 text-ink-dim'
                }`}
              >
                <span className="block">{count}連で引く</span>
                <span className="block text-xs font-bold opacity-80">
                  {enough ? fmtPt(cost) : '残高不足'}
                </span>
              </button>
            )
          })}
        </div>
      </div>
    </section>
  )
}
