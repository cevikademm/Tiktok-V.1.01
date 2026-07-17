"use client";

import { useCallback, useSyncExternalStore } from "react";

/**
 * localStorage'a bağlı, hidrasyon-güvenli durum.
 *
 * Neden `useEffect` + `setState` değil:
 *  - localStorage sunucuda yok → ilk boya yanlış değeri gösterir, sonra zıplar.
 *  - Effect içinde eş zamanlı setState cascading render'a yol açar.
 * React'in bu iş için önerdiği API `useSyncExternalStore`.
 *
 * DİKKAT: `getSnapshot` her çağrıda AYNI referansı döndürmeli, aksi halde
 * sonsuz render döngüsü olur. Bu yüzden değerler ham string'e göre önbelleklenir.
 */

interface CacheEntry {
  raw: string | null;
  value: unknown;
}

const cache = new Map<string, CacheEntry>();
const listeners = new Map<string, Set<() => void>>();

function emit(key: string): void {
  for (const listener of listeners.get(key) ?? []) listener();
}

function subscribe(key: string, listener: () => void): () => void {
  let set = listeners.get(key);
  if (!set) {
    set = new Set();
    listeners.set(key, set);
  }
  set.add(listener);

  // Diğer sekmelerdeki değişiklikler de yansısın.
  const onStorage = (e: StorageEvent) => {
    if (e.key === key) listener();
  };
  window.addEventListener("storage", onStorage);

  return () => {
    set.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

function read<T>(key: string, fallback: T, parse: (raw: string) => T): T {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(key);
  } catch {
    // Gizli mod / erişim engeli — varsayılana düş.
    return fallback;
  }

  const entry = cache.get(key);
  if (entry && entry.raw === raw) return entry.value as T;

  let value = fallback;
  if (raw !== null) {
    try {
      value = parse(raw);
    } catch {
      // Bozuk kayıt — varsayılana düş.
      value = fallback;
    }
  }

  cache.set(key, { raw, value });
  return value;
}

/**
 * @param fallback SABİT referans olmalı (modül seviyesi sabit) — sunucu snapshot'ı budur.
 * @param parse Ham string'i değere çevirir; hata fırlatırsa fallback kullanılır.
 */
export function useLocalStorage<T>(
  key: string,
  fallback: T,
  parse: (raw: string) => T = (raw) => JSON.parse(raw) as T,
): readonly [T, (next: T) => void] {
  const value = useSyncExternalStore(
    useCallback((listener: () => void) => subscribe(key, listener), [key]),
    useCallback(() => read(key, fallback, parse), [key, fallback, parse]),
    useCallback(() => fallback, [fallback]),
  );

  const setValue = useCallback(
    (next: T) => {
      try {
        localStorage.setItem(key, JSON.stringify(next));
      } catch {
        // Kota dolu — bellek içi önbellekle devam et.
      }
      cache.set(key, { raw: JSON.stringify(next), value: next });
      emit(key);
    },
    [key],
  );

  return [value, setValue] as const;
}
