"use client";

import { useSyncExternalStore } from "react";
import { getServerSnapshot, getSnapshot, subscribeStore, type MockState } from "./store";

/**
 * Mock store'a hidrasyon-güvenli abonelik.
 *
 * localStorage sunucuda yoktur; `useEffect` içinde okuyup setState etmek
 * (a) cascading render'a yol açar, (b) ilk boyada yanlış değeri gösterir.
 * React'in bu iş için önerdiği API `useSyncExternalStore`: sunucu/hidrasyon
 * pass'inde `getServerSnapshot`, sonrasında `getSnapshot` kullanılır.
 */
export function useMockStore(): MockState {
  return useSyncExternalStore(subscribeStore, getSnapshot, getServerSnapshot);
}
