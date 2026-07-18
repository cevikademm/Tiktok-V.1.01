"use client";

import { useEffect, useEffectEvent, useRef, useState } from "react";
import { getBackend } from "@/lib/data";
import { renderPlaceholders } from "@/lib/engine/placeholders";
import { RuleEngine } from "@/lib/engine";
import type { Action } from "@/lib/schemas/action";
import type { StreamEvent } from "@/lib/schemas/event";
import type { LiveEvent } from "@/lib/schemas/live";
import { HEARTBEAT_TIMEOUT_MS } from "@/lib/engine/queue";
import { ActionRenderer, type ResolvedAction } from "./action-player";

/**
 * My Actions widget — PRD §5.4:
 * "Eylem medyalarını render eder; 8 bağımsız ekran, ekran başına kuyruk".
 *
 * OBS browser source olarak eklenir: /widget/myactions?cid=<id>&screen=N
 * Şeffaf arka plan, chrome yok (CLAUDE.md §5.10).
 */

interface Playing {
  queueId: string;
  action: Action;
  event: LiveEvent | null;
  startedAt: number;
}

export function MyActionsWidget({
  screen,
  preview,
}: {
  screen: number;
  preview: boolean;
}) {
  const [playing, setPlaying] = useState<Playing | null>(null);
  const [queueLength, setQueueLength] = useState(0);
  const [fading, setFading] = useState<"in" | "out">("in");

  const engineRef = useRef<RuleEngine | null>(null);
  const actionsRef = useRef<Action[]>([]);
  const eventsRef = useRef<StreamEvent[]>([]);
  /** Kuyruk öğesini tetikleyen olay — placeholder ikamesi için saklanır. */
  const lastEventRef = useRef<Map<string, LiveEvent>>(new Map());

  // Backend tek örnek; useState başlatıcısı render sırasında ref okumadan sabit değer üretir.
  const [backend] = useState(() => getBackend());

  /**
   * Kuyruktan sıradaki öğeyi alıp oynatır.
   *
   * `useEffectEvent`: yalnız effect/olay bağlamından çağrılır, render'da değil.
   * Bu sayede motor ve kuyruk (ref'lerdeki imperatif durum) güvenle okunabilir ve
   * fonksiyon effect bağımlılığı olmadığı için abonelikler her render'da kurulmaz.
   */
  const pump = useEffectEvent(() => {
    const engine = engineRef.current;
    if (!engine) return;

    setQueueLength(engine.queues.length(screen));
    if (playing) return;

    const next = engine.queues.peek(screen);
    if (!next) return;

    const action = actionsRef.current.find((a) => a.id === next.actionId);
    if (!action) {
      // Eylem silinmiş — kuyrukta takılı kalmasın.
      engine.queues.dequeue(screen, next.queueId);
      return;
    }

    setFading("in");
    setPlaying({
      queueId: next.queueId,
      action,
      event: lastEventRef.current.get(next.queueId) ?? null,
      startedAt: Date.now(),
    });
  });

  /* Motor kurulumu + veri yolu aboneliği */
  useEffect(() => {
    let alive = true;

    async function boot() {
      const [actions, events, screens] = await Promise.all([
        backend.actions.list(),
        backend.events.list(),
        backend.screens.list(),
      ]);
      if (!alive) return;

      actionsRef.current = actions;
      eventsRef.current = events;

      engineRef.current = new RuleEngine(
        {
          getActions: () => actionsRef.current,
          getEvents: () => eventsRef.current,
        },
        screens.map((s) => ({ screen: s.screen, maxQueueLength: s.maxQueueLength })),
      );

      // Widget canlı: ekranı online işaretle (PRD §6.3 heartbeat).
      engineRef.current.queues.heartbeat(screen, Date.now());
      void backend.screens.update(screen, { online: true });
    }

    void boot();
    return () => {
      alive = false;
      void backend.screens.update(screen, { online: false });
    };
  }, [backend, screen]);

  /* Olay veri yolu — kural motorundan geçen eylemler kuyruğa düşer */
  useEffect(() => {
    return backend.bus.subscribe((event) => {
      const engine = engineRef.current;
      if (!engine) return;

      const result = engine.dispatch(event);
      for (const outcome of result.outcomes) {
        if (outcome.status === "queued" && outcome.action.screen === screen) {
          lastEventRef.current.set(outcome.item.queueId, event);
        }
      }
      pump();
    });
  }, [backend, screen]);

  /* Heartbeat — ekran online kalsın */
  useEffect(() => {
    const timer = setInterval(() => {
      engineRef.current?.queues.heartbeat(screen, Date.now());
    }, HEARTBEAT_TIMEOUT_MS / 2);
    return () => clearInterval(timer);
  }, [screen]);

  /* Oynatma süresi dolunca sıradakine geç */
  useEffect(() => {
    if (!playing) {
      pump();
      return;
    }

    const durationMs = playing.action.durationSec * 1000;
    const fadeOut = playing.action.fadeOutMs;

    const fadeTimer = setTimeout(() => setFading("out"), Math.max(0, durationMs - fadeOut));
    const endTimer = setTimeout(() => {
      engineRef.current?.queues.dequeue(screen, playing.queueId);
      lastEventRef.current.delete(playing.queueId);
      setPlaying(null);
    }, durationMs);

    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(endTimer);
    };
  }, [playing, screen]);

  /* Önizleme modunda demo akışı (PRD §5.4 `&preview=1`) */
  useEffect(() => {
    if (!preview) return;
    const timer = setInterval(() => {
      backend.bus.publish(backend.simulator.simulate("gift", { coins: 1 }));
    }, 6000);
    return () => clearInterval(timer);
  }, [preview, backend]);

  const resolved: ResolvedAction | null = playing
    ? {
        actionId: playing.action.id,
        queueId: playing.queueId,
        durationSec: playing.action.durationSec,
        types: playing.action.types,
        text: playing.action.config.text
          ? renderPlaceholders(playing.action.config.text, {
              event: playing.event ?? undefined,
            })
          : undefined,
        textColor: playing.action.config.textColor,
        mediaUrl: playing.action.config.mediaUrl,
        volume: playing.action.volume,
        fadeInMs: playing.action.fadeInMs,
        fadeOutMs: playing.action.fadeOutMs,
        animationId: playing.action.config.animationId,
      }
    : null;

  return (
    <div className="flex h-screen w-screen items-center justify-center bg-transparent">
      {preview && (
        <div className="fixed top-2 left-2 rounded bg-black/60 px-2 py-1 font-mono text-xs text-white">
          screen={screen} · queue={queueLength}
        </div>
      )}

      {resolved && <ActionRenderer action={resolved} fading={fading} />}
    </div>
  );
}
