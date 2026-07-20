"use client";

import Image from "next/image";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { Input } from "@/components/ui/field";
import {
  GIFT_CATALOG,
  findGiftById,
  normalizeGiftName,
  type GiftCatalogEntry,
} from "@/lib/data/gift-catalog";
import { cn } from "@/lib/utils";

/**
 * Hediye seçici — `gift_specific` tetikleyicisinin koşul alanı.
 *
 * TikTok'un kendi hediye panelindeki gibi ikon + ad + coin değeri gösteren
 * aranabilir bir ızgara. Düz `<select>` yerine kullanılır çünkü yayıncı
 * hediyeyi adından çok ikonundan tanır.
 *
 * Erişilebilirlik: ızgara `radiogroup`, her hediye bir `radio` — ok tuşlarına
 * gerek kalmadan Tab/Enter ile gezilebilir, seçili olan `aria-checked`.
 */
export function GiftPicker({
  value,
  onChange,
  id,
}: {
  /** Seçili hediyenin katalog slug'ı. */
  value?: string;
  onChange: (gift: GiftCatalogEntry) => void;
  id?: string;
}) {
  const t = useTranslations();
  const [query, setQuery] = useState("");

  const selected = value ? findGiftById(value) : undefined;

  const results = useMemo(() => {
    const q = normalizeGiftName(query);
    if (!q) return GIFT_CATALOG;
    return GIFT_CATALOG.filter((g) => normalizeGiftName(g.name).includes(q));
  }, [query]);

  return (
    <div className="flex flex-col gap-2">
      {/* Seçili hediye özeti */}
      <div className="flex items-center gap-2.5 rounded-lg border border-border-soft bg-surface-2 px-3 py-2">
        {selected ? (
          <>
            <GiftIcon gift={selected} size={32} />
            <span className="truncate text-sm font-medium text-white">{selected.name}</span>
            <CoinBadge gift={selected} />
          </>
        ) : (
          <span className="text-sm text-muted">
            {t("actionsandevents.eventEditor.giftNone")}
          </span>
        )}
      </div>

      <Input
        id={id}
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={t("actionsandevents.eventEditor.giftSearch")}
        aria-label={t("actionsandevents.eventEditor.giftSearch")}
      />

      {results.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted">
          {t("actionsandevents.eventEditor.giftNoResults")}
        </p>
      ) : (
        <div
          role="radiogroup"
          aria-label={t("actionsandevents.eventEditor.giftLabel")}
          className="grid max-h-64 grid-cols-3 gap-1.5 overflow-y-auto rounded-lg border border-border-soft bg-surface-1 p-1.5 sm:grid-cols-4"
        >
          {results.map((g) => {
            const isSelected = g.id === value;
            return (
              <button
                key={g.id}
                type="button"
                role="radio"
                aria-checked={isSelected}
                onClick={() => onChange(g)}
                className={cn(
                  "flex flex-col items-center gap-1 rounded-lg border p-2 text-center",
                  "transition-colors duration-200 ease-[var(--ease-standard)]",
                  "focus:outline-none focus-visible:border-link",
                  isSelected
                    ? "border-[var(--primary)] bg-surface-3"
                    : "border-transparent hover:bg-surface-2",
                )}
              >
                <GiftIcon gift={g} size={44} />
                <span className="line-clamp-2 text-[11px] leading-tight text-white">
                  {g.name}
                </span>
                <CoinBadge gift={g} />
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function GiftIcon({ gift, size }: { gift: GiftCatalogEntry; size: number }) {
  return (
    <Image
      src={gift.icon}
      alt=""
      width={size}
      height={size}
      className="shrink-0 object-contain"
      style={{ width: size, height: size }}
      unoptimized
    />
  );
}

function CoinBadge({ gift }: { gift: GiftCatalogEntry }) {
  const t = useTranslations();
  if (gift.interactive) {
    return (
      <span className="rounded bg-surface-4 px-1.5 text-[10px] text-muted">
        {t("actionsandevents.eventEditor.giftInteractive")}
      </span>
    );
  }
  return (
    <span className="flex items-center gap-1 text-[11px] tabular-nums text-muted">
      <span aria-hidden className="text-[var(--coin,#f5c518)]">
        ●
      </span>
      {gift.coins}
    </span>
  );
}
