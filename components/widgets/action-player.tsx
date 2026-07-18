"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { WidgetInbound } from "@/lib/schemas/widget";

/**
 * Paylaşılan overlay oynatıcı — PRD §5.4 / ADR-0002.
 *
 * HEM sunucu-SSE overlay'i (`remote-overlay.tsx`) HEM eski bus-temelli widget'ı
 * (`myactions.tsx`) aynı render + kuyruk/timing mantığını kullanır (DRY).
 * Gelen action zaten çözülmüştür (server eşleştirmiş, placeholder ikame edilmiş) —
 * bu yüzden burada kural motoru yok, yalnız görüntüleme.
 */

/** Sunucudan gelen çözülmüş action payload'ı (widgetInbound "action"). */
export type ResolvedAction = Extract<WidgetInbound, { kind: "action" }>["payload"];

/* -------------------------------------------------------------------------- */
/* Konfeti / animasyon — canvas-confetti                                        */
/* -------------------------------------------------------------------------- */

async function fireAnimation(animationId?: string): Promise<void> {
  if (typeof window === "undefined") return;
  // Erişilebilirlik — CLAUDE.md §5.8 (prefers-reduced-motion).
  if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;

  const confetti = (await import("canvas-confetti")).default;
  const id = (animationId ?? "confetti").toLowerCase();

  if (id === "fireworks") {
    const end = Date.now() + 1000;
    const colors = ["#D43555", "#ffffff", "#ffd700"];
    const frame = () => {
      confetti({ particleCount: 6, angle: 60, spread: 55, origin: { x: 0 }, colors });
      confetti({ particleCount: 6, angle: 120, spread: 55, origin: { x: 1 }, colors });
      if (Date.now() < end) requestAnimationFrame(frame);
    };
    frame();
    return;
  }

  if (id === "hearts") {
    const heart =
      typeof confetti.shapeFromText === "function"
        ? confetti.shapeFromText({ text: "❤️", scalar: 2 })
        : undefined;
    confetti({
      particleCount: 60,
      spread: 70,
      origin: { y: 0.6 },
      scalar: 2,
      shapes: heart ? [heart] : undefined,
    });
    return;
  }

  // Varsayılan: konfeti patlaması.
  confetti({ particleCount: 120, spread: 75, origin: { y: 0.6 } });
}

/* -------------------------------------------------------------------------- */
/* Render bileşeni                                                             */
/* -------------------------------------------------------------------------- */

export function ActionRenderer({
  action,
  fading,
}: {
  action: ResolvedAction;
  fading: "in" | "out";
}) {
  // Animasyonu action başına bir kez tetikle (queueId değişince).
  const firedRef = useRef<string | null>(null);
  useEffect(() => {
    if (firedRef.current === action.queueId) return;
    firedRef.current = action.queueId;
    if (action.types.includes("showAnimation")) void fireAnimation(action.animationId);
  });

  const volume = Math.min(1, Math.max(0, (action.volume ?? 50) / 100));

  return (
    <div
      className="flex flex-col items-center gap-4 text-center transition-opacity"
      style={{
        opacity: fading === "in" ? 1 : 0,
        transitionDuration: `${fading === "in" ? action.fadeInMs ?? 200 : action.fadeOutMs ?? 200}ms`,
      }}
    >
      {action.types.includes("showText") && action.text && (
        <p
          className="text-5xl font-bold drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)]"
          style={{ color: action.textColor ?? "#FFFFFF" }}
        >
          {action.text}
        </p>
      )}

      {action.types.includes("showImage") && action.mediaUrl && (
        // Widget'ta next/image kullanılmaz: kaynak blob/object URL olabilir ve
        // OBS'de optimizasyon sunucusuna erişim garanti değil.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={action.mediaUrl}
          alt=""
          className="max-h-[60vh] max-w-[80vw] object-contain"
        />
      )}

      {action.types.includes("playVideoFile") && action.mediaUrl && (
        <video
          src={action.mediaUrl}
          autoPlay
          muted={volume === 0}
          ref={(el) => {
            if (el) el.volume = volume;
          }}
          className="max-h-[60vh] max-w-[80vw]"
        />
      )}

      {action.types.includes("playAudio") && action.mediaUrl && (
        <audio
          src={action.mediaUrl}
          autoPlay
          ref={(el) => {
            if (el) el.volume = volume;
          }}
        />
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Kuyruk + timing hook (engine'siz — çözülmüş action'lar için)                 */
/* -------------------------------------------------------------------------- */

export interface ActionPlayer {
  current: ResolvedAction | null;
  fading: "in" | "out";
  queueLength: number;
  push: (item: ResolvedAction) => void;
}

export function useActionPlayer(): ActionPlayer {
  const [current, setCurrent] = useState<ResolvedAction | null>(null);
  const [fading, setFading] = useState<"in" | "out">("in");
  const [queueLength, setQueueLength] = useState(0);
  const queueRef = useRef<ResolvedAction[]>([]);
  // `push` çağrıldığında pump effect'ini tetiklemek için sayaç.
  const [tick, setTick] = useState(0);

  const push = useCallback((item: ResolvedAction) => {
    queueRef.current.push(item);
    setTick((t) => t + 1);
  }, []);

  // Kuyruktan sıradakini al — yalnız boşta (current === null) iken.
  useEffect(() => {
    if (current) {
      setQueueLength(queueRef.current.length);
      return;
    }
    const next = queueRef.current.shift();
    setQueueLength(queueRef.current.length);
    if (next) {
      setFading("in");
      setCurrent(next);
    }
  }, [tick, current]);

  // Oynatma süresi dolunca sıradakine geç.
  useEffect(() => {
    if (!current) return;
    const durationMs = current.durationSec * 1000;
    const fadeOut = current.fadeOutMs ?? 200;
    const fadeTimer = setTimeout(
      () => setFading("out"),
      Math.max(0, durationMs - fadeOut),
    );
    const endTimer = setTimeout(() => setCurrent(null), durationMs);
    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(endTimer);
    };
  }, [current]);

  return { current, fading, queueLength, push };
}
