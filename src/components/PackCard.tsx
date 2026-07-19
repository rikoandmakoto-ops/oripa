import Image from 'next/image'
import Link from 'next/link'

import { categoryLabel, fmtNum } from '@/lib/format'
import type { OripaPack } from '@/types/db'

export function PackCard({ pack }: { pack: OripaPack }) {
  const soldOut = pack.remaining_slots <= 0
  const soldRatio =
    pack.total_slots > 0
      ? (pack.total_slots - pack.remaining_slots) / pack.total_slots
      : 0

  return (
    <Link
      href={`/packs/${pack.id}`}
      className="group card-surface relative overflow-hidden rounded-2xl transition hover:border-brand/60"
    >
      <div className="relative aspect-[4/3] overflow-hidden bg-surface">
        {pack.image_url ? (
          <Image
            src={pack.image_url}
            alt={pack.title}
            fill
            sizes="(max-width: 640px) 50vw, 300px"
            className="object-cover transition duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="absolute inset-0 bg-linear-to-br from-brand/30 via-brand-2/25 to-accent/20">
            <div className="absolute inset-0 grid place-items-center">
              <span className="text-4xl font-black text-white/25">ORIPA</span>
            </div>
          </div>
        )}

        <span className="absolute left-2 top-2 rounded-md bg-black/70 px-2 py-1 text-[10px] font-bold backdrop-blur">
          {categoryLabel(pack.category)}
        </span>

        {soldOut && (
          <div className="absolute inset-0 grid place-items-center bg-black/70">
            <span className="rotate-[-8deg] rounded-lg border-2 border-ink-dim px-4 py-1.5 text-lg font-black text-ink-dim">
              SOLD OUT
            </span>
          </div>
        )}
      </div>

      <div className="p-3">
        <h3 className="line-clamp-2 text-sm font-bold leading-snug">
          {pack.title}
        </h3>

        <div className="mt-2.5 flex items-baseline gap-1">
          <span className="text-xl font-black text-gold">
            {fmtNum(pack.price_points)}
          </span>
          <span className="text-xs font-medium text-gold/80">pt / 1口</span>
        </div>

        {/* 残り口数のバー。射幸心をあおる部分だが、実在庫と一致している */}
        <div className="mt-2.5">
          <div className="h-1.5 overflow-hidden rounded-full bg-line">
            <div
              className="h-full rounded-full bg-linear-to-r from-brand to-gold transition-[width]"
              style={{ width: `${Math.round(soldRatio * 100)}%` }}
            />
          </div>
          <p className="mt-1.5 text-[11px] text-ink-dim">
            残り{' '}
            <span className="font-bold text-ink">
              {fmtNum(pack.remaining_slots)}
            </span>{' '}
            / {fmtNum(pack.total_slots)} 口
          </p>
        </div>
      </div>
    </Link>
  )
}
