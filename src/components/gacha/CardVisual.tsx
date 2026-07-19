'use client'

import Image from 'next/image'

import { rarityOf } from '@/lib/rarity'

type Props = {
  name: string
  rarity: string
  imageUrl?: string | null
  /** ホロ加工の光沢を走らせる（レア演出用） */
  holo?: boolean
  className?: string
  priority?: boolean
}

/**
 * カード1枚の見た目。画像が未登録でもレアリティ色のグラデーションで
 * それらしく見えるようにしてある（管理者が画像を入れる前でも成立させるため）。
 */
export function CardVisual({
  name,
  rarity,
  imageUrl,
  holo = false,
  className = '',
  priority = false,
}: Props) {
  const r = rarityOf(rarity)

  return (
    <div
      className={`relative aspect-[63/88] w-full overflow-hidden rounded-xl ${className}`}
      style={{
        // レアリティ色の縁取り
        boxShadow: `0 0 0 2px ${r.color}, 0 8px 32px -8px ${r.glow}`,
      }}
    >
      {/* 背景（カード画像 or レアリティ色のフォールバック） */}
      {imageUrl ? (
        <Image
          src={imageUrl}
          alt={name}
          fill
          sizes="(max-width: 640px) 45vw, 220px"
          className="object-cover"
          priority={priority}
        />
      ) : (
        <div
          className="absolute inset-0"
          style={{ background: r.gradient, backgroundSize: '200% 200%' }}
        >
          <div className="absolute inset-0 bg-black/45" />
        </div>
      )}

      {/* ホロ光沢。カード名より先に敷いて、文字が霞まないようにする */}
      {holo && (
        <div
          className="pointer-events-none absolute inset-0 opacity-70 mix-blend-overlay"
          style={{
            background:
              'linear-gradient(105deg, transparent 30%, rgba(255,255,255,.85) 45%, rgba(255,255,255,.2) 55%, transparent 70%)',
            backgroundSize: '250% 100%',
            animation: 'shimmer 2.2s linear infinite',
          }}
        />
      )}

      {/* 画像未登録のときだけ、カード名を絵柄の代わりに出す */}
      {!imageUrl && (
        <div className="absolute inset-0 grid place-items-center p-3">
          <span
            className="text-center text-[11px] font-bold leading-tight text-white"
            style={{ textShadow: '0 1px 4px rgba(0,0,0,.9)' }}
          >
            {name}
          </span>
        </div>
      )}

      {/* レアリティバッジ */}
      <span
        className="absolute left-1.5 top-1.5 rounded-md px-1.5 py-0.5 text-[10px] font-black tracking-wide text-black"
        style={{ background: r.color }}
      >
        {r.label}
      </span>
    </div>
  )
}

/** 裏面（めくる前） */
export function CardBack({ className = '' }: { className?: string }) {
  return (
    <div
      className={`relative aspect-[63/88] w-full overflow-hidden rounded-xl border-2 border-brand-2/60 ${className}`}
      style={{
        background:
          'repeating-linear-gradient(45deg, #1a1030 0 10px, #241245 10px 20px)',
        boxShadow: '0 0 40px -10px rgba(123,45,255,.8)',
      }}
    >
      <div className="absolute inset-0 grid place-items-center">
        <div className="grid h-14 w-14 place-items-center rounded-full bg-linear-to-br from-brand to-brand-2 text-xl font-black text-white shadow-lg">
          O
        </div>
      </div>
      <div
        className="pointer-events-none absolute inset-0 opacity-40"
        style={{
          background:
            'linear-gradient(105deg, transparent 35%, rgba(255,255,255,.5) 50%, transparent 65%)',
          backgroundSize: '250% 100%',
          animation: 'shimmer 3s linear infinite',
        }}
      />
    </div>
  )
}
