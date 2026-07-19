"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { useApp } from "@/components/providers/app-provider";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { GIFT_CATALOG } from "@/lib/data/mock/simulator";
import {
  eventSchema,
  eventSignature,
  triggerTypeSchema,
  triggerWhoSchema,
  type EventConditions,
  type StreamEvent,
  type TriggerType,
  type TriggerWho,
} from "@/lib/schemas/event";
import { cn } from "@/lib/utils";

/**
 * Etkinlik editörü modalı — PRD §5.3:
 * 15 tetikleyici + koşul alanları + 6 rol ("kim tetikleyebilir") + eylem bağlama.
 */

type EventDraft = Omit<StreamEvent, "id">;

function emptyDraft(): EventDraft {
  return {
    active: true,
    trigger: "follow",
    who: "any",
    conditions: {},
    actionsAll: [],
    actionsRandom: [],
  };
}

/** Tetikleyiciye özgü koşul alanları — PRD §5.3 tablosu. */
function TriggerConditions({
  trigger,
  conditions,
  onChange,
}: {
  trigger: TriggerType;
  conditions: EventConditions;
  onChange: (patch: Partial<EventConditions>) => void;
}) {
  const t = useTranslations();

  switch (trigger) {
    case "command":
      return (
        <>
          <Field
            label={t("actionsandevents.eventEditor.commandLabel")}
            hint={t("actionsandevents.eventEditor.commandHint")}
            htmlFor="cond-command"
            required
          >
            <Input
              id="cond-command"
              value={conditions.command ?? ""}
              placeholder={t("actionsandevents.eventEditor.commandPlaceholder")}
              onChange={(e) => onChange({ command: e.target.value })}
            />
          </Field>
          <Field label={t("actionsandevents.eventEditor.minTeamLevel")} htmlFor="cond-team">
            <Input
              id="cond-team"
              type="number"
              min={0}
              value={conditions.minTeamLevel ?? 0}
              onChange={(e) => onChange({ minTeamLevel: Number(e.target.value) })}
            />
          </Field>
          <Field label={t("actionsandevents.eventEditor.minPointsLevel")} htmlFor="cond-plevel">
            <Input
              id="cond-plevel"
              type="number"
              min={0}
              value={conditions.minPointsLevel ?? 0}
              onChange={(e) => onChange({ minPointsLevel: Number(e.target.value) })}
            />
          </Field>
        </>
      );

    case "gift_min":
      return (
        <Field label={t("actionsandevents.eventEditor.minCoins")} htmlFor="cond-coins" required>
          <Input
            id="cond-coins"
            type="number"
            min={1}
            value={conditions.minCoins ?? 1}
            onChange={(e) => onChange({ minCoins: Number(e.target.value) })}
          />
        </Field>
      );

    case "gift_specific":
      return (
        <Field label={t("actionsandevents.eventEditor.giftLabel")} htmlFor="cond-gift" required>
          <Select
            id="cond-gift"
            value={conditions.giftId ?? ""}
            onChange={(e) => {
              const gift = GIFT_CATALOG.find((g) => g.id === e.target.value);
              onChange({ giftId: e.target.value, giftName: gift?.name });
            }}
          >
            <option value="">—</option>
            {GIFT_CATALOG.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name} ({g.coins})
              </option>
            ))}
          </Select>
        </Field>
      );

    case "gift_likes_min":
      return (
        <Field label={t("actionsandevents.eventEditor.minLikes")} htmlFor="cond-likes" required>
          <Input
            id="cond-likes"
            type="number"
            min={1}
            value={conditions.minLikes ?? 15}
            onChange={(e) => onChange({ minLikes: Number(e.target.value) })}
          />
        </Field>
      );

    case "emote_specific":
      return (
        <Field label={t("actionsandevents.eventEditor.emoteLabel")} htmlFor="cond-emote" required>
          <Input
            id="cond-emote"
            value={conditions.emoteId ?? ""}
            onChange={(e) => onChange({ emoteId: e.target.value })}
          />
        </Field>
      );

    case "sticker_specific":
    case "fanclub_sticker_specific":
      return (
        <Field label={t("actionsandevents.eventEditor.stickerLabel")} htmlFor="cond-sticker" required>
          <Input
            id="cond-sticker"
            value={conditions.stickerId ?? ""}
            onChange={(e) => onChange({ stickerId: e.target.value })}
          />
        </Field>
      );

    case "shop_purchase":
      return (
        <Field label={t("actionsandevents.eventEditor.productContains")} htmlFor="cond-product">
          <Input
            id="cond-product"
            value={conditions.productNameContains ?? ""}
            onChange={(e) => onChange({ productNameContains: e.target.value })}
          />
        </Field>
      );

    default:
      return null;
  }
}

export function EventEditor({
  open,
  event,
  onClose,
  onSaved,
}: {
  open: boolean;
  event: StreamEvent | null;
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  const t = useTranslations();
  const { backend, actions, refresh } = useApp();

  /** Başlangıç durumu prop'tan bir kez türetilir — çağıran taraf `key` ile remount eder. */
  const [draft, setDraft] = useState<EventDraft>(() => {
    if (!event) return emptyDraft();
    const { id: _id, ...rest } = event;
    return rest;
  });
  const [error, setError] = useState<string | null>(null);

  function patch(next: Partial<EventDraft>) {
    setDraft((d) => ({ ...d, ...next }));
    setError(null);
  }

  function toggleAction(id: string, list: "actionsAll" | "actionsRandom") {
    setDraft((d) => ({
      ...d,
      [list]: d[list].includes(id) ? d[list].filter((x) => x !== id) : [...d[list], id],
    }));
    setError(null);
  }

  async function save() {
    /**
     * Şema doğrulaması — `eventSchema` refine'ları burada çalışmalı:
     * "en az bir eylem bağlı" ve "tetikleyicinin zorunlu koşulu dolu" kuralları
     * yalnız Zod'da tanımlı; parse etmezsek ör. `gift_min` koşulsuz kaydedilir.
     * id sunucuda üretildiği için doğrulamada yer tutucu veriyoruz.
     */
    const parsed = eventSchema.safeParse({ ...draft, id: event?.id ?? "draft" });
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      // Refine mesajları i18n anahtarıdır (lib/schemas/event.ts).
      setError(t(`validation.${issue.message}`));
      return;
    }

    // Aynı tetikleyici ayarları — PRD §5.3 tekrar hatası.
    const signature = eventSignature(draft);
    if (await backend.events.signatureExists(signature, event?.id)) {
      setError(t("validation.duplicateEvent"));
      return;
    }

    if (event) {
      await backend.events.update(event.id, draft);
    } else {
      await backend.events.create(draft);
    }
    refresh();
    onSaved(t("actionsandevents.toast.eventSaved"));
    onClose();
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title={event ? t("actionsandevents.editor.editEvent") : t("actionsandevents.editor.newEvent")}
      footer={
        <>
          {/* Hata butonun yanında — modal uzun, aşağıdaki mesaj gözden kaçıyordu
              ve buton "basmıyor" gibi görünüyordu (bkz. action-editor.tsx). */}
          {error && (
            <p role="alert" className="mr-auto self-center text-xs text-error">
              {error}
            </p>
          )}
          <Button variant="ghost" size="sm" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button size="sm" onClick={save}>
            {t("common.save")}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-5">
        {/* Tetikleyici — 15 tip */}
        <fieldset>
          <legend className="mb-2 text-sm font-medium text-white">
            {t("actionsandevents.eventEditor.triggerLabel")}
          </legend>
          <div className="grid grid-cols-2 gap-1.5 md:grid-cols-3">
            {triggerTypeSchema.options.map((trigger) => (
              <button
                key={trigger}
                type="button"
                aria-pressed={draft.trigger === trigger}
                onClick={() => patch({ trigger, conditions: {} })}
                className={cn(
                  "rounded-lg border px-2.5 py-2 text-left text-xs transition-colors duration-200",
                  draft.trigger === trigger
                    ? "border-border-maroon bg-primary/20 text-white"
                    : "border-border-subtle bg-surface-2 text-muted-2 hover:border-border-soft hover:text-white",
                )}
              >
                {t(`actionsandevents.trigger.${trigger}`)}
              </button>
            ))}
          </div>
        </fieldset>

        {/* Koşullar */}
        <div className="flex flex-col gap-3 rounded-lg border border-border-subtle bg-surface-2 p-4">
          <p className="text-xs font-medium tracking-wide text-heading uppercase">
            {t("actionsandevents.eventEditor.conditionsLabel")}
          </p>
          <TriggerConditions
            trigger={draft.trigger}
            conditions={draft.conditions}
            onChange={(cfg) => patch({ conditions: { ...draft.conditions, ...cfg } })}
          />
          {draft.trigger !== "command" &&
            !["gift_min", "gift_specific", "gift_likes_min", "emote_specific", "sticker_specific", "fanclub_sticker_specific", "shop_purchase"].includes(
              draft.trigger,
            ) && <p className="text-xs text-muted">—</p>}
        </div>

        {/* Kim tetikleyebilir — 6 rol */}
        <Field label={t("actionsandevents.eventEditor.whoLabel")} htmlFor="event-who">
          <Select
            id="event-who"
            value={draft.who}
            onChange={(e) => patch({ who: e.target.value as TriggerWho })}
          >
            {triggerWhoSchema.options.map((who) => (
              <option key={who} value={who}>
                {t(`actionsandevents.who.${who}`)}
              </option>
            ))}
          </Select>
        </Field>

        {draft.who === "topgifter" && (
          <Field label={t("actionsandevents.eventEditor.topGifterCount")} htmlFor="who-count">
            <Input
              id="who-count"
              type="number"
              min={1}
              value={draft.conditions.topGifterCount ?? 1}
              onChange={(e) =>
                patch({
                  conditions: { ...draft.conditions, topGifterCount: Number(e.target.value) },
                })
              }
            />
          </Field>
        )}

        {draft.who === "specific_user" && (
          <Field label={t("actionsandevents.eventEditor.specificUser")} htmlFor="who-user">
            <Input
              id="who-user"
              value={draft.conditions.specificUsername ?? ""}
              placeholder="@kullaniciadi"
              onChange={(e) =>
                patch({
                  conditions: { ...draft.conditions, specificUsername: e.target.value },
                })
              }
            />
          </Field>
        )}

        {/* Eylem bağlama */}
        {actions.length === 0 ? (
          <p className="rounded-lg border border-border-soft bg-surface-2 p-3 text-sm text-muted">
            {t("actionsandevents.eventEditor.noActionsAvailable")}
          </p>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {(["actionsAll", "actionsRandom"] as const).map((list) => (
              <fieldset key={list}>
                <legend className="mb-2 text-sm font-medium text-white">
                  {t(`actionsandevents.eventEditor.${list}`)}
                </legend>
                <div className="flex flex-col gap-1">
                  {actions.map((a) => (
                    <label
                      key={a.id}
                      className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-sm text-muted-2 hover:bg-white/8 hover:text-white"
                    >
                      <input
                        type="checkbox"
                        checked={draft[list].includes(a.id)}
                        onChange={() => toggleAction(a.id, list)}
                        className="accent-[var(--primary)]"
                      />
                      {a.name}
                    </label>
                  ))}
                </div>
              </fieldset>
            ))}
          </div>
        )}

        {error && (
          <p role="alert" className="text-sm text-error">
            {error}
          </p>
        )}
      </div>
    </Modal>
  );
}
