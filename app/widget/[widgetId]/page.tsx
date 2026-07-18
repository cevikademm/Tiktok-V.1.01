import { notFound } from "next/navigation";
import { MyActionsWidget } from "@/components/widgets/myactions";
import { RemoteOverlay } from "@/components/widgets/remote-overlay";
import { SCREEN_MAX, SCREEN_MIN } from "@/lib/schemas/action";
import { widgetMeta } from "@/lib/widgets/registry";

/**
 * Widget render — PRD §5.4 URL şeması:
 *   /widget/<widgetId>?cid=<channelId>&screen=1-8&preview=1
 *   /widget/myactions?id=<overlayId>&screen=1-8   (gerçek OBS köprüsü — ADR-0002)
 *
 * `id` verilmişse sunucu-SSE overlay'i (RemoteOverlay) render edilir; aksi halde
 * eski bus-temelli (aynı-tarayıcı) demo widget'ı.
 * Faz 1'de yalnız `myactions` uygulanmıştır (PRD §15.6).
 */
export default async function WidgetPage({
  params,
  searchParams,
}: {
  params: Promise<{ widgetId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { widgetId } = await params;
  const query = await searchParams;

  const meta = widgetMeta(widgetId);
  if (!meta) notFound();

  const preview = query.preview === "1";

  if (!meta.implemented) {
    // Faz dışı widget — OBS'de siyah ekran yerine açık bir durum göster.
    return (
      <div className="flex h-screen w-screen items-center justify-center">
        <p className="rounded bg-black/60 px-3 py-2 font-mono text-sm text-white">
          {widgetId}: not implemented yet
        </p>
      </div>
    );
  }

  const rawScreen = Number(query.screen ?? 1);
  const screen =
    Number.isInteger(rawScreen) && rawScreen >= SCREEN_MIN && rawScreen <= SCREEN_MAX
      ? rawScreen
      : 1;

  const id = typeof query.id === "string" ? query.id.trim() : "";
  if (id) {
    // Gerçek OBS köprüsü: sunucu-otoriteli SSE kanalına bağlan (ADR-0002).
    return <RemoteOverlay id={id} screen={screen} />;
  }

  return <MyActionsWidget screen={screen} preview={preview} />;
}
