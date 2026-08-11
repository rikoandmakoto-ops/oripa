/**
 * ガチャ演出の構成を決める「演出director」。
 *
 * どの演出をどの順で、何ミリ秒流すかを **ここだけ** で決める。
 * GachaOverlay は組み上がった手順を再生するだけなので、
 * 「SSR のとき何が起きるのか」を知りたければこのファイルを読めば足りる。
 */

/* -------------------------------------------------------------------
   乱数
   演出は「毎回まったく同じ」だと飽きるが、描画のたびに変わっても困る
   （React は同じ描画を何度でもやり直すため）。
   そこでシード付き乱数を使い、1回の抽選の中では必ず同じ結果になるようにする。
   ------------------------------------------------------------------- */

/** 文字列からシード値を作る（djb2） */
export function hashSeed(s: string): number {
  let h = 5381
  for (let i = 0; i < s.length; i++) h = (h * 33) ^ s.charCodeAt(i)
  return h >>> 0
}

/** mulberry32。軽くて分布が十分きれいな疑似乱数 */
export function makeRng(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** 演出の種類。1つ1つが components/gacha/effects の 1コンポーネントに対応する */
export type StepKind =
  | 'freeze' // 画面が一瞬止まるフリーズ演出
  | 'charge' // エネルギーが集まる
  | 'drum' // 和太鼓カウントダウン
  | 'reel' // パチスロ風リール
  | 'cutin' // カットイン
  | 'tease' // 色予告
  | 'crack' // 画面割れ
  | 'burst' // 開封フラッシュ

export type Step = {
  kind: StepKind
  ms: number
}

/** リールの停止パターン。0 が「７」で、数字が小さいほど格が高い */
export const REEL_SYMBOLS = ['7', '★', '◆', 'BAR', '●', '▲', '■', '♣'] as const

/**
 * tier ごとのリール出目。
 * 揃うほど期待度が高い、というスロットの常識をそのまま使う。
 */
const REEL_PATTERNS: Record<number, [number, number, number]> = {
  0: [2, 5, 7], // バラケ目
  1: [4, 4, 6], // テンパイハズレ（惜しい）
  2: [3, 3, 3], // BAR 揃い
  3: [1, 1, 1], // ★揃い
  4: [0, 0, 0], // ７揃い
}

export function reelPattern(tier: number): [number, number, number] {
  return REEL_PATTERNS[clampTier(tier)] ?? REEL_PATTERNS[0]
}

function clampTier(tier: number) {
  return Math.min(4, Math.max(0, Math.round(tier)))
}

/**
 * tier からフル演出の手順を組む。
 *
 * 低レアでもたまに上位演出が混ざるようにしてある（いわゆるガセ演出）。
 * 毎回同じ長さだと「短い＝ハズレ」と一目で分かってしまい、
 * 演出そのものが機能しなくなるため。
 */
export function planSteps(tier: number, rand: () => number): Step[] {
  const t = clampTier(tier)
  const steps: Step[] = []

  // --- 導入 ---------------------------------------------------------
  // フリーズは最高レア確定。ここを見た時点で勝ちが確定する“プレミア”扱い。
  if (t >= 4) steps.push({ kind: 'freeze', ms: 1500 })

  steps.push({ kind: 'charge', ms: t >= 3 ? 1100 : 900 })

  // --- 和太鼓カウントダウン ----------------------------------------
  // tier2 以上は確定。低レアでも 18% で入れてガセにする。
  if (t >= 2 || rand() < 0.18) {
    steps.push({ kind: 'drum', ms: t >= 4 ? 2200 : t >= 3 ? 1900 : 1600 })
  }

  // --- リール -------------------------------------------------------
  // 全レアで必ず通す。ここが演出の背骨。
  steps.push({ kind: 'reel', ms: t >= 4 ? 3400 : t >= 3 ? 3000 : 2500 })

  // --- カットイン ---------------------------------------------------
  // tier3 以上は確定。tier2 は 35% でガセ的に混ぜる。
  if (t >= 3 || (t === 2 && rand() < 0.35)) {
    steps.push({ kind: 'cutin', ms: t >= 4 ? 1400 : 1150 })
  }

  // --- 色予告 -------------------------------------------------------
  if (t >= 2) steps.push({ kind: 'tease', ms: t >= 3 ? 800 : 700 })

  // --- 画面割れ -----------------------------------------------------
  // 最高レア専用。割れたら SSR。
  if (t >= 4) steps.push({ kind: 'crack', ms: 1700 })

  // --- 開封 ---------------------------------------------------------
  steps.push({ kind: 'burst', ms: t >= 4 ? 800 : 500 })

  return steps
}

/** 単体プレビュー用。1つの演出だけを再生する手順を作る */
export function previewSteps(kind: StepKind, tier: number): Step[] {
  const full = planSteps(tier, () => 1) // ガセ抽選を殺して構成を固定する
  const found = full.find((s) => s.kind === kind)
  const steps: Step[] = [found ?? { kind, ms: 1600 }, { kind: 'burst', ms: 450 }]

  // 見たい演出が burst 自身のときは、後ろの締めが重複するので落とす
  return steps.filter((s, i) => i === 0 || s.kind !== steps[0].kind)
}

/**
 * 10連の途中に挟む連続演出を、何枚目の前に入れるか決める。
 * 一番いいカードの直前に差し込むと「ここで来る」という溜めが作れる。
 *
 * @returns 差し込むカードの index。挟まない場合は -1
 */
export function chainIndex(tiers: number[]): number {
  if (tiers.length < 10) return -1

  let bestIdx = -1
  let bestTier = -1
  tiers.forEach((t, i) => {
    if (t > bestTier) {
      bestTier = t
      bestIdx = i
    }
  })

  // 1枚目の前だと開封直後で溜めにならないので出さない
  if (bestTier < 2 || bestIdx <= 0) return -1
  return bestIdx
}

/** 手順の合計尺(ms) */
export function totalMs(steps: Step[]): number {
  return steps.reduce((sum, s) => sum + s.ms, 0)
}
