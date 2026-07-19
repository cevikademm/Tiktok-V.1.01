"use client";

import { Wand2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { useApp } from "@/components/providers/app-provider";
import { Button } from "@/components/ui/button";
import { Field, Select } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import {
  eventSignature,
  type EventConditions,
  type StreamEvent,
  type TriggerType,
} from "@/lib/schemas/event";

/**
 * Toplu etkinlik kurulumu — "bütün etkinlikleri ayarla".
 *
 * NEDEN: 15 tetikleyicinin her biri için ayrı ayrı etkinlik oluşturmak
 * (tetikleyici seç → koşul doldur → eylem işaretle → kaydet) çok adımlı ve
 * hata yapmaya açık; kullanıcı bir adımı atladığında etkinlik SESSİZCE
 * kaydolmuyor. Bu, tek eylemi tüm yaygın tetikleyicilere tek tıkla bağlar.
 *
 * KAPSAM SINIRI: yalnız otomatik doldurulabilecek koşulu olan tetikleyiciler
 * kurulur. `command` (komut metni), `gift_specific` (hangi hediye),
 * `emote_specific` / `sticker_specific` / `fanclub_sticker_specific` (kimlik)
 * kullanıcıya özel değer istediği için DIŞARIDA bırakıldı — makul bir varsayılan
 * uydurmak, kullanıcının kurduğunu sandığı ama asla eşleşmeyen kural üretirdi.
 */

/** Kurulacak tetikleyiciler ve (gerekiyorsa) varsayılan koşulları. */
const BULK_TRIGGERS: { trigger: TriggerType; conditions: EventConditions }[] = [
  { trigger: "chat", conditions: {} },
  { trigger: "follow", conditions: {} },
  { trigger: "subscribe", conditions: {} },
  { trigger: "join", conditions: {} },
  // "Paylaşım" bu şemada `invite` anahtarıdır — ayrı bir `share` tetikleyicisi yok.
  { trigger: "invite", conditions: {} },
  { trigger: "raid", conditions: {} },
  { trigger: "first_activity", conditions: {} },
  { trigger: "shop_purchase", conditions: {} },
  // 1 coin: TikTok'taki EN UCUZ hediye bile bu eşiği geçer → "her hediye" demek.
  { trigger: "gift_min", conditions: { minCoins: 1 } },
  { trigger: "gift_likes_min", conditions: { minLikes: 15 } },
];

export function BulkEventsButton() {
  const t = useTranslations();
  const toast = useToast();
  const { backend, actions, events, refresh } = useApp();

  const [open, setOpen] = useState(false);
  const [actionId, setActionId] = useState("");
  const [busy, setBusy] = useState(false);

  const selectedId = actionId || actions[0]?.id || "";

  async function run() {
    if (!selectedId) return;
    setBusy(true);
    let created = 0;
    let skipped = 0;
    try {
      for (const { trigger, conditions } of BULK_TRIGGERS) {
        const draft: Omit<StreamEvent, "id"> = {
          active: true,
          trigger,
          who: "any",
          conditions,
          actionsAll: [selectedId],
          actionsRandom: [],
        };
        // Tekrar koruması — aynı tetikleyici ayarı zaten varsa dokunma
        // (kullanıcının elle kurduğu kuralı ezmeyelim).
        if (await backend.events.signatureExists(eventSignature(draft))) {
          skipped += 1;
          continue;
        }
        await backend.events.create(draft);
        created += 1;
      }
      refresh();
      setOpen(false);
      toast.show(t("actionsandevents.bulkEvents.done", { created, skipped }), "success");
    } catch (err) {
      toast.show(err instanceof Error ? err.message : String(err), "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Button
        variant="secondary"
        size="sm"
        disabled={actions.length === 0}
        title={t("actionsandevents.bulkEvents.hint")}
        onClick={() => setOpen(true)}
      >
        <Wand2 className="size-3.5" aria-hidden />
        {t("actionsandevents.bulkEvents.button")}
      </Button>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        size="sm"
        title={t("actionsandevents.bulkEvents.title")}
        footer={
          <>
            <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
              {t("common.cancel")}
            </Button>
            <Button size="sm" disabled={busy || !selectedId} onClick={() => void run()}>
              {busy ? t("common.loading") : t("common.save")}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <p className="text-sm text-muted">{t("actionsandevents.bulkEvents.hint")}</p>

          <Field label={t("actionsandevents.table.actionToExecute")} htmlFor="bulk-action">
            <Select
              id="bulk-action"
              value={selectedId}
              onChange={(e) => setActionId(e.target.value)}
            >
              {actions.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </Select>
          </Field>

          <div>
            <p className="mb-1.5 text-xs font-medium text-white">
              {t("actionsandevents.bulkEvents.willCreate", { count: BULK_TRIGGERS.length })}
            </p>
            <ul className="flex flex-wrap gap-1.5">
              {BULK_TRIGGERS.map(({ trigger }) => (
                <li
                  key={trigger}
                  className="rounded border border-border-subtle bg-surface-2 px-2 py-1 text-xs text-muted-2"
                >
                  {t(`actionsandevents.trigger.${trigger}`)}
                </li>
              ))}
            </ul>
          </div>

          <p className="text-xs text-muted-2">{t("actionsandevents.bulkEvents.skipNote")}</p>
          {events.length > 0 && (
            <p className="text-xs text-muted-2">{t("actionsandevents.bulkEvents.existingNote")}</p>
          )}
        </div>
      </Modal>
    </>
  );
}
