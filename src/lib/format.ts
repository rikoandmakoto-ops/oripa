/** 12345 -> "12,345" */
export function fmtNum(n: number | null | undefined): string {
  return (n ?? 0).toLocaleString('ja-JP')
}

/** ポイント表記 */
export function fmtPt(n: number | null | undefined): string {
  return `${fmtNum(n)}pt`
}

/** 排出確率。0.5% 未満は "0.5%未満" と出す（丸めて 0.0% と表示しないため） */
export function fmtProbability(remaining: number, total: number): string {
  if (total <= 0) return '—'
  const p = (remaining / total) * 100
  if (p === 0) return '0%'
  if (p < 0.01) return '0.01%未満'
  if (p < 1) return `${p.toFixed(2)}%`
  return `${p.toFixed(1)}%`
}

export function fmtDate(iso: string): string {
  return new Date(iso).toLocaleString('ja-JP', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export const CATEGORY_LABELS: Record<string, string> = {
  pokemon: 'ポケモンカード',
  yugioh: '遊戯王',
  onepiece: 'ワンピースカード',
  mtg: 'マジック:ザ・ギャザリング',
  duelmasters: 'デュエル・マスターズ',
  shadowverse: 'シャドウバースEVOLVE',
  weiss: 'ヴァイスシュヴァルツ',
  other: 'その他',
}

export function categoryLabel(key: string): string {
  return CATEGORY_LABELS[key] ?? key
}
