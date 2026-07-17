import { createMockBackend } from "./mock";
import type { DataBackend } from "./ports";

/**
 * Backend seçimi — PRD §12.3.
 *
 * Modlar:
 *   - "mock"   (varsayılan): Tamamen simüle edilmiş backend (Faz 0-1).
 *   - "tiktok": Mock veri + gerçek TikTok LIVE bağlantı servisi.
 *   - "supabase": Tam Supabase backend (Faz 2 — henüz yok).
 *
 * DATA_BACKEND=tiktok ile:
 *   - Veri deposu (actions, events, settings vb.) hâlâ mock.
 *   - ConnectionService gerçek TikTok SSE endpoint'ine bağlanır.
 *   - RealtimeBus gerçek TikTok olaylarını taşır.
 */
export function getBackend(): DataBackend {
  const target = process.env.NEXT_PUBLIC_DATA_BACKEND ?? "mock";

  if (target === "supabase") {
    throw new Error(
      "DATA_BACKEND=supabase henüz uygulanmadı (Faz 2). lib/data/supabase/ boş.",
    );
  }

  if (target === "tiktok") {
    return createTikTokBackend();
  }

  return createMockBackend();
}

/**
 * TikTok backend — mock veri deposu + gerçek TikTok bağlantı servisi.
 * Tekil (singleton): bir kez oluşturulur, aynı referans döner.
 */
let tiktokBackend: DataBackend | null = null;

function createTikTokBackend(): DataBackend {
  if (tiktokBackend) return tiktokBackend;

  // Lazy import — tiktok modülü yalnızca gerektiğinde yüklenir.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { createTikTokConnection, createTikTokBus } = require("@/lib/tiktok/client");

  const mock = createMockBackend();
  const connection = createTikTokConnection();
  const bus = createTikTokBus();

  // Bağlantı servisi olay veri yoluna erişim alır.
  connection.setBus(bus);

  tiktokBackend = {
    ...mock,
    connection,
    bus,
  };

  return tiktokBackend;
}

export type { DataBackend } from "./ports";
