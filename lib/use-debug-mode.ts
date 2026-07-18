"use client";

import { useLocalStorage } from "@/lib/use-local-storage";

/**
 * Hata ayıklama modu — tek reaktif kaynak (ADR-0002 takibi).
 *
 * Setup'taki "Hata Ayıklama Modunu Etkinleştir" toggle'ı ile `DebugPanel` bunu paylaşır.
 * Mock store'a (port ihlali) bağlanmamak için `useLocalStorage` deseni — MASTER_KEY /
 * overlayId ile aynı; hidrasyon-güvenli ve sekmeler arası reaktif.
 */

const DEBUG_KEY = "livekit.debugMode.v1";
const DEBUG_DEFAULT = false;

export function useDebugMode(): readonly [boolean, (next: boolean) => void] {
  return useLocalStorage<boolean>(DEBUG_KEY, DEBUG_DEFAULT);
}
