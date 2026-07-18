"use client";

import { useSyncExternalStore } from "react";

/**
 * Overlay config sync durumu — DebugPanel'in "sunucudaki hub güncel mi?" göstergesi.
 *
 * `use-overlay-sync.ts` her POST sonucunda `setOverlaySyncStatus` çağırır; panel
 * `useOverlaySyncStatus()` ile reaktif okur. Modül-seviyesi gözlemci (yeni state
 * mekanizması eklemeden, mock/port'a dokunmadan).
 */

export interface OverlaySyncStatus {
  state: "idle" | "ok" | "error";
  httpStatus?: number;
  ts?: number;
  message?: string;
}

const IDLE: OverlaySyncStatus = { state: "idle" };
let current: OverlaySyncStatus = IDLE;
const listeners = new Set<() => void>();

export function setOverlaySyncStatus(next: OverlaySyncStatus): void {
  current = next;
  for (const l of listeners) l();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): OverlaySyncStatus {
  return current;
}

function getServerSnapshot(): OverlaySyncStatus {
  return IDLE;
}

export function useOverlaySyncStatus(): OverlaySyncStatus {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
