"use client";

import { useSyncExternalStore } from "react";
import { getOverlayId } from "@/lib/overlay/identity";

/**
 * Overlay kimliğini hidrasyon-güvenli okur (ADR-0002).
 *
 * `useLocalStorage` felsefesiyle aynı: effect içinde senkron `setState` (cascading
 * render) yerine `useSyncExternalStore`. Sunucu snapshot'ı `""`, istemcide gerçek id.
 * `getSnapshot` her çağrıda AYNI referansı döndürür (bir kez üretilip önbelleklenir),
 * aksi halde sonsuz render olurdu.
 */

let cachedId: string | null = null;

function getSnapshot(): string {
  if (cachedId === null) cachedId = getOverlayId();
  return cachedId;
}

function getServerSnapshot(): string {
  return "";
}

function subscribeNoop(): () => void {
  return () => {};
}

export function useOverlayId(): string {
  return useSyncExternalStore(subscribeNoop, getSnapshot, getServerSnapshot);
}
