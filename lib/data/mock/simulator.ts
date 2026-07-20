import type { LiveEvent, LiveUser } from "@/lib/schemas/live";
import { GIFT_CATALOG, findGiftByCoins } from "@/lib/data/gift-catalog";
import { newId } from "./store";

/**
 * Sahte olay üretici — PRD §12.2.
 * Event Simulator butonları (PRD §5.3) ve demo modu bunu kullanır.
 */

const NAMES: Array<[string, string]> = [
  ["ayse_kaya", "Ayşe"],
  ["mehmet.dev", "Mehmet"],
  ["zeynep_live", "Zeynep"],
  ["can_yilmaz", "Can"],
  ["elif.soylu", "Elif"],
  ["burak_tk", "Burak"],
  ["deniz__", "Deniz"],
  ["selin.art", "Selin"],
];

/**
 * Demo akışında kullanılan ucuz hediyeler — gerçek yayında en sık gelenler.
 * Tam katalog `@/lib/data/gift-catalog` içindedir.
 */
const COMMON_GIFTS = GIFT_CATALOG.filter((g) => !g.interactive && g.coins <= 10);

const seenUsers = new Set<string>();

function randomUser(): LiveUser {
  const [uniqueId, nickname] = NAMES[Math.floor(Math.random() * NAMES.length)];
  return {
    uniqueId,
    nickname,
    userId: `u_${uniqueId}`,
    isFollower: Math.random() > 0.4,
    isSubscriber: Math.random() > 0.8,
    isModerator: Math.random() > 0.92,
    teamMemberLevel: Math.random() > 0.7 ? Math.ceil(Math.random() * 5) : 0,
  };
}

function base(type: LiveEvent["type"], user: LiveUser): LiveEvent {
  const isFirst = !seenUsers.has(user.userId);
  seenUsers.add(user.userId);
  return {
    id: newId("ev"),
    type,
    ts: Date.now(),
    user,
    isFirstActivity: isFirst,
  };
}

export type SimulateKind =
  | "follow"
  | "share"
  | "subscribe"
  | "likes"
  | "gift"
  | "chat"
  | "join";

export function simulateEvent(
  kind: SimulateKind,
  options: { coins?: number; likes?: number; comment?: string } = {},
): LiveEvent {
  const user = randomUser();

  switch (kind) {
    case "follow":
      return base("follow", user);

    case "share":
      return base("share", user);

    case "subscribe":
      return { ...base("subscribe", user), subMonth: 1, user: { ...user, isSubscriber: true } };

    case "likes": {
      const likeCount = options.likes ?? 15;
      return { ...base("like", user), likeCount, totalLikeCount: likeCount * 12 };
    }

    case "gift": {
      const gift = options.coins
        ? (findGiftByCoins(options.coins) ?? COMMON_GIFTS[0])
        : COMMON_GIFTS[Math.floor(Math.random() * COMMON_GIFTS.length)];
      return {
        ...base("gift", user),
        giftId: gift.id,
        giftName: gift.name,
        coins: options.coins ?? gift.coins,
        repeatCount: 1,
        repeatEnd: true,
      };
    }

    case "chat":
      return { ...base("chat", user), comment: options.comment ?? "Merhaba! 👋" };

    case "join":
      return base("member", user);
  }
}

/** Demo modu — rastgele olay akışı (PRD §12.2). */
export function startDemoStream(
  publish: (event: LiveEvent) => void,
  intervalMs = 3000,
): () => void {
  // Sohbet ağırlıklı dağılım — gerçek yayın akışına yakın demo.
  const kinds: SimulateKind[] = ["chat", "chat", "likes", "gift", "follow", "share", "join"];
  const timer = setInterval(() => {
    publish(simulateEvent(kinds[Math.floor(Math.random() * kinds.length)]));
  }, intervalMs);
  return () => clearInterval(timer);
}
