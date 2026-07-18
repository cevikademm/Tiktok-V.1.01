/**
 * Overlay Realtime protokol sabitleri — hibrit mimari (ADR-0003).
 *
 * Hem tarayıcı widget'ı (Supabase Realtime abonesi) hem de connector worker
 * (yayıncı) bu isimlendirmeyi PAYLAŞIR. İzomorfik — Node ve tarayıcıda çalışır.
 *
 * Kanal başına ekran: `overlay-<overlayId>-<screen>`. Kanal adındaki UUID sır
 * görevi görür (auth Faz 2). Broadcast event adı `action`; payload = widget
 * kablo protokolündeki `WidgetInbound` mesajı (lib/schemas/widget.ts).
 */

/** Bir overlay ekranı için Supabase Realtime kanal adı. */
export function overlayChannel(overlayId: string, screen: number): string {
  return `overlay-${overlayId}-${screen}`;
}

/**
 * Bir overlay için TEK Presence kanalı — bağlı ekranların canlı durumu (ADR-0003).
 * Her widget bağlanınca `track({ screen })` çağırır; panel bu kanalı dinleyip
 * hangi Screen 1-8'in çevrimiçi olduğunu anlık gösterir. Kanal adındaki UUID sır
 * görevi görür (broadcast kanallarıyla aynı güvenlik modeli).
 */
export function overlayPresenceChannel(overlayId: string): string {
  return `overlay-${overlayId}-presence`;
}

/** Broadcast event adı — connector gönderir, widget dinler. */
export const OVERLAY_BROADCAST_EVENT = "action";

/**
 * Supabase yapılandırılmış mı? (hibrit mod açık mı)
 * Tarayıcıda `NEXT_PUBLIC_*` env'leri okunur; tanımsızsa SSE hub'a düşülür.
 */
export function isSupabaseConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}
