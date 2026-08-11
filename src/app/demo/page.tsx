import type { Metadata } from 'next'

import { DemoGacha } from '@/components/gacha/DemoGacha'

export const metadata: Metadata = {
  title: 'ガチャ体験デモ',
  description:
    'ログイン不要・ポイント消費なしで、オリパのガチャ演出をそのまま体験できるデモページです。',
}

export default function DemoPage() {
  return <DemoGacha />
}
