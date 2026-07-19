'use client'

/**
 * 触覚フィードバック。対応していない端末では黙って何もしない。
 * （iOS Safari は navigator.vibrate 非対応なので実質 Android 向け）
 */
function buzz(pattern: number | number[]) {
  if (typeof navigator === 'undefined') return
  if (typeof navigator.vibrate !== 'function') return
  // 「視差効果を減らす」設定の人には振動も出さない
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return
  try {
    navigator.vibrate(pattern)
  } catch {
    // 一部端末で SecurityError を投げることがあるので無視
  }
}

export const haptics = {
  tap: () => buzz(10),
  charge: () => buzz([0, 40, 60, 40, 60, 80]),
  burst: () => buzz(120),
  /** レアリティに応じた当選時の振動 */
  reveal: (tier: number) => {
    if (tier >= 4) buzz([0, 80, 50, 80, 50, 200])
    else if (tier >= 3) buzz([0, 60, 40, 120])
    else if (tier >= 2) buzz(50)
    else buzz(15)
  },
}
