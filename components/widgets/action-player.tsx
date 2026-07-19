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

/* -------------------------------------------------------------------------- */
/* Ses/video oynatma — autoplay engelini yakala ve ilk etkileşimde çöz          */
/* -------------------------------------------------------------------------- */

/**
 * Medyayı AÇIKÇA oynatır ve başarısızlığı yutmaz.
 *
 * `autoPlay` niteliği sessizdir: tarayıcı autoplay'i engellerse hiçbir iz
 * bırakmadan çalmaz — "ses eklendi ama çalmadı" şikâyetinin en sık sebebi budur.
 * OBS'in CEF'i autoplay'e izin verir, ancak TikTok LIVE Studio gibi gömülü
 * tarayıcılar ve normal sekmeler engelleyebilir. Burada:
 *   1) `play()` sözü reddedilirse konsola AÇIK bir tanı yazılır,
 *   2) ilk kullanıcı etkileşiminde (tıklama/tuş/dokunma) tekrar denenir,
 *   3) `error` olayı (404 / bozuk dosya / CORS) ayrıca raporlanır.
 */
function useMediaAutoplay(
  ref: { current: HTMLMediaElement | null },
  volume: number,
  queueId: string,
) {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    el.volume = volume;
    let unlock: (() => void) | null = null;

    const attempt = () => {
      const p = el.play();
      if (!p) return;
      p.catch((err: unknown) => {
        const name = err instanceof Error ? err.name : String(err);
        console.warn(
          `[overlay] medya oynatılamadı (${name}) — src=${el.currentSrc || el.src}. ` +
            "Tarayıcı autoplay'i engelledi; ilk etkileşimde yeniden denenecek.",
        );
        // Tek seferlik kilit açma: sayfaya herhangi bir etkileşim gelirse tekrar dene.
        unlock = () => {
          void el.play().catch(() => {});
        };
        for (const ev of ["pointerdown", "keydown", "touchstart"] as const) {
          window.addEventListener(ev, unlock, { once: true });
        }
      });
    };

    const onError = () => {
      console.error(
        `[overlay] medya YÜKLENEMEDİ — src=${el.currentSrc || el.src}. ` +
          "Dosya URL'si erişilebilir mi? (blob: URL'ler yalnız üretildiği sekmede geçerlidir.)",
      );
    };
    el.addEventListener("error", onError);

    attempt();

    return () => {
      el.removeEventListener("error", onError);
      if (unlock) {
        for (const ev of ["pointerdown", "keydown", "touchstart"] as const) {
          window.removeEventListener(ev, unlock);
        }
      }
    };
    // queueId: aynı dosya art arda gelse bile her action için yeniden oynat.
  }, [ref, volume, queueId]);
}

function AudioTrack({
  src,
  volume,
  queueId,
}: {
  src: string;
  volume: number;
  queueId: string;
}) {
  const ref = useRef<HTMLAudioElement | null>(null);
  useMediaAutoplay(ref, volume, queueId);
  // `key` (çağıran tarafta queueId) elementi sıfırlar → src değişimi garanti yeniden yüklenir.
  return <audio ref={ref} src={src} autoPlay preload="auto" />;
}

function VideoTrack({
  src,
  volume,
  queueId,
}: {
  src: string;
  volume: number;
  queueId: string;
}) {
  const ref = useRef<HTMLVideoElement | null>(null);
  useMediaAutoplay(ref, volume, queueId);
  return (
    <video
      ref={ref}
      src={src}
      autoPlay
      playsInline
      muted={volume === 0}
      preload="auto"
      className="max-h-[60vh] max-w-[80vw]"
    />
  );
}

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
        <VideoTrack
          key={`v-${action.queueId}`}
          src={action.mediaUrl}
          volume={volume}
          queueId={action.queueId}
        />
      )}

      {action.types.includes("playAudio") && action.mediaUrl && (
        <AudioTrack
          key={`a-${action.queueId}`}
          src={action.mediaUrl}
          volume={volume}
          queueId={action.queueId}
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

/**
 * Aynı olayın tekrar oynatılmasını engelleme penceresi.
 *
 * `LiveEvent.id` kaynakta (TikTok mesajı) üretilir ve olay başına tekildir, yani
 * meşru bir tekrar (aynı kişinin ikinci hediyesi) FARKLI bir id taşır — bu
 * pencere yanlışlıkla bir şeyi bastırmaz. Yalnız aynı olayın ikinci KOPYASINI
 * eler: iki connector örneği çalıştığında, connector yeniden başladığında veya
 * Realtime mesajı yeniden ilettiğinde ses iki kez çalıyordu.
 */
const DEDUPE_WINDOW_MS = 60_000;
const DEDUPE_MAX_ENTRIES = 500;

export function useActionPlayer(): ActionPlayer {
  const [current, setCurrent] = useState<ResolvedAction | null>(null);
  const [fading, setFading] = useState<"in" | "out">("in");
  const [queueLength, setQueueLength] = useState(0);
  const queueRef = useRef<ResolvedAction[]>([]);
  /** `${actionId}:${sourceEventId}` → ilk görülme zamanı. */
  const seenRef = useRef<Map<string, number>>(new Map());
  // `push` çağrıldığında pump effect'ini tetiklemek için sayaç.
  const [tick, setTick] = useState(0);

  const push = useCallback((item: ResolvedAction) => {
    // Tekilleştirme — yalnız kaynak olay kimliği varsa (eski yayıncılar göndermez).
    if (item.sourceEventId) {
      const key = `${item.actionId}:${item.sourceEventId}`;
      const now = Date.now();
      const seen = seenRef.current;
      const prev = seen.get(key);
      if (prev !== undefined && now - prev < DEDUPE_WINDOW_MS) return; // yinelenen — yut
      seen.set(key, now);
      // Sınırsız büyümesin: pencere dışı kayıtları at, hâlâ büyükse en eskiyi kırp.
      if (seen.size > DEDUPE_MAX_ENTRIES) {
        for (const [k, at] of seen) {
          if (now - at >= DEDUPE_WINDOW_MS) seen.delete(k);
        }
        while (seen.size > DEDUPE_MAX_ENTRIES) {
          const oldest = seen.keys().next();
          if (oldest.done) break;
          seen.delete(oldest.value);
        }
      }
    }
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
