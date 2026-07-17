import type { LiveEvent, LiveUser } from "@/lib/schemas/live";
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

/** TikTok hediye ekonomisi referansı — PRD Ek A (coin değerleri birebir). */
export const GIFT_CATALOG: Array<{ id: string; name: string; coins: number }> = [
  { id: "5655", name: "Rose", coins: 1 },
  { id: "6064", name: "Panda", coins: 5 },
  { id: "5827", name: "Perfume", coins: 20 },
  { id: "5487", name: "I Love You", coins: 49 },
  { id: "5879", name: "Confetti", coins: 100 },
  { id: "6784", name: "Money Rain", coins: 500 },
  { id: "6427", name: "Disco Ball", coins: 1000 },
  { id: "6091", name: "Airplane", coins: 6000 },
  { id: "6415", name: "Planet", coins: 15000 },
  { id: "7168", name: "Lion", coins: 29999 },
  { id: "6888", name: "Universe", coins: 44999 },
];

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
        ? (GIFT_CATALOG.find((g) => g.coins >= options.coins!) ?? GIFT_CATALOG[0])
        : GIFT_CATALOG[Math.floor(Math.random() * 5)];
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
