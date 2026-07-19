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
    master.connect(ctx.destination)
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
