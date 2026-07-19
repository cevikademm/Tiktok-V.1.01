"use client";

import { ChevronDown, Copy, Download, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { useApp } from "@/components/providers/app-provider";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Slider } from "@/components/ui/field";
import { Toggle } from "@/components/ui/toggle";
import { useToast } from "@/components/ui/toast";
import {
  GAME_IDS,
  MAX_STREAM_PROFILES,
  type GameId,
  type ProfileSettings,
  type StreamProfile,
  type StreamProfileDraft,
} from "@/lib/schemas/stream-profile";
import { cn } from "@/lib/utils";
import { useProfileLabel } from "./profile-label";

/** Sayı ile düzenlenen ayar alanları — `setNumber` yalnız bunları kabul eder. */
type NumericSettingKey =
  | "ttsVolume"
  | "soundsVolume"
  | "pointsMultiplierPercent"
  | "overlayScreen"
  | "giftMinCoins"
  | "cooldownSeconds";

/**
 * Tek profil kartı — bağlı oyun, otomatik geçiş kuralı ve ayar seti.
 * Değişiklikler anında kaydedilir (mock store); metin alanları odak çıkışında.
 */
export function ProfileCard({
  profile,
  index,
  isActive,
  canDelete,
}: {
  profile: StreamProfile;
  index: number;
  isActive: boolean;
  canDelete: boolean;
}) {
  const t = useTranslations();
  const { backend } = useApp();
  const toast = useToast();
  const label = useProfileLabel();
  const [open, setOpen] = useState(false);

  function update(patch: Partial<StreamProfileDraft>) {
    void backend.profiles.update(profile.id, patch);
  }

  function setSetting<K extends keyof ProfileSettings>(key: K, value: ProfileSettings[K]) {
    update({ settings: { ...profile.settings, [key]: value } });
  }

  /** Boşaltılan sayı alanı NaN üretir; şema reddeder — o yüzden yazmadan önce süz. */
  function setNumber(key: NumericSettingKey, raw: string) {
    const value = Number(raw);
    if (!Number.isFinite(value)) return;
    setSetting(key, value);
  }

  async function handleExport() {
    const json = await backend.profiles.exportProfile(profile.id);
    const url = URL.createObjectURL(new Blob([json], { type: "application/json" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${profile.id}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  async function handleDuplicate() {
    try {
      await backend.profiles.duplicate(profile.id);
      toast.show(t("streamProfiles.toast.added"));
    } catch {
      // Tek olası hata sınır aşımı — mesajı i18n'den ver (ham string yok).
      toast.show(
        t("streamProfiles.errors.limit", { max: MAX_STREAM_PROFILES }),
        "error",
      );
    }
  }

  async function handleDelete() {
    if (!confirm(t("streamProfiles.deleteConfirm"))) return;
    try {
      await backend.profiles.remove(profile.id);
      toast.show(t("streamProfiles.toast.deleted"));
    } catch {
      toast.show(t("streamProfiles.errors.last"), "error");
    }
  }

  return (
    <div
      className={cn(
        "rounded-[var(--card-radius)] border bg-surface-2",
        isActive ? "border-border-maroon" : "border-border-subtle",
      )}
    >
      <div className="flex flex-wrap items-center gap-2 p-3">
        <span aria-hidden className="text-lg">
          {profile.emoji}
        </span>
        <span className="flex-1 truncate text-sm font-medium text-white">
          {label(profile, index)}
        </span>

        {isActive ? (
          <span className="rounded bg-primary px-2 py-0.5 text-xs text-white">
            {t("streamProfiles.activeBadge")}
          </span>
        ) : (
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              void backend.profiles.activate(profile.id, { manual: true });
              toast.show(
                t("streamProfiles.toast.activated", { name: label(profile, index) }),
              );
            }}
          >
            {t("streamProfiles.activate")}
          </Button>
        )}

        <Button
          variant="ghost"
          size="icon"
          aria-label={t("streamProfiles.duplicate")}
          onClick={() => void handleDuplicate()}
        >
          <Copy className="size-4" aria-hidden />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          aria-label={t("streamProfiles.export")}
          onClick={() => void handleExport()}
        >
          <Download className="size-4" aria-hidden />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          aria-label={t("streamProfiles.delete")}
          disabled={!canDelete}
          onClick={() => void handleDelete()}
        >
          <Trash2 className="size-4" aria-hidden />
        </Button>

        <Button
          variant="ghost"
          size="icon"
          aria-label={t("streamProfiles.settings.title")}
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
        >
          <ChevronDown
            className={cn("size-4 transition-transform", open && "rotate-180")}
            aria-hidden
          />
        </Button>
      </div>

      {open && (
        <div className="grid gap-4 border-t border-border-subtle p-4 md:grid-cols-2">
          {/* Kimlik + otomatik geçiş kuralı */}
          <div className="flex flex-col gap-3">
            <Field label={t("streamProfiles.fields.name")}>
              <Input
                defaultValue={profile.name}
                placeholder={t("streamProfiles.fields.namePlaceholder")}
                maxLength={32}
                onBlur={(e) => update({ name: e.target.value })}
              />
            </Field>

            <Field label={t("streamProfiles.fields.emoji")}>
              <Input
                defaultValue={profile.emoji}
                maxLength={8}
                onBlur={(e) => update({ emoji: e.target.value.trim() || profile.emoji })}
              />
            </Field>

            <Field label={t("streamProfiles.fields.game")}>
              <Select
                value={profile.autoSwitch.gameId ?? ""}
                onChange={(e) =>
                  update({
                    autoSwitch: {
                      ...profile.autoSwitch,
                      gameId: e.target.value ? (e.target.value as GameId) : null,
                    },
                  })
                }
              >
                <option value="">{t("streamProfiles.noGame")}</option>
                {GAME_IDS.map((id) => (
                  <option key={id} value={id}>
                    {t(`streamProfiles.games.${id}`)}
                  </option>
                ))}
              </Select>
            </Field>

            <Field
              label={t("streamProfiles.fields.keywords")}
              hint={t("streamProfiles.fields.keywordsHint")}
            >
              <Input
                defaultValue={profile.autoSwitch.keywords.join(", ")}
                onBlur={(e) =>
                  update({
                    autoSwitch: {
                      ...profile.autoSwitch,
                      keywords: e.target.value
                        .split(",")
                        .map((k) => k.trim())
                        .filter(Boolean)
                        .slice(0, 10),
                    },
                  })
                }
              />
            </Field>

            <Toggle
              checked={profile.autoSwitch.enabled}
              onChange={(next) =>
                update({ autoSwitch: { ...profile.autoSwitch, enabled: next } })
              }
              label={t("streamProfiles.fields.autoEnabled")}
            />
          </div>

          {/* Ayar seti */}
          <div className="flex flex-col gap-3">
            <h3 className="text-sm font-semibold text-white">
              {t("streamProfiles.settings.title")}
            </h3>

            <Toggle
              checked={profile.settings.ttsEnabled}
              onChange={(next) => setSetting("ttsEnabled", next)}
              label={t("streamProfiles.settings.tts")}
            />
            <Slider
              value={profile.settings.ttsVolume}
              onChange={(next) => setSetting("ttsVolume", next)}
              label={t("streamProfiles.settings.ttsVolume")}
              suffix="%"
            />

            <Toggle
              checked={profile.settings.soundsEnabled}
              onChange={(next) => setSetting("soundsEnabled", next)}
              label={t("streamProfiles.settings.sounds")}
            />
            <Slider
              value={profile.settings.soundsVolume}
              onChange={(next) => setSetting("soundsVolume", next)}
              label={t("streamProfiles.settings.soundsVolume")}
              suffix="%"
            />

            <Toggle
              checked={profile.settings.actionsEnabled}
              onChange={(next) => setSetting("actionsEnabled", next)}
              label={t("streamProfiles.settings.actions")}
            />
            <Toggle
              checked={profile.settings.chatbotEnabled}
              onChange={(next) => setSetting("chatbotEnabled", next)}
              label={t("streamProfiles.settings.chatbot")}
            />
            <Toggle
              checked={profile.settings.songRequestsEnabled}
              onChange={(next) => setSetting("songRequestsEnabled", next)}
              label={t("streamProfiles.settings.songRequests")}
            />

            <div className="grid grid-cols-2 gap-3">
              <Field label={t("streamProfiles.settings.pointsMultiplier")}>
                <Input
                  type="number"
                  min={0}
                  max={1000}
                  step={10}
                  value={profile.settings.pointsMultiplierPercent}
                  onChange={(e) => setNumber("pointsMultiplierPercent", e.target.value)}
                />
              </Field>

              <Field label={t("streamProfiles.settings.overlayScreen")}>
                <Select
                  value={profile.settings.overlayScreen}
                  onChange={(e) => setNumber("overlayScreen", e.target.value)}
                >
                  {Array.from({ length: 8 }, (_, i) => i + 1).map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </Select>
              </Field>

              <Field label={t("streamProfiles.settings.giftMinCoins")}>
                <Input
                  type="number"
                  min={0}
                  value={profile.settings.giftMinCoins}
                  onChange={(e) => setNumber("giftMinCoins", e.target.value)}
                />
              </Field>

              <Field label={t("streamProfiles.settings.cooldown")}>
                <Input
                  type="number"
                  min={0}
                  max={3600}
                  value={profile.settings.cooldownSeconds}
                  onChange={(e) => setNumber("cooldownSeconds", e.target.value)}
                />
              </Field>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
