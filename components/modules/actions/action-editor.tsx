"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Slider, Textarea } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { Toggle } from "@/components/ui/toggle";
import { useToast } from "@/components/ui/toast";
import { useApp } from "@/components/providers/app-provider";
import { uploadActionMedia } from "@/lib/supabase/upload-media";
import {
  SCREEN_MAX,
  SCREEN_MIN,
  SELECTABLE_ACTION_TYPES,
  actionDraftSchema,
  type Action,
  type ActionDraft,
  type ActionType,
} from "@/lib/schemas/action";
import { PLACEHOLDERS } from "@/lib/schemas/live";
import { cn } from "@/lib/utils";

/**
 * Eylem editörü modalı — PRD §5.3 adım sırası:
 * 1) Ad → 2) Ne olsun? (20 tip çoklu seçim) → 3) Görüntüleme süresi →
 * 4) Ödül/bedel → 5) Ek ayarlar → 6) Offline ekran uyarısı + widget URL'si → 7) Kaydet/İptal
 */

function emptyDraft(): ActionDraft {
  // Şema varsayılanlarını tek kaynaktan almak için geçerli bir ad ile parse edip adı boşaltıyoruz;
  // boş ad şemayı geçmez (min 1) ama editörde başlangıç durumu boş olmalı — save() zaten doğruluyor.
  return { ...actionDraftSchema.parse({ name: "—", types: ["showText"] }), name: "" };
}

/** Tip başına yapılandırma alanları — PRD §5.3 tablosu. */
function TypeConfig({
  type,
  draft,
  onChange,
}: {
  type: ActionType;
  draft: ActionDraft;
  onChange: (patch: Partial<ActionDraft["config"]>) => void;
}) {
  const t = useTranslations();
  const toast = useToast();
  const [uploading, setUploading] = useState(false);
  const c = draft.config;

  switch (type) {
    case "showText":
      return (
        <>
          <Field label={t("actionsandevents.actionConfig.text")} htmlFor="cfg-text">
            <Input
              id="cfg-text"
              value={c.text ?? ""}
              onChange={(e) => onChange({ text: e.target.value })}
              placeholder="{username} 🎉"
            />
          </Field>
          <Field label={t("actionsandevents.actionConfig.textColor")} htmlFor="cfg-color">
            <Input
              id="cfg-color"
              type="color"
              className="h-9 w-16 p-1"
              value={c.textColor ?? "#FFFFFF"}
              onChange={(e) => onChange({ textColor: e.target.value })}
            />
          </Field>
        </>
      );

    case "showImage":
    case "playAudio":
    case "playVideoFile": {
      // `blob:` URL yalnız onu üreten sekmede yaşar; sayfa yenilenince ölür.
      // Supabase kuruluyken hiç üretilmez — kuruluysa uyarı gösterilir ki
      // kullanıcı "dosya kaydedilmiyor" sanmasın.
      const isTempMedia = (c.mediaUrl ?? "").startsWith("blob:");
      return (
        <Field
          label={t("actionsandevents.actionConfig.upload")}
          hint={type === "playVideoFile" ? t("actionsandevents.actionConfig.videoHint") : undefined}
          htmlFor={`cfg-media-${type}`}
        >
          <Input
            id={`cfg-media-${type}`}
            type="file"
            accept={
              type === "showImage"
                ? "image/*,application/json"
                : type === "playAudio"
                  ? "audio/*"
                  : "video/*"
            }
            disabled={uploading}
            onChange={(e) => {
              const file = e.target.files?.[0];
              // Aynı dosya tekrar seçilebilsin diye input sıfırlanır (aksi halde
              // change olayı ikinci kez tetiklenmez).
              e.target.value = "";
              if (!file) return;
              // Supabase Storage'a yükle → KALICI public URL. `blob:` URL widget/OBS
              // tarafından okunamadığı için ses/görsel çalmıyordu (migration 0006).
              setUploading(true);
              void uploadActionMedia(file)
                .then((media) => {
                  onChange(media);
                  toast.show(t("actionsandevents.actionConfig.uploaded"), "success");
                })
                .catch((err: unknown) => {
                  const msg = err instanceof Error ? err.message : String(err);
                  toast.show(
                    msg === "notSignedIn"
                      ? t("actionsandevents.actionConfig.uploadSignIn")
                      : t("actionsandevents.actionConfig.uploadFailed"),
                    "error",
                  );
                })
                .finally(() => setUploading(false));
            }}
          />

          {uploading && (
            <p className="text-xs text-muted">{t("actionsandevents.actionConfig.uploading")}</p>
          )}

          {/* Seçili dosya — dosya girdisi kayıtlı değeri gösteremediği için
              yüklenen medya burada ayrıca listelenir (yoksa "kaydedilmedi" sanılıyor). */}
          {!uploading && c.mediaUrl && (
            <div className="flex flex-col gap-2 rounded-lg border border-border-subtle bg-surface-3 p-2.5">
              <div className="flex items-center justify-between gap-2">
                <span className="truncate text-xs text-white" title={c.mediaName ?? c.mediaUrl}>
                  {c.mediaName ?? c.mediaUrl}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => onChange({ mediaUrl: undefined, mediaName: undefined })}
                >
                  {t("common.delete")}
                </Button>
              </div>

              {type === "playAudio" && (
                <audio controls preload="none" src={c.mediaUrl} className="w-full" />
              )}
              {type === "showImage" && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={c.mediaUrl} alt={c.mediaName ?? ""} className="max-h-24 w-fit rounded" />
              )}
              {type === "playVideoFile" && (
                <video controls preload="none" src={c.mediaUrl} className="max-h-32 w-full rounded" />
              )}

              {isTempMedia && (
                <p className="text-xs text-warning">
                  {t("actionsandevents.actionConfig.mediaTemporary")}
                </p>
              )}
            </div>
          )}
        </Field>
      );
    }

    case "showAnimation":
      return (
        <Field label={t("actionsandevents.actionConfig.chooseAnimation")} htmlFor="cfg-anim">
          <Select
            id="cfg-anim"
            value={c.animationId ?? ""}
            onChange={(e) => onChange({ animationId: e.target.value })}
          >
            <option value="">—</option>
            <option value="confetti">Confetti</option>
            <option value="hearts">Hearts</option>
            <option value="fireworks">Fireworks</option>
          </Select>
        </Field>
      );

    case "speakText":
      return (
        <>
          <Field label={t("actionsandevents.actionConfig.ttsText")} htmlFor="cfg-tts">
            <Input
              id="cfg-tts"
              value={c.ttsText ?? ""}
              onChange={(e) => onChange({ ttsText: e.target.value })}
              placeholder="{nickname}: {comment}"
            />
          </Field>
          <Field label={t("actionsandevents.actionConfig.ttsVoice")} htmlFor="cfg-voice">
            <Select
              id="cfg-voice"
              value={c.ttsVoice ?? "default"}
              onChange={(e) => onChange({ ttsVoice: e.target.value })}
            >
              <option value="default">default</option>
              <option value="google_female">google_female</option>
              <option value="google_male">google_male</option>
            </Select>
          </Field>
          <Slider
            label={t("actionsandevents.actionConfig.ttsRate")}
            min={0.1}
            max={3}
            step={0.1}
            value={c.ttsRate ?? 1}
            onChange={(v) => onChange({ ttsRate: v })}
          />
          <Slider
            label={t("actionsandevents.actionConfig.ttsPitch")}
            min={0}
            max={2}
            step={0.1}
            value={c.ttsPitch ?? 1}
            onChange={(v) => onChange({ ttsPitch: v })}
          />
        </>
      );

    case "sendText":
      return (
        <Field label={t("actionsandevents.actionConfig.chatMessage")} htmlFor="cfg-chat">
          <Textarea
            id="cfg-chat"
            value={c.chatMessage ?? ""}
            onChange={(e) => onChange({ chatMessage: e.target.value })}
          />
        </Field>
      );

    case "switchObsScene":
      return (
        <>
          <Field label={t("actionsandevents.actionConfig.obsScene")} htmlFor="cfg-scene">
            <Input
              id="cfg-scene"
              value={c.obsScene ?? ""}
              onChange={(e) => onChange({ obsScene: e.target.value })}
            />
          </Field>
          <Field label={t("actionsandevents.actionConfig.obsBehavior")} htmlFor="cfg-behavior">
            <Select
              id="cfg-behavior"
              value={c.obsSceneBehavior ?? "revertAfterDuration"}
              onChange={(e) =>
                onChange({ obsSceneBehavior: e.target.value as "revertAfterDuration" | "keep" })
              }
            >
              <option value="revertAfterDuration">
                {t("actionsandevents.actionConfig.obsRevert")}
              </option>
              <option value="keep">{t("actionsandevents.actionConfig.obsKeep")}</option>
            </Select>
          </Field>
        </>
      );

    case "activateObsSource":
      return (
        <Field label={t("actionsandevents.actionConfig.obsSource")} htmlFor="cfg-source">
          <Input
            id="cfg-source"
            value={c.obsSource ?? ""}
            onChange={(e) => onChange({ obsSource: e.target.value })}
          />
        </Field>
      );

    case "triggerWebhook":
      return (
        <Field
          label={t("actionsandevents.actionConfig.webhookUrl")}
          hint={t("actionsandevents.actionConfig.webhookHelp")}
          htmlFor="cfg-webhook"
        >
          <Input
            id="cfg-webhook"
            type="url"
            value={c.webhookUrl ?? ""}
            onChange={(e) => onChange({ webhookUrl: e.target.value })}
            placeholder="https://"
          />
        </Field>
      );

    case "triggerMcCmd":
      return (
        <Field label={t("actionsandevents.actionConfig.mcCommand")} htmlFor="cfg-mc">
          <Textarea
            id="cfg-mc"
            value={c.mcCommand ?? ""}
            onChange={(e) => onChange({ mcCommand: e.target.value })}
            placeholder="/give {playername} diamond 1"
          />
        </Field>
      );

    case "simulateKeystroke":
      return (
        <Field label={t("actionsandevents.actionConfig.keystrokeRecord")} htmlFor="cfg-keys">
          <Input
            id="cfg-keys"
            value={(c.keystrokes ?? []).join("+")}
            onChange={(e) => onChange({ keystrokes: e.target.value.split("+").filter(Boolean) })}
            placeholder="ctrl+shift+f1"
          />
        </Field>
      );

    case "execThirdPartyAction":
      return (
        <>
          <Field label={t("actionsandevents.actionConfig.thirdPartyCategory")} htmlFor="cfg-tp-cat">
            <Input
              id="cfg-tp-cat"
              value={c.thirdPartyCategoryId ?? ""}
              onChange={(e) => onChange({ thirdPartyCategoryId: e.target.value })}
            />
          </Field>
          <Field label={t("actionsandevents.actionConfig.thirdPartyAction")} htmlFor="cfg-tp-act">
            <Input
              id="cfg-tp-act"
              value={c.thirdPartyActionId ?? ""}
              onChange={(e) => onChange({ thirdPartyActionId: e.target.value })}
            />
          </Field>
        </>
      );

    case "controlCustomGoal":
      return (
        <>
          <Field label={t("actionsandevents.actionConfig.goal")} htmlFor="cfg-goal">
            <Input
              id="cfg-goal"
              value={c.goalId ?? ""}
              onChange={(e) => onChange({ goalId: e.target.value })}
            />
          </Field>
          <Field label={t("actionsandevents.actionConfig.goalOp")} htmlFor="cfg-goal-op">
            <Select
              id="cfg-goal-op"
              value={c.goalOp ?? "add"}
              onChange={(e) => onChange({ goalOp: e.target.value as "add" | "set" | "reset" })}
            >
              <option value="add">add</option>
              <option value="set">set</option>
              <option value="reset">reset</option>
            </Select>
          </Field>
          <Field label={t("actionsandevents.actionConfig.goalValue")} htmlFor="cfg-goal-val">
            <Input
              id="cfg-goal-val"
              type="number"
              value={c.goalValue ?? 0}
              onChange={(e) => onChange({ goalValue: Number(e.target.value) })}
            />
          </Field>
        </>
      );

    case "setVoicemodVoice":
      return (
        <>
          <Field label={t("actionsandevents.actionConfig.voicemodVoice")} htmlFor="cfg-vm">
            <Input
              id="cfg-vm"
              value={c.voicemodVoice ?? ""}
              onChange={(e) => onChange({ voicemodVoice: e.target.value })}
            />
          </Field>
          <Field label={t("actionsandevents.actionConfig.voicemodDuration")} htmlFor="cfg-vm-dur">
            <Input
              id="cfg-vm-dur"
              type="number"
              value={c.voicemodDuration ?? 10}
              onChange={(e) => onChange({ voicemodDuration: Number(e.target.value) })}
            />
          </Field>
        </>
      );

    case "setStreamerbotAction":
      return (
        <Field label={t("actionsandevents.actionConfig.streamerbotAction")} htmlFor="cfg-sb">
          <Input
            id="cfg-sb"
            value={c.streamerbotActionId ?? ""}
            onChange={(e) => onChange({ streamerbotActionId: e.target.value })}
          />
        </Field>
      );

    case "controlTimer":
      return (
        <Field label={t("actionsandevents.actionConfig.timerSeconds")} htmlFor="cfg-timer">
          <Input
            id="cfg-timer"
            type="number"
            value={c.timerSeconds ?? 0}
            onChange={(e) => onChange({ timerSeconds: Number(e.target.value) })}
          />
        </Field>
      );

    case "addPoints":
    case "removePoints":
      return (
        <Field label={t("actionsandevents.actionConfig.pointsAmount")} htmlFor="cfg-points">
          <Input
            id="cfg-points"
            type="number"
            min={0}
            value={c.points ?? 0}
            onChange={(e) => onChange({ points: Number(e.target.value) })}
          />
        </Field>
      );

    default:
      return null;
  }
}

export function ActionEditor({
  open,
  action,
  onClose,
  onSaved,
}: {
  open: boolean;
  action: Action | null;
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  const t = useTranslations();
  const { backend, refresh } = useApp();

  /**
   * Başlangıç durumu prop'tan bir kez türetilir; editör her açılışta `key` ile
   * yeniden monte edildiği için (bkz. çağıran taraf) effect+setState'e gerek yok.
   */
  const [draft, setDraft] = useState<ActionDraft>(() => {
    if (!action) return emptyDraft();
    const { id: _id, ...rest } = action;
    return rest;
  });
  const [nameError, setNameError] = useState<string | null>(null);
  /** Kaydetme hatası — sessizce yutulursa "kaydedilmiyor" gibi görünür. */
  const [saveError, setSaveError] = useState<string | null>(null);

  // Widget URL'si yalnız origin + ekran numarasına bağlı — türetilmiş değer, state değil.
  const widgetUrl = backend.widgets.url("myactions", { screen: draft.screen });

  function patch(next: Partial<ActionDraft>) {
    setDraft((d) => ({ ...d, ...next }));
  }

  /**
   * Config alanlarını GÜNCEL taslak üzerinden birleştirir.
   * Fonksiyonel güncelleme şart: medya yüklemesi asenkron bittiğinde çağıran
   * closure eski `draft`i taşıyor olabilir — `{...draft.config}` ile birleştirmek
   * yükleme sırasında yapılan diğer config değişikliklerini siliyordu.
   */
  function patchConfig(cfg: Partial<ActionDraft["config"]>) {
    setDraft((d) => ({ ...d, config: { ...d.config, ...cfg } }));
  }

  function toggleType(type: ActionType) {
    setDraft((d) => ({
      ...d,
      types: d.types.includes(type)
        ? d.types.filter((x) => x !== type)
        : [...d.types, type],
    }));
  }

  async function save() {
    if (!draft.name.trim()) {
      setNameError(t("validation.required"));
      return;
    }
    // Tekrar eden ad — PRD §5.3 editör hatası.
    if (await backend.actions.nameExists(draft.name, action?.id)) {
      setNameError(t("validation.duplicateName"));
      return;
    }
    if (draft.types.length === 0) {
      setNameError(t("actionsandevents.editor.selectAtLeastOneType"));
      return;
    }

    setSaveError(null);
    try {
      if (action) {
        await backend.actions.update(action.id, draft);
      } else {
        await backend.actions.create(draft);
      }
    } catch (err) {
      // Şema doğrulaması/depolama hatası — modal açık kalır ve sebep gösterilir.
      setSaveError(err instanceof Error ? err.message : String(err));
      return;
    }
    refresh();
    onSaved(t("actionsandevents.toast.actionSaved"));
    onClose();
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title={action ? t("actionsandevents.editor.editAction") : t("actionsandevents.editor.newAction")}
      footer={
        <>
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
        {/* 1 — Ad */}
        <Field
          label={t("actionsandevents.editor.nameLabel")}
          error={nameError ?? undefined}
          htmlFor="action-name"
          required
        >
          <Input
            id="action-name"
            value={draft.name}
            aria-invalid={!!nameError}
            placeholder={t("actionsandevents.editor.namePlaceholder")}
            onChange={(e) => {
              patch({ name: e.target.value });
              setNameError(null);
            }}
          />
        </Field>

        {/* 2 — Ne olsun? (çoklu seçim, 20 tip) */}
        <fieldset>
          <legend className="mb-2 text-sm font-medium text-white">
            {t("actionsandevents.editor.whatHappens")}
          </legend>
          <div className="grid grid-cols-2 gap-1.5 md:grid-cols-3">
            {SELECTABLE_ACTION_TYPES.map((type) => (
              <button
                key={type}
                type="button"
                aria-pressed={draft.types.includes(type)}
                onClick={() => toggleType(type)}
                className={cn(
                  "rounded-lg border px-2.5 py-2 text-left text-xs transition-colors duration-200",
                  draft.types.includes(type)
                    ? "border-border-maroon bg-primary/20 text-white"
                    : "border-border-subtle bg-surface-2 text-muted-2 hover:border-border-soft hover:text-white",
                )}
              >
                {t(`actionsandevents.actionType.${type}`)}
              </button>
            ))}
          </div>
        </fieldset>

        {/* Seçili tiplerin yapılandırma alanları */}
        {draft.types.length > 0 && (
          <div className="flex flex-col gap-4 rounded-lg border border-border-subtle bg-surface-2 p-4">
            {draft.types.map((type) => (
              <div key={type} className="flex flex-col gap-3">
                <p className="text-xs font-medium tracking-wide text-heading uppercase">
                  {t(`actionsandevents.actionType.${type}`)}
                </p>
                <TypeConfig
                  type={type}
                  draft={draft}
                  onChange={patchConfig}
                />
              </div>
            ))}

            <details className="text-xs text-muted">
              <summary className="cursor-pointer hover:text-white">
                {t("actionsandevents.actionConfig.placeholders")}
              </summary>
              <p className="mt-2 font-mono leading-relaxed break-words">
                {PLACEHOLDERS.map((p) => `{${p}}`).join(" ")}
              </p>
            </details>
          </div>
        )}

        {/* 3-4 — Süre + ödül/bedel */}
        <div className="grid gap-3 md:grid-cols-2">
          <Field label={t("actionsandevents.editor.durationLabel")} htmlFor="action-duration">
            <Input
              id="action-duration"
              type="number"
              min={0}
              value={draft.durationSec}
              onChange={(e) => patch({ durationSec: Number(e.target.value) })}
            />
          </Field>
          <Field label={t("actionsandevents.editor.rewardLabel")} htmlFor="action-points">
            <Input
              id="action-points"
              type="number"
              value={draft.pointsDelta}
              onChange={(e) => patch({ pointsDelta: Math.trunc(Number(e.target.value)) })}
            />
          </Field>
        </div>

        {/* 5 — Ek ayarlar */}
        <details open className="rounded-lg border border-border-subtle p-4">
          <summary className="cursor-pointer text-sm font-medium text-white">
            {t("actionsandevents.editor.extraSettings")}
          </summary>

          <div className="mt-4 flex flex-col gap-4">
            <Slider
              label={t("actionsandevents.editor.volume")}
              value={draft.volume}
              onChange={(v) => patch({ volume: v })}
              suffix="%"
            />

            <div className="grid gap-3 md:grid-cols-3">
              <Field label={t("actionsandevents.editor.screen")} htmlFor="action-screen">
                <Select
                  id="action-screen"
                  value={draft.screen}
                  onChange={(e) => patch({ screen: Number(e.target.value) })}
                >
                  {Array.from({ length: SCREEN_MAX - SCREEN_MIN + 1 }, (_, i) => i + SCREEN_MIN).map(
                    (n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ),
                  )}
                </Select>
              </Field>
              <Field label={t("actionsandevents.editor.globalCooldown")} htmlFor="action-gcd">
                <Input
                  id="action-gcd"
                  type="number"
                  min={0}
                  value={draft.globalCooldownSec}
                  onChange={(e) => patch({ globalCooldownSec: Number(e.target.value) })}
                />
              </Field>
              <Field label={t("actionsandevents.editor.userCooldown")} htmlFor="action-ucd">
                <Input
                  id="action-ucd"
                  type="number"
                  min={0}
                  value={draft.userCooldownSec}
                  onChange={(e) => patch({ userCooldownSec: Number(e.target.value) })}
                />
              </Field>
              <Field label={t("actionsandevents.editor.fadeIn")} htmlFor="action-fadein">
                <Input
                  id="action-fadein"
                  type="number"
                  min={0}
                  value={draft.fadeInMs}
                  onChange={(e) => patch({ fadeInMs: Number(e.target.value) })}
                />
              </Field>
              <Field label={t("actionsandevents.editor.fadeOut")} htmlFor="action-fadeout">
                <Input
                  id="action-fadeout"
                  type="number"
                  min={0}
                  value={draft.fadeOutMs}
                  onChange={(e) => patch({ fadeOutMs: Number(e.target.value) })}
                />
              </Field>
            </div>

            <Toggle
              checked={draft.repeatWithCombos}
              onChange={(v) => patch({ repeatWithCombos: v })}
              label={t("actionsandevents.editor.repeatCombos")}
            />
            <Toggle
              checked={draft.skipOnNextAction}
              onChange={(v) => patch({ skipOnNextAction: v })}
              label={t("actionsandevents.editor.skipOnNext")}
            />

            <Field label={t("actionsandevents.editor.description")} htmlFor="action-desc">
              <Input
                id="action-desc"
                value={draft.description}
                onChange={(e) => patch({ description: e.target.value })}
              />
            </Field>
          </div>
        </details>

        {/* 6 — Offline ekran uyarısı + widget URL'si */}
        <div className="rounded-lg border border-border-soft bg-surface-2 p-3">
          <p className="mb-2 text-xs text-warning">
            {t("actionsandevents.editor.offlineWarning")}
          </p>
          <div className="flex items-center gap-2">
            <Input readOnly value={widgetUrl} className="font-mono text-xs" />
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => void navigator.clipboard.writeText(widgetUrl)}
            >
              {t("common.copy")}
            </Button>
          </div>
        </div>

        {saveError && (
          <p role="alert" className="text-xs text-error">
            {t("common.error")} — {saveError}
          </p>
        )}
      </div>
    </Modal>
  );
}
