"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { Pencil, Play, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useApp } from "@/components/providers/app-provider";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import { Field, Input, Select } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { Toggle } from "@/components/ui/toggle";
import { useToast } from "@/components/ui/toast";
import type { SimulateKind } from "@/lib/data/mock/simulator";
import { ACTION_MEDIA_COLUMN, type Action } from "@/lib/schemas/action";
import type { StreamEvent, StreamTimer } from "@/lib/schemas/event";
import type { OverlayScreen } from "@/lib/schemas/widget";
import { useOverlayId } from "@/lib/overlay/use-overlay-id";
import { useScreenPresence } from "@/lib/overlay/use-screen-presence";
import { useLocalStorage } from "@/lib/use-local-storage";
import { cn } from "@/lib/utils";
import { ActionEditor } from "./action-editor";
import { BulkEventsButton } from "./bulk-events";
import { EventEditor } from "./event-editor";
import { Preflight } from "./preflight";

/**
 * Eylemler ve Etkinlikler — PRD §5.3.
 * Sayfa yapısı: "Start here" + ana Enabled toggle → Actions → Events → Timers →
 * Overlay Screen Settings → Event Simulator.
 */

const MASTER_KEY = "livekit.actionsEnabled.v1";
/** Sunucu snapshot'ı için sabit referans (useLocalStorage sözleşmesi). */
const MASTER_DEFAULT = true;

export function ActionsAndEventsPage() {
  const t = useTranslations();
  const toast = useToast();
  const { backend, actions, events, timers, refresh, dispatch, entitlementsLimit } =
    useAppWithLimits();

  // Ana "Enabled" toggle'ı — PRD §5.3, localStorage'da kalıcı.
  const [enabled, setEnabled] = useLocalStorage<boolean>(MASTER_KEY, MASTER_DEFAULT);
  const [screens, setScreens] = useState<OverlayScreen[]>([]);

  const [editingAction, setEditingAction] = useState<Action | null>(null);
  const [actionOpen, setActionOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<StreamEvent | null>(null);
  const [eventOpen, setEventOpen] = useState(false);
  const [timerOpen, setTimerOpen] = useState(false);
  const [editingTimer, setEditingTimer] = useState<StreamTimer | null>(null);
  const [timerDraft, setTimerDraft] = useState({ intervalMinutes: 5, actionId: "" });
  // Overlay kimliği — hidrasyon-güvenli (useSyncExternalStore).
  const overlayId = useOverlayId();
  // Canlı ekran durumu — bağlı (OBS/tarayıcı kaynağı) Screen 1-8 seti.
  // Supabase modunda Presence, yerelde SSE hub durum poll'u (transport otomatik).
  const onlineScreens = useScreenPresence(overlayId);

  useEffect(() => {
    void backend.screens.list().then(setScreens);
  }, [backend]);

  /** Timer editörünü aç — create (timer=null) veya edit. */
  const openTimerEditor = useCallback((timer: StreamTimer | null) => {
    setEditingTimer(timer);
    setTimerDraft({
      intervalMinutes: timer?.intervalMinutes ?? 5,
      actionId: timer?.actionId ?? "",
    });
    setTimerOpen(true);
  }, []);

  /** Sunucu-otoriteli overlay'i test et — gerçek hediye olmadan (ADR-0002). */
  const testServerOverlay = useCallback(
    async (screen: number) => {
      if (!overlayId) return;
      try {
        const res = await fetch("/api/overlay/simulate", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ id: overlayId, kind: "gift", coins: 100 }),
        });
        const data = (await res.json()) as { matched?: number; message?: string };
        if (!res.ok) {
          toast.show(data.message ?? t("actionsandevents.simulator.noMatch"), "error");
          return;
        }
        if (!data.matched) {
          toast.show(t("actionsandevents.simulator.noMatch"), "info");
          return;
        }
        toast.show(
          t("actionsandevents.overlay.testSent", { screen, count: data.matched }),
        );
      } catch {
        toast.show(t("actionsandevents.simulator.noMatch"), "error");
      }
    },
    [overlayId, t, toast],
  );

  /* ---------------------------------------------------------------- Actions */

  const actionColumns = useMemo<ColumnDef<Action, unknown>[]>(
    () => [
      {
        id: "enabled",
        header: () => t("actionsandevents.table.enabled"),
        cell: ({ row }) => (
          <Toggle
            checked={row.original.enabled}
            onChange={async (next) => {
              const { id, ...draft } = row.original;
              await backend.actions.update(id, { ...draft, enabled: next });
              refresh();
            }}
            label={row.original.name}
          />
        ),
      },
      {
        accessorKey: "name",
        header: () => t("actionsandevents.table.name"),
        cell: ({ row }) => <span className="text-white">{row.original.name}</span>,
      },
      { accessorKey: "screen", header: () => t("actionsandevents.table.screen") },
      { accessorKey: "durationSec", header: () => t("actionsandevents.table.duration") },
      {
        accessorKey: "pointsDelta",
        header: () => t("actionsandevents.table.points"),
        cell: ({ row }) => {
          const v = row.original.pointsDelta;
          return (
            <span style={{ color: v > 0 ? "var(--link-blue)" : v < 0 ? "var(--error)" : undefined }}>
              {v > 0 ? `+${v}` : v}
            </span>
          );
        },
      },
      ...(["animation", "picture", "sound", "video"] as const).map((col) => ({
        id: col,
        header: () => t(`actionsandevents.table.${col}`),
        cell: ({ row }: { row: { original: Action } }) => {
          const has = row.original.types.some((type) => ACTION_MEDIA_COLUMN[type] === col);
          return has ? <span aria-label={t("common.yes")}>✓</span> : <span className="text-muted">—</span>;
        },
      })),
      { accessorKey: "description", header: () => t("actionsandevents.table.description") },
      {
        id: "rowActions",
        header: () => t("actionsandevents.table.rowActions"),
        cell: ({ row }) => (
          <div className="flex gap-1">
            <Button
              variant="ghost"
              size="icon"
              aria-label={t("common.edit")}
              onClick={() => {
                setEditingAction(row.original);
                setActionOpen(true);
              }}
            >
              <Pencil className="size-3.5" aria-hidden />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              aria-label={t("actionsandevents.toast.actionExecuted")}
              onClick={() => toast.show(t("actionsandevents.toast.actionExecuted"))}
            >
              <Play className="size-3.5" aria-hidden />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              aria-label={t("common.delete")}
              onClick={async () => {
                if (!confirm(t("common.confirmDeleteBody"))) return;
                await backend.actions.remove(row.original.id);
                refresh();
                toast.show(t("actionsandevents.toast.actionDeleted"));
              }}
            >
              <Trash2 className="size-3.5" aria-hidden />
            </Button>
          </div>
        ),
      },
    ],
    [t, backend, refresh, toast],
  );

  /* ----------------------------------------------------------------- Events */

  const eventColumns = useMemo<ColumnDef<StreamEvent, unknown>[]>(
    () => [
      {
        id: "active",
        header: () => t("actionsandevents.table.active"),
        cell: ({ row }) => (
          <Toggle
            checked={row.original.active}
            onChange={async (next) => {
              const { id, ...draft } = row.original;
              await backend.events.update(id, { ...draft, active: next });
              refresh();
            }}
            label={t(`actionsandevents.trigger.${row.original.trigger}`)}
          />
        ),
      },
      {
        id: "user",
        header: () => t("actionsandevents.table.user"),
        cell: ({ row }) => t(`actionsandevents.who.${row.original.who}`),
      },
      {
        id: "trigger",
        header: () => t("actionsandevents.table.trigger"),
        cell: ({ row }) => (
          <span className="text-white">
            {t(`actionsandevents.trigger.${row.original.trigger}`)}
          </span>
        ),
      },
      {
        id: "actions",
        header: () => t("actionsandevents.table.actions"),
        cell: ({ row }) => {
          const names = [...row.original.actionsAll, ...row.original.actionsRandom]
            .map((id) => actions.find((a) => a.id === id)?.name)
            .filter(Boolean);
          return <span className="text-muted-2">{names.join(", ") || "—"}</span>;
        },
      },
      {
        id: "rowActions",
        header: () => t("actionsandevents.table.rowActions"),
        cell: ({ row }) => (
          <div className="flex gap-1">
            <Button
              variant="ghost"
              size="icon"
              aria-label={t("common.edit")}
              onClick={() => {
                setEditingEvent(row.original);
                setEventOpen(true);
              }}
            >
              <Pencil className="size-3.5" aria-hidden />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              aria-label={t("common.delete")}
              onClick={async () => {
                if (!confirm(t("common.confirmDeleteBody"))) return;
                await backend.events.remove(row.original.id);
                refresh();
                toast.show(t("actionsandevents.toast.eventDeleted"));
              }}
            >
              <Trash2 className="size-3.5" aria-hidden />
            </Button>
          </div>
        ),
      },
    ],
    [t, backend, refresh, toast, actions],
  );

  /* ----------------------------------------------------------------- Timers */

  const timerColumns = useMemo<ColumnDef<StreamTimer, unknown>[]>(
    () => [
      {
        id: "active",
        header: () => t("actionsandevents.table.active"),
        cell: ({ row }) => (
          <Toggle
            checked={row.original.active}
            onChange={async (next) => {
              const { id, ...draft } = row.original;
              await backend.timers.update(id, { ...draft, active: next });
              refresh();
            }}
            label={t("actionsandevents.table.active")}
          />
        ),
      },
      { accessorKey: "intervalMinutes", header: () => t("actionsandevents.table.interval") },
      {
        id: "actionToExecute",
        header: () => t("actionsandevents.table.actionToExecute"),
        cell: ({ row }) => actions.find((a) => a.id === row.original.actionId)?.name ?? "—",
      },
      {
        id: "rowActions",
        header: () => t("actionsandevents.table.rowActions"),
        cell: ({ row }) => (
          <div className="flex gap-1">
            <Button
              variant="ghost"
              size="icon"
              aria-label={t("common.edit")}
              onClick={() => openTimerEditor(row.original)}
            >
              <Pencil className="size-3.5" aria-hidden />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              aria-label={t("common.delete")}
              onClick={async () => {
                await backend.timers.remove(row.original.id);
                refresh();
                toast.show(t("actionsandevents.toast.timerDeleted"));
              }}
            >
              <Trash2 className="size-3.5" aria-hidden />
            </Button>
          </div>
        ),
      },
    ],
    [t, actions, backend, toast, refresh, openTimerEditor],
  );

  /* ---------------------------------------------------------------- Screens */

  const screenColumns = useMemo<ColumnDef<OverlayScreen, unknown>[]>(
    () => [
      {
        id: "screenName",
        header: () => t("actionsandevents.table.screenName"),
        cell: ({ row }) => (
          <Input
            value={row.original.name}
            aria-label={t("actionsandevents.table.screenName")}
            className="h-7 w-32"
            onChange={async (e) => {
              const next = await backend.screens.update(row.original.screen, {
                name: e.target.value,
              });
              setScreens((s) => s.map((x) => (x.screen === next.screen ? next : x)));
            }}
          />
        ),
      },
      {
        id: "screenUrl",
        header: () => t("actionsandevents.table.screenUrl"),
        cell: ({ row }) => {
          // Gerçek OBS köprüsü: overlay kimliği (id) URL'e eklenir (ADR-0002).
          const url = backend.widgets.url(
            "myactions",
            overlayId
              ? { id: overlayId, screen: row.original.screen }
              : { screen: row.original.screen },
          );
          return (
            <div className="flex items-center gap-1.5">
              <code className="max-w-[240px] truncate text-xs text-muted">{url}</code>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  void navigator.clipboard.writeText(url);
                  toast.show(t("common.copied"));
                }}
              >
                {t("common.copy")}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => void testServerOverlay(row.original.screen)}
                title={t("actionsandevents.overlay.testHint")}
              >
                {t("actionsandevents.overlay.test")}
              </Button>
            </div>
          );
        },
      },
      {
        id: "maxQueue",
        header: () => t("actionsandevents.table.maxQueue"),
        cell: ({ row }) => (
          <Input
            type="number"
            min={1}
            aria-label={t("actionsandevents.table.maxQueue")}
            value={row.original.maxQueueLength}
            className="h-7 w-20"
            onChange={async (e) => {
              const next = await backend.screens.update(row.original.screen, {
                maxQueueLength: Number(e.target.value),
              });
              setScreens((s) => s.map((x) => (x.screen === next.screen ? next : x)));
            }}
          />
        ),
      },
      {
        id: "status",
        header: () => t("actionsandevents.table.status"),
        cell: ({ row }) => {
          // Kaynak: canlı bağlantı seti (Presence/SSE) — süreçler-arası gerçek durum.
          const online = onlineScreens.has(row.original.screen);
          return (
            <span
              className={cn("text-xs")}
              style={{ color: online ? "var(--link-blue)" : "var(--accent)" }}
            >
              {online
                ? t("actionsandevents.table.online")
                : t("actionsandevents.table.offline")}
            </span>
          );
        },
      },
    ],
    [t, backend, toast, overlayId, testServerOverlay, onlineScreens],
  );

  /* -------------------------------------------------------------- Simulator */

  const simulations: Array<{ kind: SimulateKind; labelKey: string; options?: { likes?: number } }> = [
    { kind: "follow", labelKey: "actionsandevents.simulator.follow" },
    { kind: "share", labelKey: "actionsandevents.simulator.share" },
    { kind: "subscribe", labelKey: "actionsandevents.simulator.subscribe" },
    { kind: "likes", labelKey: "actionsandevents.simulator.likes", options: { likes: 15 } },
    { kind: "gift", labelKey: "actionsandevents.simulator.gift" },
  ];

  async function runSimulation(kind: SimulateKind, options?: { likes?: number }) {
    // 1) Aynı-tarayıcı önizleme: istemci kural motoru + bus (anında geri bildirim).
    const event = backend.simulator.simulate(kind, options);
    const result = dispatch(event);

    // 2) Gerçek bağlı ekran(lar): sunucu-otoriteli yol (SSE hub / Supabase broadcast).
    //    Best-effort — overlay henüz senkronlanmadıysa (404) önizleme yine çalışır.
    if (overlayId) {
      void fetch("/api/overlay/simulate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id: overlayId, kind, likes: options?.likes }),
      }).catch(() => {
        // Ağ hatası — önizleme dispatch'i zaten çalıştı.
      });
    }

    // Toast'lar önizleme (dispatch) sonucundan — PRD §5.3.
    if (result.matchedRules.length === 0) {
      toast.show(t("actionsandevents.simulator.noMatch"), "info");
      return;
    }

    // Kuyruk sonuçlarını PRD §5.3 toast'larına çevir.
    const rejected = result.outcomes.find((o) => o.status === "rejected");
    if (rejected && rejected.status === "rejected") {
      toast.show(
        t(
          rejected.reason === "queueFull"
            ? "actionsandevents.toast.queueFull"
            : "actionsandevents.toast.screenOffline",
        ),
        "error",
      );
      return;
    }

    toast.show(t("actionsandevents.simulator.matched", { count: result.matchedRules.length }));
  }

  const actionLimit = entitlementsLimit("actions");
  const limitReached = Number.isFinite(actionLimit) && actions.length >= actionLimit;

  return (
    <div className="flex flex-col items-center gap-4 p-6">
      {/* "Start here" + ana toggle */}
      <div className="flex w-full max-w-[var(--card-w)] items-center gap-3">
        <span className="text-sm text-warning">{t("actionsandevents.startHere")}</span>
        <Toggle checked={enabled} onChange={setEnabled} label={t("actionsandevents.masterToggle")} />
      </div>

      {/* Yayına hazırlık — zincirdeki kopuk halkayı yayın ÖNCESİ göster. */}
      <Preflight
        actions={actions}
        events={events}
        onlineScreens={onlineScreens}
        enabled={enabled}
      />

      {/* Actions */}
      <Card id="section-actions" className={cn(!enabled && "opacity-60")}>
        <div className="mb-3 flex items-center justify-between">
          <CardTitle className="mb-0">{t("actionsandevents.actionsTitle")}</CardTitle>
          <Button
            size="sm"
            disabled={limitReached}
            onClick={() => {
              setEditingAction(null);
              setActionOpen(true);
            }}
          >
            {t("actionsandevents.createAction")}
          </Button>
        </div>

        {/* Pro gating — PRD §10 */}
        {limitReached ? (
          <p className="mb-3 rounded-lg border border-warning/40 bg-warning/10 px-3 py-2 text-xs text-warning">
            {t("actionsandevents.gating.actionsLimitReached", { limit: actionLimit })}
          </p>
        ) : (
          Number.isFinite(actionLimit) && (
            <p className="mb-3 text-xs text-muted">
              {t("actionsandevents.gating.actionsLimit", { limit: actionLimit })} ({actions.length}/
              {actionLimit})
            </p>
          )
        )}

        <DataTable
          columns={actionColumns}
          data={actions}
          caption={t("actionsandevents.actionsTitle")}
          emptyMessage={t("actionsandevents.noActions")}
        />
      </Card>

      {/* Events */}
      <Card id="section-events" className={cn(!enabled && "opacity-60")}>
        <div className="mb-3 flex items-center justify-between">
          <CardTitle className="mb-0">{t("actionsandevents.eventsTitle")}</CardTitle>
          <div className="flex gap-2">
            <BulkEventsButton />
            <Button
              size="sm"
              onClick={() => {
                setEditingEvent(null);
                setEventOpen(true);
              }}
            >
              {t("actionsandevents.createEvent")}
            </Button>
          </div>
        </div>
        <DataTable
          columns={eventColumns}
          data={events}
          caption={t("actionsandevents.eventsTitle")}
          emptyMessage={t("actionsandevents.noEvents")}
        />
      </Card>

      {/* Timers */}
      <Card id="section-timers" className={cn(!enabled && "opacity-60")}>
        <div className="mb-3 flex items-center justify-between">
          <CardTitle className="mb-0">{t("actionsandevents.timersTitle")}</CardTitle>
          <Button
            size="sm"
            onClick={() => openTimerEditor(null)}
            disabled={actions.length === 0}
          >
            {t("actionsandevents.createTimer")}
          </Button>
        </div>
        <p className="mb-3 text-xs text-muted">{t("actionsandevents.timerHint")}</p>
        <DataTable
          columns={timerColumns}
          data={timers}
          caption={t("actionsandevents.timersTitle")}
          emptyMessage={t("actionsandevents.noTimers")}
        />
      </Card>

      {/* Overlay Screens — 8 adet */}
      <Card id="section-screens">
        <CardTitle>{t("actionsandevents.screensTitle")}</CardTitle>
        <div className="mt-3">
          <DataTable
            columns={screenColumns}
            data={screens}
            caption={t("actionsandevents.screensTitle")}
            emptyMessage={t("common.empty")}
          />
        </div>
      </Card>

      {/* Event Simulator */}
      <Card id="section-simulator">
        <CardTitle>{t("actionsandevents.simulatorTitle")}</CardTitle>
        <p className="mt-1 mb-3 text-xs text-muted">{t("actionsandevents.simulator.hint")}</p>
        <div className="flex flex-wrap gap-2">
          {simulations.map((s) => (
            <Button
              key={s.kind}
              variant="secondary"
              size="sm"
              disabled={!enabled}
              onClick={() => void runSimulation(s.kind, s.options)}
            >
              {t(s.labelKey)}
            </Button>
          ))}
        </div>
      </Card>

      <ActionEditor
        // key: editör her açılışta sıfırdan monte olur → draft prop'tan türetilir.
        key={`action-${editingAction?.id ?? "new"}-${String(actionOpen)}`}
        open={actionOpen}
        action={editingAction}
        onClose={() => setActionOpen(false)}
        onSaved={(m) => toast.show(m)}
      />

      <EventEditor
        key={`event-${editingEvent?.id ?? "new"}-${String(eventOpen)}`}
        open={eventOpen}
        event={editingEvent}
        onClose={() => setEventOpen(false)}
        onSaved={(m) => toast.show(m)}
      />

      {/* Timer editörü — create + edit */}
      <Modal
        open={timerOpen}
        onClose={() => setTimerOpen(false)}
        title={
          editingTimer
            ? t("actionsandevents.editor.editTimer")
            : t("actionsandevents.editor.newTimer")
        }
        size="sm"
        footer={
          <>
            <Button variant="ghost" size="sm" onClick={() => setTimerOpen(false)}>
              {t("common.cancel")}
            </Button>
            <Button
              size="sm"
              onClick={async () => {
                const actionId = timerDraft.actionId || actions[0]?.id;
                if (!actionId) return;
                if (editingTimer) {
                  await backend.timers.update(editingTimer.id, {
                    active: editingTimer.active,
                    intervalMinutes: timerDraft.intervalMinutes,
                    actionId,
                  });
                } else {
                  await backend.timers.create({
                    active: true,
                    intervalMinutes: timerDraft.intervalMinutes,
                    actionId,
                  });
                }
                refresh();
                setTimerOpen(false);
                toast.show(t("actionsandevents.toast.timerSaved"));
              }}
            >
              {t("common.save")}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-3">
          <Field label={t("actionsandevents.table.interval")} htmlFor="timer-interval">
            <Input
              id="timer-interval"
              type="number"
              min={1}
              value={timerDraft.intervalMinutes}
              onChange={(e) =>
                setTimerDraft((d) => ({ ...d, intervalMinutes: Number(e.target.value) }))
              }
            />
          </Field>
          <Field label={t("actionsandevents.table.actionToExecute")} htmlFor="timer-action">
            <Select
              id="timer-action"
              value={timerDraft.actionId}
              onChange={(e) => setTimerDraft((d) => ({ ...d, actionId: e.target.value }))}
            >
              {actions.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </Select>
          </Field>
        </div>
      </Modal>
    </div>
  );
}

/** Entitlement limitlerini de veren küçük sarmalayıcı (Pro gating — PRD §10). */
function useAppWithLimits() {
  const app = useApp();
  return {
    ...app,
    entitlementsLimit: app.backend.entitlements.limit,
  };
}
