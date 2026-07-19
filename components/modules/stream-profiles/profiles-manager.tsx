"use client";

import { Plus, RotateCcw, Upload } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { useApp } from "@/components/providers/app-provider";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardTitle } from "@/components/ui/card";
import { Field, Input, Select } from "@/components/ui/field";
import { Toggle } from "@/components/ui/toggle";
import { useToast } from "@/components/ui/toast";
import { useMockStore } from "@/lib/data/mock/use-store";
import {
  draftForGame,
  GAME_IDS,
  MAX_STREAM_PROFILES,
  PROFILE_LAST_ERROR,
  PROFILE_LIMIT_ERROR,
  type GameId,
  type SwitchDecision,
} from "@/lib/schemas/stream-profile";
import { ProfileCard } from "./profile-card";
import { useProfileLabel } from "./profile-label";

/**
 * Akış Profilleri yönetimi — docs/sekmeler/06-akis-profilleri.md.
 * Üç blok: otomatik geçiş ayarları · oyun sinyali · profil listesi (ekle/sil/içe aktar).
 */
export function ProfilesManager() {
  const t = useTranslations();
  const { backend } = useApp();
  const toast = useToast();
  const label = useProfileLabel();
  const state = useMockStore();
  const fileRef = useRef<HTMLInputElement>(null);

  const [signalGame, setSignalGame] = useState<GameId | "">("");
  const [signalTitle, setSignalTitle] = useState("");
  const [decision, setDecision] = useState<SwitchDecision | null>(null);

  const profiles = state.streamProfiles;
  const full = profiles.length >= MAX_STREAM_PROFILES;

  // Askı bir ZAMAN eşiğidir; render sırasında Date.now() okumak saf olmayan bir
  // hesaptır (react-hooks/purity). Saniyede bir tazelenen durum olarak tutulur.
  const [holdActive, setHoldActive] = useState(false);
  const holdUntil = state.autoSwitch.manualHoldUntil;
  useEffect(() => {
    const tick = () => setHoldActive(Date.now() < holdUntil);
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [holdUntil]);

  /** create/duplicate/import ortak hata çevirisi — repo i18n bilmez, kod fırlatır. */
  function reportError(error: unknown) {
    const code = error instanceof Error ? error.message : "";
    if (code === PROFILE_LIMIT_ERROR) {
      toast.show(t("streamProfiles.errors.limit", { max: MAX_STREAM_PROFILES }), "error");
    } else if (code === PROFILE_LAST_ERROR) {
      toast.show(t("streamProfiles.errors.last"), "error");
    } else {
      toast.show(t("streamProfiles.errors.import"), "error");
    }
  }

  async function handleAdd() {
    try {
      await backend.profiles.create(draftForGame(null));
      toast.show(t("streamProfiles.toast.added"));
    } catch (error) {
      reportError(error);
    }
  }

  async function handleImport(file: File) {
    try {
      await backend.profiles.importProfile(await file.text());
      toast.show(t("streamProfiles.toast.imported"));
    } catch (error) {
      reportError(error);
    } finally {
      // Aynı dosya art arda seçilebilsin diye input sıfırlanır (change tetiklenmezdi).
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function handleSignal() {
    const result = await backend.profiles.reportSignal({
      gameId: signalGame === "" ? null : signalGame,
      title: signalTitle,
      source: signalGame === "" ? "title" : "manual",
    });
    setDecision(result.decision);
    if (result.decision.switched) {
      const index = profiles.findIndex((p) => p.id === result.active.id);
      toast.show(
        t("streamProfiles.status.switched", { name: label(result.active, index) }),
      );
    }
  }

  async function handleReset() {
    if (!confirm(t("streamProfiles.resetConfirm"))) return;
    await backend.profiles.resetAll();
    toast.show(t("streamProfiles.toast.reset"));
  }

  return (
    <div className="flex flex-col items-center gap-4">
      {/* 1 — Otomatik geçiş */}
      <Card id="section-autoSwitch">
        <CardTitle>{t("streamProfiles.auto.title")}</CardTitle>
        <CardBody>{t("streamProfiles.auto.description")}</CardBody>

        <div className="mt-4 flex flex-col gap-4">
          <Toggle
            checked={state.autoSwitch.enabled}
            onChange={(next) => void backend.profiles.setAutoSwitch({ enabled: next })}
            label={t("streamProfiles.auto.enabled")}
          />

          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label={t("streamProfiles.auto.manualHold")}
              hint={t("streamProfiles.auto.manualHoldHint")}
            >
              <Input
                type="number"
                min={0}
                max={3600}
                value={state.autoSwitch.manualHoldSeconds}
                onChange={(e) => {
                  const value = Number(e.target.value);
                  if (Number.isFinite(value)) {
                    void backend.profiles.setAutoSwitch({ manualHoldSeconds: value });
                  }
                }}
              />
            </Field>

            <Field
              label={t("streamProfiles.auto.minDwell")}
              hint={t("streamProfiles.auto.minDwellHint")}
            >
              <Input
                type="number"
                min={0}
                max={3600}
                value={state.autoSwitch.minDwellSeconds}
                onChange={(e) => {
                  const value = Number(e.target.value);
                  if (Number.isFinite(value)) {
                    void backend.profiles.setAutoSwitch({ minDwellSeconds: value });
                  }
                }}
              />
            </Field>
          </div>

          {holdActive && (
            <p className="text-xs text-muted">{t("streamProfiles.auto.holdActive")}</p>
          )}
        </div>
      </Card>

      {/* 2 — Oyun sinyali */}
      <Card id="section-gameSignal">
        <CardTitle>{t("streamProfiles.signal.title")}</CardTitle>
        <CardBody>{t("streamProfiles.signal.description")}</CardBody>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Field label={t("streamProfiles.signal.game")}>
            <Select
              value={signalGame}
              onChange={(e) => setSignalGame(e.target.value as GameId | "")}
            >
              <option value="">{t("streamProfiles.noGame")}</option>
              {GAME_IDS.map((id) => (
                <option key={id} value={id}>
                  {t(`streamProfiles.games.${id}`)}
                </option>
              ))}
            </Select>
          </Field>

          <Field label={t("streamProfiles.signal.streamTitle")}>
            <Input
              value={signalTitle}
              maxLength={150}
              placeholder={t("streamProfiles.signal.titlePlaceholder")}
              onChange={(e) => setSignalTitle(e.target.value)}
            />
          </Field>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Button size="sm" onClick={() => void handleSignal()}>
            {t("streamProfiles.signal.apply")}
          </Button>

          <span className="text-xs text-muted">
            {state.gameSignal.gameId
              ? t("streamProfiles.signal.detected", {
                  game: t(`streamProfiles.games.${state.gameSignal.gameId}`),
                })
              : t("streamProfiles.signal.none")}
          </span>

          {decision && !decision.switched && (
            <span role="status" className="text-xs text-muted-2">
              {t(`streamProfiles.status.${decision.reason}`)}
            </span>
          )}
        </div>
      </Card>

      {/* 3 — Profil listesi */}
      <Card id="section-profiles">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="mb-0">{t("streamProfiles.title")}</CardTitle>
          <span className="rounded bg-white/8 px-2 py-0.5 text-xs text-muted">
            {t("streamProfiles.count", {
              count: profiles.length,
              max: MAX_STREAM_PROFILES,
            })}
          </span>
        </div>
        <CardBody className="mt-1">{t("streamProfiles.subtitle")}</CardBody>

        <div className="mt-4 flex flex-wrap gap-2">
          <Button size="sm" disabled={full} onClick={() => void handleAdd()}>
            <Plus className="size-3.5" aria-hidden />
            {t("streamProfiles.add")}
          </Button>

          <Button
            variant="outline"
            size="sm"
            disabled={full}
            onClick={() => fileRef.current?.click()}
          >
            <Upload className="size-3.5" aria-hidden />
            {t("streamProfiles.import")}
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            aria-label={t("streamProfiles.import")}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void handleImport(file);
            }}
          />

          <Button variant="ghost" size="sm" onClick={() => void handleReset()}>
            <RotateCcw className="size-3.5" aria-hidden />
            {t("streamProfiles.reset")}
          </Button>
        </div>

        {full && (
          <p className="mt-2 text-xs text-muted">
            {t("streamProfiles.errors.limit", { max: MAX_STREAM_PROFILES })}
          </p>
        )}

        <ul className="mt-4 flex flex-col gap-3">
          {profiles.map((profile, index) => (
            <li key={profile.id}>
              <ProfileCard
                profile={profile}
                index={index}
                isActive={profile.id === state.activeProfileId}
                canDelete={profiles.length > 1}
              />
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
