import { notFound } from 'next/navigation'

import { GachaPreview } from '@/components/gacha/GachaPreview'

/**
 * ガチャ演出のプレビュー。
 * ポイントを消費せず、DB も使わずに演出だけを確認・調整するための画面。
 * 本番ビルドでは 404 になる。
 */
export default function DevGachaPage() {
  if (process.env.NODE_ENV === 'production') notFound()
  return <GachaPreview />
}
