"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { getBackend } from "@/lib/data";
import type { DataBackend } from "@/lib/data/ports";
import { type DispatchResult } from "@/lib/engine";
import { getEngine, setEngineData } from "@/lib/engine/singleton";
import type { Action } from "@/lib/schemas/action";
import type { StreamEvent, StreamTimer } from "@/lib/schemas/event";
import type { ConnectionState, LiveEvent } from "@/lib/schemas/live";
import { ToastProvider } from "@/components/ui/toast";
import { useOverlaySync } from "@/lib/overlay/use-overlay-sync";

/**
 * Uygulama sağlayıcısı — PRD §6.1 akışını istemci tarafında birleştirir:
 *   backend (mock) + bağlantı durumu + kural motoru + olay veri yolu.
 *
 * Faz 2'de connector sidecar geldiğinde yalnız `bus` kaynağı değişir;
 * bu bileşenin sözleşmesi aynı kalır.
 */

interface AppContextValue {
  backend: DataBackend;
  connection: ConnectionState;
  connect: (username: string) => Promise<void>;
  disconnect: () => Promise<void>;
  /** Bir canlı olayı kural motorundan geçirir (Event Simulator kullanır). */
  dispatch: (event: LiveEvent) => DispatchResult;
  /** Kural motorunun bakması gereken veriler değiştiğinde çağrılır. */
  refresh: () => void;
  actions: Action[];
  events: StreamEvent[];
  timers: StreamTimer[];
  lastDispatch: DispatchResult | null;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const backend = useMemo(() => getBackend(), []);

  const [connection, setConnection] = useState<ConnectionState>("disconnected");
  const [actions, setActions] = useState<Action[]>([]);
  const [events, setEvents] = useState<StreamEvent[]>([]);
  const [timers, setTimers] = useState<StreamTimer[]>([]);
  const [lastDispatch, setLastDispatch] = useState<DispatchResult | null>(null);

  // Motor uygulama düzeyinde tekil (bkz. lib/engine/singleton) — kuyruk ve
  // cooldown durumu React ağacının ömrüne bağlı olmamalı.
  const engine = useMemo(() => getEngine(), []);

  useEffect(() => {
    setEngineData({ actions });
  }, [actions]);

  useEffect(() => {
    setEngineData({ events });
  }, [events]);

  const refresh = useCallback(() => {
    void backend.actions.list().then(setActions);
    void backend.events.list().then(setEvents);
    void backend.timers.list().then(setTimers);
  }, [backend]);

  useEffect(() => {
    refresh();
    return backend.connection.subscribe(setConnection);
  }, [backend, refresh]);

  // Kurallar/hesap değiştikçe sunucudaki overlay hub'ına sync (ADR-0002/0005).
  useOverlaySync(backend, actions, events, timers, connection);

  const dispatch = useCallback(
    (event: LiveEvent) => {
      const result = engine.dispatch(event);
      setLastDispatch(result);
      // Kuyruğa düşen eylemler widget'lara yayınlanır (PRD §6.3).
      backend.bus.publish(event);
      return result;
    },
    [backend, engine],
  );

  const connect = useCallback(
    async (username: string) => {
      await backend.connection.connect(username);
    },
    [backend],
  );

  const disconnect = useCallback(async () => {
    await backend.connection.disconnect();
  }, [backend]);

  const value = useMemo(
    () => ({
      backend,
      connection,
      connect,
      disconnect,
      dispatch,
      refresh,
      actions,
      events,
      timers,
      lastDispatch,
    }),
    [backend, connection, connect, disconnect, dispatch, refresh, actions, events, timers, lastDispatch],
  );

  return (
    <AppContext.Provider value={value}>
      <ToastProvider>{children}</ToastProvider>
    </AppContext.Provider>
  );
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used inside <AppProvider>");
  return ctx;
}
