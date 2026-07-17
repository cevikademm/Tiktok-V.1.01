/**
 * TikTok LIVE SSE İstemcisi — İstemci tarafında SSE endpoint'ine bağlanarak
 * gerçek zamanlı olayları alır ve projenin ConnectionService + RealtimeBus
 * arayüzlerine entegre eder.
 *
 * PRD §12.4: Bağlantı durum makinesi (disconnected → connecting → live → error).
 * PRD §6.1:  connector → event mapper → SSE → istemci → kural motoru.
 */

import type { ConnectionState, LiveEvent } from "@/lib/schemas/live";
import type { ConnectionService, RealtimeBus } from "@/lib/data/ports";

/**
 * TikTok LIVE bağlantı servisi — SSE endpoint'i üzerinden sunucu tarafındaki
 * tiktok-live-connector'a bağlanır.
 */
export function createTikTokConnection(): ConnectionService & {
  /** Olay veri yoluna erişim (event'leri iletmek için). */
  setBus: (bus: RealtimeBus) => void;
} {
  let state: ConnectionState = "disconnected";
  let eventSource: EventSource | null = null;
  let bus: RealtimeBus | null = null;
  const listeners = new Set<(s: ConnectionState) => void>();

  const setState = (next: ConnectionState) => {
    state = next;
    for (const l of listeners) l(next);
  };

  return {
    getState: () => state,

    setBus: (b: RealtimeBus) => {
      bus = b;
    },

    connect: async (username: string) => {
      if (!username.trim()) throw new Error("invalidUsername");

      // Mevcut bağlantıyı kapat
      if (eventSource) {
        eventSource.close();
        eventSource = null;
      }

      setState("connecting");

      const cleanUsername = username.replace(/^@/, "");
      const url = `/api/tiktok/stream?username=${encodeURIComponent(cleanUsername)}`;

      return new Promise<void>((resolve, reject) => {
        const es = new EventSource(url);
        eventSource = es;

        // Promise'in yalnız bir kez çözülmesini/reddedilmesini garanti eder.
        let settled = false;

        /** Bağlantıyı kalıcı olarak kapatır — EventSource'un otomatik yeniden
         *  bağlanma davranışını durdurur (aksi halde sunucu stream'i her
         *  kapandığında yeni bir deneme başlar ve sonsuz hata döngüsü oluşur). */
        const shutdown = (nextState: ConnectionState) => {
          clearTimeout(timeout);
          es.close();
          if (eventSource === es) eventSource = null;
          setState(nextState);
        };

        /** Zaman aşımı — 15 saniye içinde bağlantı kurulamazsa hata ver. */
        const timeout = setTimeout(() => {
          if (settled) return;
          settled = true;
          shutdown("error");
          reject(new Error("Bağlantı zaman aşımına uğradı"));
        }, 15_000);

        es.onmessage = (event: MessageEvent) => {
          try {
            const msg = JSON.parse(event.data) as {
              type: string;
              // SSE mesaj gövdesi tipe göre değişir; kullandığımız alanlar opsiyonel.
              data?: { liveEvent?: LiveEvent; message?: string };
            };

            switch (msg.type) {
              case "connected":
                clearTimeout(timeout);
                settled = true;
                setState("live");
                resolve();
                break;

              case "disconnected":
                shutdown("disconnected");
                break;

              case "event":
                if (msg.data?.liveEvent && bus) {
                  bus.publish(msg.data.liveEvent as LiveEvent);
                }
                break;

              case "error": {
                // Sunucudan gelen hata KALICIDIR (offline / oda bulunamadı / engel).
                // EventSource'u kapatıp yeniden bağlanma fırtınasını önle.
                const message = msg.data?.message ?? "Bağlantı hatası";
                // console.error dev overlay'i tetikler; hata UI'da gösterildiği
                // için burada yalnız uyarı düzeyinde logluyoruz.
                console.warn("[TikTok SSE]", message);
                shutdown("error");
                if (!settled) {
                  settled = true;
                  reject(new Error(message));
                }
                break;
              }

              case "roomInfo":
                // Oda bilgisi — ileride kullanılabilir.
                break;
            }
          } catch (err) {
            console.warn("[TikTok SSE] Mesaj ayrıştırma hatası:", err);
          }
        };

        es.onerror = () => {
          // Bağlantı henüz kurulmadıysa: hata ver ve yeniden bağlanmayı durdur.
          if (!settled) {
            settled = true;
            shutdown("error");
            reject(new Error("SSE bağlantısı başarısız"));
            return;
          }
          // Canlı bağlantı koptuysa: EventSource'un doğal yeniden bağlanmasına
          // izin ver, yalnız durumu güncelle.
          if (state === "live") setState("connecting");
        };
      });
    },

    disconnect: async () => {
      if (eventSource) {
        eventSource.close();
        eventSource = null;
      }
      setState("disconnected");
    },

    subscribe: (listener) => {
      listeners.add(listener);
      listener(state);
      return () => listeners.delete(listener);
    },
  };
}

/**
 * Gerçek zamanlı olay veri yolu — TikTok LIVE olaylarını
 * widget'lara ve kural motoruna dağıtır.
 *
 * Mock backend'teki BroadcastChannel tabanlı bus ile aynı arayüzü
 * paylaşır; widget'lar ayrı sekmede de olayları alabilir.
 */
const BUS_CHANNEL = "livekit.bus.v1";

export function createTikTokBus(): RealtimeBus {
  const listeners = new Set<(e: LiveEvent) => void>();

  const channel =
    typeof BroadcastChannel !== "undefined"
      ? new BroadcastChannel(BUS_CHANNEL)
      : null;

  if (channel) {
    channel.onmessage = (msg: MessageEvent<LiveEvent>) => {
      for (const l of listeners) l(msg.data);
    };
  }

  return {
    publish: (event) => {
      for (const l of listeners) l(event);
      channel?.postMessage(event);
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
