/**
 * Overlay ekran durumu — GET /api/overlay/status?id=<overlayId>
 *
 * Yerel/tek-süreç (SSE hub) modunda panelin ekran durumu göstergesini besler:
 * hub'a hangi Screen 1-8'in bağlı (abone) olduğunu döner. Supabase/hibrit modda
 * panel yerine Supabase Presence kullanır (bkz. lib/overlay/use-screen-presence).
 */

import { getOnlineScreens } from "@/lib/server/overlay-hub";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id")?.trim();
  if (!id) {
    return Response.json({ error: "id parametresi gereklidir" }, { status: 400 });
  }
  return Response.json({ online: getOnlineScreens(id) });
}
