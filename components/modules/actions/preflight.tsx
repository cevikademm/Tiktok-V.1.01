"use client";

import { AlertTriangle, CheckCircle2, XCircle } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { useApp } from "@/components/providers/app-provider";
import type { Action } from "@/lib/schemas/action";
import type { StreamEvent } from "@/lib/schemas/event";

/**
 * Yayına hazırlık denetimi — canlı yayında "hiçbir şey olmadı" arızasının önüne geçer.
 *
 * NEDEN: Zincirin herhangi bir halkası eksikse sistem SESSİZCE hiçbir şey yapmaz.
 * Gerçek bir olayda üç halka birden eksikti (TikTok kullanıcı adı boş → connector
 * yayına hiç bağlanmadı; tanımlı etkinlik yok → gelen hediye hiçbir eylemi
 * tetikleyemezdi) ve kullanıcı bunu ancak canlı yayında fark etti. Bu kart o
 * sessiz arızaları yayın ÖNCESİNDE görünür kılar.
 *
 * Salt-okunur: hiçbir şeyi değiştirmez, yalnız eksikleri söyler.
 */
export function Preflight({
  actions,
  events,
  onlineScreens,
  enabled,
}: {
  actions: Action[];
  events: StreamEvent[];
  onlineScreens: Set<number>;
  /** Sayfanın ana "Etkin" anahtarı. */
  enabled: boolean;
}) {
  const t = useTranslations();
  const { backend } = useApp();
  const [username, setUsername] = useState<string | null>(null);

  // setState yalnız await sonrası + iptal korumalı (React Compiler kuralı).
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const settings = await backend.settings.get();
        if (!cancelled) setUsername(settings.tiktok?.username ?? "");
      } catch {
        if (!cancelled) setUsername("");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [backend]);

  // Bir eylemin tetiklenebilmesi için ya bir etkinliğe ya da bir zamanlayıcıya
  // bağlı olması gerekir. Etkinliklerin referans verdiği eylem id kümesi:
  const linked = new Set(
    events.flatMap((e) => [...e.actionsAll, ...e.actionsRandom]),
  );
  const orphans = actions.filter((a) => a.enabled && !linked.has(a.id));
  const activeEvents = events.filter((e) => e.active);

  // Sıra önemli: zincirin en başındaki kopukluk en üstte.
  const problems: string[] = [];
  if (!enabled) problems.push(t("actionsandevents.preflight.masterOff"));
  if (username === "") problems.push(t("actionsandevents.preflight.noUsername"));
  if (actions.length === 0) problems.push(t("actionsandevents.preflight.noActions"));
  else if (activeEvents.length === 0)
    problems.push(t("actionsandevents.preflight.noEvents"));
  else if (orphans.length > 0)
    problems.push(
      t("actionsandevents.preflight.orphanActions", {
        names: orphans.map((a) => a.name).join(", "),
      }),
    );
  if (onlineScreens.size === 0)
    problems.push(t("actionsandevents.preflight.noScreen"));

  // Ayarlar henüz okunmadı — yanlış alarm verme.
  if (username === null) return null;

  const ok = problems.length === 0;

  return (
    <div
      className={
        ok
          ? "flex w-full max-w-[var(--card-w)] items-center gap-3 rounded-[var(--card-radius)] border border-link-blue/40 bg-link-blue/10 px-4 py-3"
          : "w-full max-w-[var(--card-w)] rounded-[var(--card-radius)] border border-warning/40 bg-warning/10 px-4 py-3"
      }
    >
      {ok ? (
        <>
          <CheckCircle2 className="size-4 shrink-0 text-link-blue" aria-hidden />
          <p className="text-sm text-link-blue">{t("actionsandevents.preflight.ready")}</p>
        </>
      ) : (
        <>
          <div className="flex items-center gap-2">
            <AlertTriangle className="size-4 shrink-0 text-warning" aria-hidden />
            <p className="text-sm font-medium text-warning">
              {t("actionsandevents.preflight.title")}
            </p>
          </div>
          <ul className="mt-2 flex flex-col gap-1.5">
            {problems.map((p) => (
              <li key={p} className="flex items-start gap-2 text-xs text-warning">
                <XCircle className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                <span>{p}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
