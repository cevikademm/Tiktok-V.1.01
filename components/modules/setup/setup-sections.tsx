"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { CheckCircle2, ExternalLink, Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { useApp } from "@/components/providers/app-provider";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardTitle } from "@/components/ui/card";
import { Field, Input, Select } from "@/components/ui/field";
import { Toggle } from "@/components/ui/toggle";
import { useToast } from "@/components/ui/toast";
import { levelTable } from "@/lib/schemas/points";
import {
  levelSettingsSchema,
  pointsSystemSchema,
  tiktokAccountSchema,
  type LevelSettingsForm,
  type LevelSettingsInput,
  type PointsSystemForm,
  type PointsSystemInput,
  type SetupSettings,
  type TiktokAccountForm,
} from "@/lib/schemas/settings";
import { APP_NAME } from "@/lib/utils";

/**
 * Kurmak (`setup`) — 14 alt bölüm. PRD §5.2.
 * Her bölüm ayrı kart; form doğrulaması RHF + Zod (CLAUDE.md §5.7).
 */

/* 1 — TikTok Hesabınızı Bağlayın */
export function TiktokAccountSection() {
  const t = useTranslations();
  const toast = useToast();
  const { backend, connection, connect } = useApp();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<TiktokAccountForm>({
    resolver: zodResolver(tiktokAccountSchema),
    defaultValues: { username: "" },
  });

  useEffect(() => {
    void backend.settings.get().then((s) => {
      if (s.tiktok?.username) reset({ username: s.tiktok.username });
    });
  }, [backend, reset]);

  // Başarı banner'ı bağlantı durumundan türer — ayrı state tutmaya gerek yok.
  const connected = connection === "live";

  async function onSubmit(values: TiktokAccountForm) {
    try {
      await connect(values.username);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      toast.show(message, "error");
    }
  }

  return (
    <Card id="section-tiktokAccount" featured>
      <CardTitle>{t("setup.sections.tiktokAccount")}</CardTitle>

      <form onSubmit={handleSubmit(onSubmit)} className="mt-4 flex flex-col gap-3">
        <Field
          label={t("setup.tiktok.label")}
          error={errors.username && t(`validation.${errors.username.message}`)}
          htmlFor="tiktok-username"
          required
        >
          <Input
            id="tiktok-username"
            placeholder={t("setup.tiktok.placeholder")}
            aria-invalid={!!errors.username}
            {...register("username")}
          />
        </Field>

        <a
          href="https://support.tiktok.com"
          target="_blank"
          rel="noreferrer noopener"
          className="inline-flex w-fit items-center gap-1 text-xs text-link hover:text-link-hover"
        >
          {t("setup.tiktok.findUsername")}
          <ExternalLink className="size-3" aria-hidden />
        </a>

        <Button type="submit" raised className="w-fit" disabled={connection === "connecting"}>
          {connection === "connecting" && (
            <Loader2 className="size-4 animate-spin" aria-hidden />
          )}
          {t("setup.tiktok.connect")}
        </Button>
      </form>

      {connected && (
        <p
          role="status"
          className="mt-4 flex items-center gap-2 rounded-lg border border-success-banner bg-success-banner/30 px-3 py-2 text-sm text-white"
        >
          <CheckCircle2 className="size-4" aria-hidden />
          {t("setup.tiktok.success")}
        </p>
      )}
    </Card>
  );
}

/* 2 — Puan Sistemi */
export function PointsSystemSection() {
  const t = useTranslations();
  const { backend } = useApp();
  const toast = useToast();

  const { register, handleSubmit, reset } = useForm<
    PointsSystemInput,
    unknown,
    PointsSystemForm
  >({
    resolver: zodResolver(pointsSystemSchema),
    defaultValues: pointsSystemSchema.parse({}),
  });

  useEffect(() => {
    void backend.settings.get().then((s) => reset(s.points));
  }, [backend, reset]);

  async function onSubmit(values: PointsSystemForm) {
    await backend.settings.patch({ points: values });
    toast.show(t("setup.saved"));
  }

  return (
    <Card id="section-pointsSystem">
      <CardTitle>{t("setup.sections.pointsSystem")}</CardTitle>

      <form onSubmit={handleSubmit(onSubmit)} className="mt-4 grid gap-3 md:grid-cols-2">
        <Field label={t("setup.points.currencyName")} htmlFor="currency-name">
          <Input id="currency-name" {...register("currencyName")} />
        </Field>
        <Field label={t("setup.points.perCoin")} htmlFor="per-coin">
          <Input id="per-coin" type="number" {...register("pointsPerCoin", { valueAsNumber: true })} />
        </Field>
        <Field label={t("setup.points.perShare")} htmlFor="per-share">
          <Input id="per-share" type="number" {...register("pointsPerShare", { valueAsNumber: true })} />
        </Field>
        <Field label={t("setup.points.perChatMinute")} htmlFor="per-minute">
          <Input
            id="per-minute"
            type="number"
            {...register("pointsPerChatMinute", { valueAsNumber: true })}
          />
        </Field>

        <Button type="submit" size="sm" className="w-fit md:col-span-2">
          {t("common.save")}
        </Button>
      </form>
    </Card>
  );
}

/* 3 — Abone Bonusu */
export function SubscriberBonusSection() {
  const t = useTranslations();
  const { backend } = useApp();
  const toast = useToast();
  const [rate, setRate] = useState(100);

  useEffect(() => {
    void backend.settings.get().then((s) => setRate(s.subscriberBonus.bonusRatePercent));
  }, [backend]);

  return (
    <Card id="section-subscriberBonus">
      <CardTitle>{t("setup.sections.subscriberBonus")}</CardTitle>
      <Field
        label={t("setup.subscriberBonus.rate")}
        hint={t("setup.subscriberBonus.hint")}
        htmlFor="bonus-rate"
        className="mt-4 max-w-xs"
      >
        <Input
          id="bonus-rate"
          type="number"
          value={rate}
          onChange={(e) => setRate(Number(e.target.value))}
          onBlur={async () => {
            await backend.settings.patch({ subscriberBonus: { bonusRatePercent: rate } });
            toast.show(t("setup.saved"));
          }}
        />
      </Field>
    </Card>
  );
}

/* 4 — Seviye Ayarları */
export function LevelSettingsSection() {
  const t = useTranslations();
  const { backend } = useApp();
  const toast = useToast();
  const [showTable, setShowTable] = useState(false);

  const { register, handleSubmit, reset, watch } = useForm<
    LevelSettingsInput,
    unknown,
    LevelSettingsForm
  >({
    resolver: zodResolver(levelSettingsSchema),
    defaultValues: levelSettingsSchema.parse({}),
  });

  useEffect(() => {
    void backend.settings.get().then((s) => reset(s.levels));
  }, [backend, reset]);

  const pointsPerLevel = watch("pointsPerLevel");
  const multiplier = watch("levelMultiplier");
  const rows = levelTable(pointsPerLevel || 50, multiplier || 1.2, 10);

  return (
    <Card id="section-levelSettings">
      <CardTitle>{t("setup.sections.levelSettings")}</CardTitle>

      <form
        onSubmit={handleSubmit(async (values) => {
          await backend.settings.patch({ levels: values });
          toast.show(t("setup.saved"));
        })}
        className="mt-4 grid gap-3 md:grid-cols-2"
      >
        <Field label={t("setup.levels.pointsPerLevel")} htmlFor="points-per-level">
          <Input
            id="points-per-level"
            type="number"
            {...register("pointsPerLevel", { valueAsNumber: true })}
          />
        </Field>
        <Field label={t("setup.levels.multiplier")} htmlFor="level-multiplier">
          <Input
            id="level-multiplier"
            type="number"
            step="0.1"
            {...register("levelMultiplier", { valueAsNumber: true })}
          />
        </Field>
        <Button type="submit" size="sm" className="w-fit md:col-span-2">
          {t("common.save")}
        </Button>
      </form>

      <button
        type="button"
        onClick={() => setShowTable((s) => !s)}
        aria-expanded={showTable}
        className="mt-4 text-sm text-link hover:text-link-hover"
      >
        {showTable ? t("setup.levels.hideTable") : t("setup.levels.showTable")}
      </button>

      {showTable && (
        <table className="mt-3 w-full max-w-sm text-left text-sm">
          <thead className="text-xs text-muted uppercase">
            <tr>
              <th scope="col" className="py-1">{t("setup.levels.tableLevel")}</th>
              <th scope="col" className="py-1">{t("setup.levels.tableRequired")}</th>
              <th scope="col" className="py-1">{t("setup.levels.tableCumulative")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.level} className="border-t border-border-subtle">
                <td className="py-1 text-white">{r.level}</td>
                <td className="py-1 text-muted-2">{r.required}</td>
                <td className="py-1 text-muted-2">{r.cumulative}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Card>
  );
}

/* 5-7 — OBS / Streamer.bot / Minecraft bağlantıları (Test akışı ortak) */
function ConnectionSection({
  id,
  titleKey,
  target,
  children,
  hint,
}: {
  id: string;
  titleKey: string;
  target: "obs" | "streamerbot" | "minecraft";
  children: React.ReactNode;
  hint?: string;
}) {
  const t = useTranslations();
  const { backend } = useApp();
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);

  async function runTest() {
    setTesting(true);
    setResult(null);
    const res = await backend.settings.test(target);
    setTesting(false);
    setResult({
      ok: res.ok,
      text: res.ok
        ? t("setup.test.success", { latency: res.latencyMs ?? 0 })
        : t("setup.test.failed"),
    });
  }

  return (
    <Card id={`section-${id}`}>
      <CardTitle>{t(titleKey)}</CardTitle>
      {hint && <CardBody className="mt-1">{hint}</CardBody>}

      <div className="mt-4 grid gap-3 md:grid-cols-3">{children}</div>

      <div className="mt-4 flex items-center gap-3">
        <Button type="button" variant="secondary" size="sm" onClick={runTest} disabled={testing}>
          {testing && <Loader2 className="size-3.5 animate-spin" aria-hidden />}
          {testing ? t("setup.test.running") : t("setup.obs.test")}
        </Button>

        {result && (
          <p
            role="status"
            className="text-sm"
            style={{ color: result.ok ? "var(--link-blue)" : "var(--error)" }}
          >
            {result.text}
          </p>
        )}
      </div>
    </Card>
  );
}

export function ObsSection() {
  const t = useTranslations();
  const { backend } = useApp();
  const [form, setForm] = useState({ ip: "127.0.0.1", port: 4455, password: "" });

  useEffect(() => {
    void backend.settings.get().then((s) => setForm(s.obs));
  }, [backend]);

  function patch(next: Partial<typeof form>) {
    const merged = { ...form, ...next };
    setForm(merged);
    void backend.settings.patch({ obs: merged });
  }

  return (
    <ConnectionSection
      id="obsConnection"
      titleKey="setup.sections.obsConnection"
      target="obs"
      hint={t("setup.obs.hint")}
    >
      <Field label={t("setup.obs.ip")} htmlFor="obs-ip">
        <Input id="obs-ip" value={form.ip} onChange={(e) => patch({ ip: e.target.value })} />
      </Field>
      <Field label={t("setup.obs.port")} htmlFor="obs-port">
        <Input
          id="obs-port"
          type="number"
          value={form.port}
          onChange={(e) => patch({ port: Number(e.target.value) })}
        />
      </Field>
      <Field label={t("setup.obs.password")} htmlFor="obs-password">
        <Input
          id="obs-password"
          type="password"
          value={form.password}
          onChange={(e) => patch({ password: e.target.value })}
        />
      </Field>
    </ConnectionSection>
  );
}

export function StreamerbotSection() {
  const t = useTranslations();
  const { backend } = useApp();
  const [form, setForm] = useState({ address: "127.0.0.1", port: 8080, endpoint: "/" });

  useEffect(() => {
    void backend.settings.get().then((s) => setForm(s.streamerbot));
  }, [backend]);

  function patch(next: Partial<typeof form>) {
    const merged = { ...form, ...next };
    setForm(merged);
    void backend.settings.patch({ streamerbot: merged });
  }

  return (
    <ConnectionSection
      id="streamerbotConnection"
      titleKey="setup.sections.streamerbotConnection"
      target="streamerbot"
    >
      <Field label={t("setup.streamerbot.address")} htmlFor="sb-address">
        <Input id="sb-address" value={form.address} onChange={(e) => patch({ address: e.target.value })} />
      </Field>
      <Field label={t("setup.streamerbot.port")} htmlFor="sb-port">
        <Input
          id="sb-port"
          type="number"
          value={form.port}
          onChange={(e) => patch({ port: Number(e.target.value) })}
        />
      </Field>
      <Field label={t("setup.streamerbot.endpoint")} htmlFor="sb-endpoint">
        <Input id="sb-endpoint" value={form.endpoint} onChange={(e) => patch({ endpoint: e.target.value })} />
      </Field>
    </ConnectionSection>
  );
}

export function MinecraftSection() {
  const t = useTranslations();
  const { backend } = useApp();
  const [form, setForm] = useState({
    mode: "fabric" as "fabric" | "servertap",
    playerName: "",
    ip: "127.0.0.1",
    port: 4567,
    password: "",
  });

  useEffect(() => {
    void backend.settings.get().then((s) => setForm(s.minecraft));
  }, [backend]);

  function patch(next: Partial<typeof form>) {
    const merged = { ...form, ...next };
    setForm(merged);
    void backend.settings.patch({ minecraft: merged });
  }

  return (
    <ConnectionSection
      id="minecraftConnection"
      titleKey="setup.sections.minecraftConnection"
      target="minecraft"
    >
      <Field label={t("setup.minecraft.mode")} htmlFor="mc-mode">
        <Select
          id="mc-mode"
          value={form.mode}
          onChange={(e) => patch({ mode: e.target.value as "fabric" | "servertap" })}
        >
          <option value="fabric">{t("setup.minecraft.modeFabric")}</option>
          <option value="servertap">{t("setup.minecraft.modeServertap")}</option>
        </Select>
      </Field>
      <Field label={t("setup.minecraft.playerName")} htmlFor="mc-player">
        <Input id="mc-player" value={form.playerName} onChange={(e) => patch({ playerName: e.target.value })} />
      </Field>
      <Field label={t("setup.minecraft.ip")} htmlFor="mc-ip">
        <Input id="mc-ip" value={form.ip} onChange={(e) => patch({ ip: e.target.value })} />
      </Field>
      <Field label={t("setup.minecraft.port")} htmlFor="mc-port">
        <Input
          id="mc-port"
          type="number"
          value={form.port}
          onChange={(e) => patch({ port: Number(e.target.value) })}
        />
      </Field>
      <Field label={t("setup.minecraft.password")} htmlFor="mc-password">
        <Input
          id="mc-password"
          type="password"
          value={form.password}
          onChange={(e) => patch({ password: e.target.value })}
        />
      </Field>
    </ConnectionSection>
  );
}

/* 8 — Sıfırlama Noktaları */
export function ResetPointsSection() {
  const t = useTranslations();
  const toast = useToast();

  return (
    <Card id="section-resetPoints">
      <CardTitle>{t("setup.sections.resetPoints")}</CardTitle>
      <div className="mt-4 flex flex-wrap gap-2">
        <Button variant="outline" size="sm">
          {t("setup.reset.byCriteria")}
        </Button>
        <Button
          variant="danger"
          size="sm"
          onClick={() => {
            if (confirm(t("setup.reset.confirm"))) toast.show(t("setup.saved"));
          }}
        >
          {t("setup.reset.all")}
        </Button>
      </div>
      <Field label={t("setup.reset.coupon")} htmlFor="coupon" className="mt-4 max-w-xs">
        <Input id="coupon" />
      </Field>
    </Card>
  );
}

/* 9 — Pro karşılaştırma tablosu (PRD §10 birebir) */
export function ProSection() {
  const t = useTranslations();

  const rows: Array<[string, string, string]> = [
    ["actionsEvents", "5", "∞"],
    ["soundAlerts", "5", "∞"],
    ["ttsDaily", "100", "∞"],
    ["premiumOverlays", "—", "✓"],
    ["aiVoices", "25/gün", "✓"],
    ["experimental", "—", "✓"],
    ["discordRole", "—", "✓"],
    ["earlyAccess", "—", "✓"],
    ["giftCounter", "1", "3"],
    ["streamProfiles", "1", "10"],
    ["socialRotator", "2", "100"],
    ["pointsUsers", "2.5k", "100k"],
  ];

  return (
    <Card id="section-pro" featured>
      <CardTitle>{t("setup.sections.pro", { app: APP_NAME })}</CardTitle>

      <table className="mt-4 w-full text-left text-sm">
        <thead className="text-xs text-muted uppercase">
          <tr>
            <th scope="col" className="py-2">{t("pro.compareFeature")}</th>
            <th scope="col" className="py-2">{t("pro.compareFree")}</th>
            <th scope="col" className="py-2">{t("pro.comparePro")}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(([key, free, pro]) => (
            <tr key={key} className="border-t border-border-subtle">
              <td className="py-2 text-muted-2">{t(`pro.features.${key}`)}</td>
              <td className="py-2 text-muted">{free}</td>
              <td className="py-2 font-medium text-white">{pro}</td>
            </tr>
          ))}
          <tr className="border-t border-border-subtle">
            <td className="py-2 text-muted-2">{t("pro.features.systemAccess")}</td>
            <td className="py-2 text-muted">{t("pro.features.systemNormal")}</td>
            <td className="py-2 font-medium text-white">{t("pro.features.systemPriority")}</td>
          </tr>
          <tr className="border-t border-border-subtle">
            <td className="py-2 text-muted-2">{t("pro.features.basicOverlays")}</td>
            <td className="py-2 text-muted">✓</td>
            <td className="py-2 font-medium text-white">✓</td>
          </tr>
        </tbody>
      </table>

      <div className="mt-4 flex items-center gap-3">
        <Button raised size="sm">
          {t("pro.upgrade")}
        </Button>
        <span className="text-sm text-muted">
          $19 / {t("pro.monthly")} · $172 / {t("pro.yearly")} ({t("pro.yearlyNote")})
        </span>
      </div>
    </Card>
  );
}

/* 10 — Patreon */
export function PatreonSection() {
  const t = useTranslations();
  return (
    <Card id="section-patreon">
      <CardTitle>{t("setup.sections.patreon")}</CardTitle>
      <CardBody className="mt-2">
        {t("setup.patreon.status")}: {t("setup.patreon.notConnected")}
      </CardBody>
      <Button variant="secondary" size="sm" className="mt-3">
        {t("setup.patreon.connect")}
      </Button>
    </Card>
  );
}

/* 11 — Hesabınız */
export function AccountSection() {
  const t = useTranslations();
  return (
    <Card id="section-account">
      <CardTitle>{t("setup.sections.account")}</CardTitle>
      <dl className="mt-4 grid max-w-md grid-cols-2 gap-y-2 text-sm">
        <dt className="text-muted">{t("setup.account.userId")}</dt>
        <dd className="text-white">—</dd>
        <dt className="text-muted">{t("setup.account.email")}</dt>
        <dd className="text-white">—</dd>
        <dt className="text-muted">{t("setup.account.signupDate")}</dt>
        <dd className="text-white">—</dd>
      </dl>
      <div className="mt-4 flex gap-2">
        <Button variant="outline" size="sm">
          {t("setup.account.tiktokLogin")}
        </Button>
        <Button variant="ghost" size="sm">
          {t("auth.signOut")}
        </Button>
      </div>
    </Card>
  );
}

/* 12 — Import / Export */
export function ImportExportSection() {
  const t = useTranslations();
  const { backend, refresh } = useApp();
  const toast = useToast();

  async function handleExport() {
    const json = await backend.settings.export();
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${APP_NAME.toLowerCase()}-settings.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.show(t("setup.importExport.exported"));
  }

  async function handleImport(file: File) {
    try {
      await backend.settings.import(await file.text());
      refresh();
      toast.show(t("setup.importExport.imported"));
    } catch {
      // Şema uyuşmuyor veya bozuk JSON — kullanıcıya bildir, durumu bozma.
      toast.show(t("setup.importExport.invalidFile"), "error");
    }
  }

  return (
    <Card id="section-importExport">
      <CardTitle>{t("setup.sections.importExport")}</CardTitle>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <label className="cursor-pointer rounded-lg bg-surface-3 px-4 py-2 text-sm text-white transition-colors hover:bg-surface-4">
          {t("setup.importExport.import")}
          <input
            type="file"
            accept="application/json"
            className="sr-only"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void handleImport(file);
            }}
          />
        </label>
        <Button variant="secondary" size="sm" onClick={handleExport}>
          {t("setup.importExport.export")}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={async () => {
            await backend.settings.reset();
            refresh();
            toast.show(t("setup.saved"));
          }}
        >
          {t("setup.importExport.reset")}
        </Button>
      </div>
    </Card>
  );
}

/* 13 — Advanced Settings */
export function AdvancedSection() {
  const t = useTranslations();
  const { backend } = useApp();
  const [adv, setAdv] = useState<SetupSettings["advanced"] | null>(null);

  useEffect(() => {
    void backend.settings.get().then((s) => setAdv(s.advanced));
  }, [backend]);

  if (!adv) return null;

  function patch(next: Partial<SetupSettings["advanced"]>) {
    const merged = { ...adv!, ...next };
    setAdv(merged);
    void backend.settings.patch({ advanced: merged });
  }

  const toggles = [
    ["serverSideConnection", adv.serverSideConnection],
    ["openInNewWindow", adv.openInNewWindow],
    ["localizedGiftNames", adv.localizedGiftNames],
    ["useDisplayNames", adv.useDisplayNames],
    ["onlyFirstEmote", adv.onlyFirstEmote],
    ["keystrokeQueue", adv.keystrokeQueue],
  ] as const;

  return (
    <Card id="section-advanced">
      <CardTitle>{t("setup.sections.advanced")}</CardTitle>

      <div className="mt-4 flex flex-col gap-3">
        {toggles.map(([key, value]) => (
          <Toggle
            key={key}
            checked={value}
            onChange={(next) => patch({ [key]: next })}
            label={t(`setup.advanced.${key}`)}
          />
        ))}
      </div>

      <Field
        label={t("setup.advanced.tiktokLanguage")}
        htmlFor="tiktok-lang"
        className="mt-4 max-w-xs"
      >
        <Input
          id="tiktok-lang"
          value={adv.tiktokLanguage}
          onChange={(e) => patch({ tiktokLanguage: e.target.value })}
        />
      </Field>

      <div className="mt-4">
        <p className="mb-2 text-sm text-muted">{t("setup.advanced.apiConnectivity")}</p>
        <div className="flex gap-2">
          <Button variant="outline" size="sm">
            {t("setup.advanced.switchServer")}
          </Button>
          <Button variant="ghost" size="sm">
            {t("setup.advanced.restoreServer")}
          </Button>
        </div>
      </div>
    </Card>
  );
}

/* 14 — Debug Options */
export function DebugSection() {
  const t = useTranslations();
  const { backend } = useApp();
  const [debug, setDebug] = useState(false);

  useEffect(() => {
    void backend.settings.get().then((s) => setDebug(s.debug.debugMode));
  }, [backend]);

  return (
    <Card id="section-debug">
      <CardTitle>{t("setup.sections.debug")}</CardTitle>
      <div className="mt-4 flex flex-col gap-3">
        <Toggle
          checked={debug}
          onChange={(next) => {
            setDebug(next);
            void backend.settings.patch({ debug: { debugMode: next } });
          }}
          label={t("setup.debug.enable")}
        />
        <Button variant="outline" size="sm" className="w-fit">
          {t("setup.debug.openTiktok")}
        </Button>
      </div>
    </Card>
  );
}
