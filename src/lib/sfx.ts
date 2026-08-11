'use client'

/**
 * ガチャ演出用の効果音。
 *
 * 音声ファイルを一切持たず、WebAudio でその場で合成する。
 * リポジトリを軽く保てて、読み込み待ちで演出がずれることもない。
 *
 * AudioContext はユーザー操作（＝ガチャボタンのタップ）の中で
 * 初期化する必要があるため、prime() を必ずクリックハンドラから呼ぶこと。
 */

let ctx: AudioContext | null = null
let master: GainNode | null = null
let enabled = true

const STORAGE_KEY = 'oripa:sound'

/* -------------------------------------------------------------
   ON/OFF 設定は localStorage が持つ外部ストア。
   useSyncExternalStore から購読できる形にしておくと、
   コンポーネント側で useState + useEffect を書かずに済み、
   SSR とクライアントで初期値がずれてハイドレーションが壊れることもない。
   ------------------------------------------------------------- */
const listeners = new Set<() => void>()

export function subscribeSound(onChange: () => void): () => void {
  listeners.add(onChange)
  return () => {
    listeners.delete(onChange)
  }
}

/** クライアント側の現在値 */
export function isSoundEnabled(): boolean {
  if (typeof window === 'undefined') return true
  return window.localStorage.getItem(STORAGE_KEY) !== 'off'
}

/** サーバー描画時の値。既定は ON。 */
export function getSoundServerSnapshot(): boolean {
  return true
}

export function setSoundEnabled(on: boolean) {
  enabled = on
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(STORAGE_KEY, on ? 'on' : 'off')
  }
  if (master && ctx) {
    master.gain.setTargetAtTime(on ? 0.6 : 0, ctx.currentTime, 0.02)
  }
  listeners.forEach((fn) => fn())
}

/** ユーザー操作の中から呼ぶこと。ここで AudioContext を起こす。 */
export function prime() {
  if (typeof window === 'undefined') return
  enabled = isSoundEnabled()

  if (!ctx) {
    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext
    if (!Ctor) return
    ctx = new Ctor()
    master = ctx.createGain()
    master.gain.value = enabled ? 0.6 : 0

    // 演出が派手になると和太鼓・カットイン・きらめきが同時に鳴って
    // 簡単にクリップするので、出口にコンプレッサーを噛ませて頭を潰す。
    const comp = ctx.createDynamicsCompressor()
    comp.threshold.value = -14
    comp.knee.value = 24
    comp.ratio.value = 8
    comp.attack.value = 0.003
    comp.release.value = 0.2

    master.connect(comp).connect(ctx.destination)
  }
  // iOS はタブ復帰などで suspended になるので毎回起こす
  if (ctx.state === 'suspended') void ctx.resume()
}

function ready(): { ac: AudioContext; out: GainNode } | null {
  if (!ctx || !master || !enabled) return null
  return { ac: ctx, out: master }
}

/** 単純なエンベロープ付きオシレータ */
function tone(
  freq: number,
  duration: number,
  opts: {
    type?: OscillatorType
    delay?: number
    gain?: number
    sweepTo?: number
  } = {}
) {
  const r = ready()
  if (!r) return
  const { ac, out } = r
  const t0 = ac.currentTime + (opts.delay ?? 0)
  const g = opts.gain ?? 0.3

  const osc = ac.createOscillator()
  osc.type = opts.type ?? 'sine'
  osc.frequency.setValueAtTime(freq, t0)
  if (opts.sweepTo) {
    osc.frequency.exponentialRampToValueAtTime(
      Math.max(1, opts.sweepTo),
      t0 + duration
    )
  }

  const env = ac.createGain()
  env.gain.setValueAtTime(0.0001, t0)
  env.gain.exponentialRampToValueAtTime(g, t0 + 0.012)
  env.gain.exponentialRampToValueAtTime(0.0001, t0 + duration)

  osc.connect(env).connect(out)
  osc.start(t0)
  osc.stop(t0 + duration + 0.05)
}

/** ホワイトノイズ（衝撃音・きらめき用） */
function noise(
  duration: number,
  opts: { delay?: number; gain?: number; hp?: number; lp?: number } = {}
) {
  const r = ready()
  if (!r) return
  const { ac, out } = r
  const t0 = ac.currentTime + (opts.delay ?? 0)

  const frames = Math.floor(ac.sampleRate * duration)
  const buf = ac.createBuffer(1, frames, ac.sampleRate)
  const data = buf.getChannelData(0)
  for (let i = 0; i < frames; i++) {
    // 終端に向けて減衰させる
    data[i] = (Math.random() * 2 - 1) * (1 - i / frames)
  }

  const src = ac.createBufferSource()
  src.buffer = buf

  const filter = ac.createBiquadFilter()
  filter.type = opts.hp ? 'highpass' : 'lowpass'
  filter.frequency.value = opts.hp ?? opts.lp ?? 8000

  const env = ac.createGain()
  env.gain.value = opts.gain ?? 0.2

  src.connect(filter).connect(env).connect(out)
  src.start(t0)
}

/** 抽選開始：エネルギーが溜まっていく上昇音 */
export function sfxCharge(duration = 1.2) {
  tone(120, duration, { type: 'sawtooth', gain: 0.12, sweepTo: 900 })
  tone(180, duration, { type: 'sine', gain: 0.08, sweepTo: 1400, delay: 0.05 })
}

/** 予告：レアリティが高いほど高い音で「カッ」と鳴る */
export function sfxTease(tier: number) {
  const base = 440 + tier * 160
  tone(base, 0.18, { type: 'triangle', gain: 0.25 })
  tone(base * 1.5, 0.14, { type: 'sine', gain: 0.15, delay: 0.02 })
}

/** 開封の衝撃音 */
export function sfxBurst(tier: number) {
  noise(0.5, { gain: 0.28, lp: 6000 })
  tone(70, 0.5, { type: 'sine', gain: 0.4, sweepTo: 30 })
  if (tier >= 3) {
    tone(1200, 0.3, { type: 'square', gain: 0.08, delay: 0.02, sweepTo: 2400 })
  }
}

/** カードが出たときのチャイム。tier が高いほど豪華な和音になる */
export function sfxReveal(tier: number) {
  // C メジャー系のペンタトニックで積む
  const chords: Record<number, number[]> = {
    0: [523.25],
    1: [523.25, 659.25],
    2: [523.25, 659.25, 783.99],
    3: [523.25, 659.25, 783.99, 1046.5],
    4: [523.25, 659.25, 783.99, 1046.5, 1318.5],
  }
  const notes = chords[Math.min(4, Math.max(0, tier))] ?? chords[0]
  notes.forEach((f, i) => {
    tone(f, tier >= 3 ? 1.4 : 0.7, {
      type: 'triangle',
      gain: 0.16,
      delay: i * (tier >= 3 ? 0.07 : 0.03),
    })
  })
  if (tier >= 3) {
    noise(0.9, { gain: 0.06, hp: 6000, delay: 0.1 })
  }
}

/** SSR 専用のファンファーレ */
export function sfxFanfare() {
  const seq = [523.25, 659.25, 783.99, 1046.5]
  seq.forEach((f, i) => {
    tone(f, 0.45, { type: 'square', gain: 0.1, delay: i * 0.09 })
    tone(f / 2, 0.45, { type: 'sine', gain: 0.12, delay: i * 0.09 })
  })
  noise(1.2, { gain: 0.05, hp: 5000, delay: 0.3 })
}

/** カードめくり */
export function sfxFlip() {
  noise(0.12, { gain: 0.12, hp: 2000 })
}

/* ===================================================================
   ここから下は大型演出用の効果音。
   リール・和太鼓・カットイン・画面割れなど、
   演出コンポーネントと 1 対 1 で対応する。
   =================================================================== */

/**
 * バンドパスを掃引するノイズ。
 * 「シュンッ」というスウッシュ系はこれ 1 本で作れる。
 */
function swoosh(
  duration: number,
  fromHz: number,
  toHz: number,
  opts: { delay?: number; gain?: number; q?: number } = {}
) {
  const r = ready()
  if (!r) return
  const { ac, out } = r
  const t0 = ac.currentTime + (opts.delay ?? 0)

  const frames = Math.floor(ac.sampleRate * duration)
  const buf = ac.createBuffer(1, frames, ac.sampleRate)
  const data = buf.getChannelData(0)
  for (let i = 0; i < frames; i++) data[i] = Math.random() * 2 - 1

  const src = ac.createBufferSource()
  src.buffer = buf

  const filter = ac.createBiquadFilter()
  filter.type = 'bandpass'
  filter.Q.value = opts.q ?? 4
  filter.frequency.setValueAtTime(fromHz, t0)
  filter.frequency.exponentialRampToValueAtTime(Math.max(1, toHz), t0 + duration)

  const env = ac.createGain()
  env.gain.setValueAtTime(0.0001, t0)
  env.gain.exponentialRampToValueAtTime(opts.gain ?? 0.3, t0 + duration * 0.35)
  env.gain.exponentialRampToValueAtTime(0.0001, t0 + duration)

  src.connect(filter).connect(env).connect(out)
  src.start(t0)
}

/**
 * 和太鼓の「ドンッ」。
 * 低音の急激なピッチ落ち＋皮の鳴りのノイズで作る。
 * @param power 0〜1。大きいほど深く重い音になる（カウントダウンの終盤で上げる）
 */
export function sfxDrum(power = 0.6, delay = 0) {
  const top = 150 + power * 110
  // 胴の響き
  tone(top, 0.42 + power * 0.25, {
    type: 'sine',
    gain: 0.34 + power * 0.24,
    sweepTo: 44,
    delay,
  })
  // 倍音（張りを出す）
  tone(top * 1.6, 0.16, {
    type: 'triangle',
    gain: 0.1 + power * 0.08,
    sweepTo: 70,
    delay,
  })
  // 皮のアタック
  noise(0.1, { gain: 0.16 + power * 0.14, lp: 1400, delay })
}

/** リール回転中のカラカラ音。duration 秒ぶんをまとめて予約する */
export function sfxReelSpin(duration: number) {
  const step = 0.055
  const count = Math.floor(duration / step)
  for (let i = 0; i < count; i++) {
    noise(0.02, { gain: 0.045, hp: 2600, delay: i * step })
  }
  // 回転そのもののうなり
  tone(90, duration, { type: 'sawtooth', gain: 0.05, sweepTo: 130 })
}

/**
 * リールが 1 本止まる「ガコンッ」。
 * @param index 何本目か。後のリールほど低く重く鳴らして緊張感を出す
 */
export function sfxReelStop(index: number, delay = 0) {
  const pitch = 260 - index * 45
  tone(pitch, 0.12, { type: 'square', gain: 0.2, sweepTo: pitch * 0.6, delay })
  noise(0.09, { gain: 0.2, hp: 1200, delay })
  tone(pitch / 2, 0.22, { type: 'sine', gain: 0.16, sweepTo: 50, delay })
}

/** テンパイ（あと 1 本で揃う）ときの持続音 */
export function sfxTenpai() {
  tone(880, 1.1, { type: 'triangle', gain: 0.1 })
  tone(1320, 1.1, { type: 'sine', gain: 0.06, delay: 0.04 })
}

/** カットイン。切り裂くようなスウッシュ＋衝撃 */
export function sfxCutIn(tier: number) {
  swoosh(0.36, 5200, 320, { gain: 0.34, q: 3 })
  tone(180, 0.3, { type: 'sawtooth', gain: 0.22, sweepTo: 60, delay: 0.24 })
  noise(0.22, { gain: 0.22, lp: 5000, delay: 0.24 })
  if (tier >= 4) {
    // 最高レアはもう一撃返す
    swoosh(0.3, 400, 6000, { gain: 0.26, q: 3, delay: 0.42 })
    tone(1046.5, 0.5, { type: 'square', gain: 0.1, delay: 0.5 })
  }
}

/**
 * フリーズ突入音。
 * いったん空気を抜いてから極低音で押し潰す、パチンコのフリーズの質感。
 */
export function sfxFreeze() {
  // 吸い込み（逆再生ふうの上昇→切断）
  swoosh(0.5, 200, 4800, { gain: 0.24, q: 2 })
  // 底が抜ける
  tone(58, 1.5, { type: 'sine', gain: 0.4, sweepTo: 28, delay: 0.5 })
  tone(87, 1.4, { type: 'sine', gain: 0.16, sweepTo: 42, delay: 0.52 })
  // 金属的な余韻
  tone(2400, 1.2, { type: 'sine', gain: 0.05, sweepTo: 1800, delay: 0.55 })
}

/** ヒビが 1 本入る音。連続で呼んで割れていく過程を作る */
export function sfxCrack(delay = 0, pitch = 1) {
  noise(0.07, { gain: 0.2, hp: 4000, delay })
  tone(2600 * pitch, 0.09, {
    type: 'square',
    gain: 0.07,
    sweepTo: 1200 * pitch,
    delay,
  })
}

/** 画面が砕け散る音。破片が降る余韻付き */
export function sfxShatter() {
  noise(0.6, { gain: 0.34, hp: 1800 })
  tone(120, 0.5, { type: 'sine', gain: 0.34, sweepTo: 34 })
  // 破片が跳ねる高音を散らす
  for (let i = 0; i < 14; i++) {
    tone(1800 + Math.random() * 3600, 0.16, {
      type: 'triangle',
      gain: 0.05,
      delay: 0.06 + Math.random() * 0.7,
    })
  }
}

/** レインボー突入。上昇アルペジオ＋きらめき */
export function sfxRainbow() {
  const scale = [523.25, 587.33, 659.25, 783.99, 880, 1046.5, 1318.5, 1568]
  scale.forEach((f, i) => {
    tone(f, 0.6, { type: 'triangle', gain: 0.13, delay: i * 0.055 })
    tone(f * 2, 0.4, { type: 'sine', gain: 0.05, delay: i * 0.055 + 0.01 })
  })
  noise(1.6, { gain: 0.07, hp: 7000, delay: 0.3 })
  tone(65.4, 1.8, { type: 'sine', gain: 0.2 })
}

/** 10 連の途中に挟まる連続演出の合図。「デデーン」 */
export function sfxChain() {
  sfxDrum(0.85)
  sfxDrum(0.95, 0.22)
  tone(392, 0.7, { type: 'square', gain: 0.12, delay: 0.24 })
  tone(523.25, 0.7, { type: 'square', gain: 0.12, delay: 0.3 })
  noise(0.9, { gain: 0.06, hp: 6000, delay: 0.3 })
}

/** 粒子が舞うきらめき。パーティクル演出に薄く重ねる */
export function sfxSparkle(count = 10) {
  for (let i = 0; i < count; i++) {
    tone(2200 + Math.random() * 2800, 0.22, {
      type: 'sine',
      gain: 0.04,
      delay: Math.random() * 0.9,
    })
  }
}
