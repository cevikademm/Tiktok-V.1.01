/**
 * Cooldown yönetimi — PRD §6.2: global + kullanıcı başına, eylem düzeyinde.
 * Saf TypeScript; zaman dışarıdan enjekte edilir (test edilebilirlik).
 */
export class CooldownTracker {
  private globalUntil = new Map<string, number>();
  private userUntil = new Map<string, number>();

  private key(actionId: string, userId: string): string {
    return `${actionId}::${userId}`;
  }

  /** Eylem şu an çalıştırılabilir mi? */
  canRun(
    actionId: string,
    userId: string,
    now: number,
  ): { ok: true } | { ok: false; reason: "global" | "user"; until: number } {
    const g = this.globalUntil.get(actionId);
    if (g !== undefined && now < g) return { ok: false, reason: "global", until: g };

    const u = this.userUntil.get(this.key(actionId, userId));
    if (u !== undefined && now < u) return { ok: false, reason: "user", until: u };

    return { ok: true };
  }

  /** Çalıştırma sonrası cooldown'ları başlatır. */
  mark(
    actionId: string,
    userId: string,
    now: number,
    cooldowns: { globalSec: number; userSec: number },
  ): void {
    if (cooldowns.globalSec > 0) {
      this.globalUntil.set(actionId, now + cooldowns.globalSec * 1000);
    }
    if (cooldowns.userSec > 0) {
      this.userUntil.set(this.key(actionId, userId), now + cooldowns.userSec * 1000);
    }
  }

  reset(): void {
    this.globalUntil.clear();
    this.userUntil.clear();
  }
}

/**
 * Idempotency — PRD §6.2: aynı TikTok event'i iki kez işlenmez.
 * Sabit kapasiteli LRU; bellek sızıntısı olmadan burst'ü karşılar
 * (hedef: yayıncı başına saniyede 50 olay — PRD §13).
 */
export class EventDeduplicator {
  private seen = new Set<string>();
  private order: string[] = [];

  constructor(private readonly capacity = 5000) {}

  /** true = ilk kez görüldü (işle), false = tekrar (yut). */
  accept(eventId: string): boolean {
    if (this.seen.has(eventId)) return false;
    this.seen.add(eventId);
    this.order.push(eventId);
    if (this.order.length > this.capacity) {
      const evicted = this.order.shift();
      if (evicted !== undefined) this.seen.delete(evicted);
    }
    return true;
  }

  reset(): void {
    this.seen.clear();
    this.order = [];
  }
}
