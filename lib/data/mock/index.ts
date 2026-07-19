import { actionDraftSchema, type Action, type ActionDraft } from "@/lib/schemas/action";
import { eventSignature, type StreamEvent, type StreamTimer } from "@/lib/schemas/event";
import type { ConnectionState, LiveEvent } from "@/lib/schemas/live";
import type { Transaction } from "@/lib/schemas/points";
import { setupSettingsSchema, type SetupSettings } from "@/lib/schemas/settings";
import { resolveSwitch } from "@/lib/engine/profile-switcher";
import {
  autoSwitchStateSchema,
  defaultStreamProfiles,
  gameSignalSchema,
  streamProfileDraftSchema,
  streamProfileFileSchema,
  MAX_STREAM_PROFILES,
  PROFILE_LAST_ERROR,
  PROFILE_LIMIT_ERROR,
  type StreamProfile,
  type StreamProfileDraft,
} from "@/lib/schemas/stream-profile";
import {
  widgetSettingsSchema,
  type OverlayScreen,
  type WidgetSettings,
} from "@/lib/schemas/widget";
import type {
  ActionsRepo,
  ConnectionService,
  DataBackend,
  EntitlementsService,
  EventSimulator,
  EventsRepo,
  PointsRepo,
  RealtimeBus,
  ScreensRepo,
  SettingsRepo,
  StreamProfilesRepo,
  TimersRepo,
  WidgetRepo,
} from "../ports";
import { simulateEvent } from "./simulator";
import { defaultState, loadState, mutate, newId, resetState } from "./store";

/**
 * Mock backend — PRD §12.2 (Faz 0-1).
 * Aynı `ports.ts` imzaları Faz 2'de Supabase implementasyonuyla değiştirilecek.
 */

/** Ağ gecikmesi taklidi — loading durumlarının gerçekten görülmesi için. */
const LATENCY_MS = 80;
const delay = <T>(value: T): Promise<T> =>
  new Promise((resolve) => setTimeout(() => resolve(value), LATENCY_MS));

/* -------------------------------------------------------------------------- */

const actions: ActionsRepo = {
  list: () => delay([...loadState().actions]),
  get: (id) => delay(loadState().actions.find((a) => a.id === id) ?? null),

  create: async (draft: ActionDraft) => {
    const parsed = actionDraftSchema.parse(draft);
    const action: Action = { ...parsed, id: newId("act") };
    mutate((s) => {
      s.actions.push(action);
    });
    return delay(action);
  },

  update: async (id, draft) => {
    const parsed = actionDraftSchema.parse(draft);
    const updated: Action = { ...parsed, id };
    mutate((s) => {
      const idx = s.actions.findIndex((a) => a.id === id);
      if (idx !== -1) s.actions[idx] = updated;
    });
    return delay(updated);
  },

  remove: async (id) => {
    mutate((s) => {
      s.actions = s.actions.filter((a) => a.id !== id);
      // Silinen eylem, etkinlik bağlantılarından da düşer.
      for (const e of s.events) {
        e.actionsAll = e.actionsAll.filter((a) => a !== id);
        e.actionsRandom = e.actionsRandom.filter((a) => a !== id);
      }
      s.timers = s.timers.filter((t) => t.actionId !== id);
    });
    return delay(undefined);
  },

  nameExists: (name, exceptId) =>
    delay(
      loadState().actions.some(
        (a) => a.id !== exceptId && a.name.trim().toLowerCase() === name.trim().toLowerCase(),
      ),
    ),
};

const events: EventsRepo = {
  list: () => delay([...loadState().events]),

  create: async (draft) => {
    const event = { ...draft, id: newId("evt") } as StreamEvent;
    mutate((s) => {
      s.events.push(event);
    });
    return delay(event);
  },

  update: async (id, draft) => {
    const updated = { ...draft, id } as StreamEvent;
    mutate((s) => {
      const idx = s.events.findIndex((e) => e.id === id);
      if (idx !== -1) s.events[idx] = updated;
    });
    return delay(updated);
  },

  remove: async (id) => {
    mutate((s) => {
      s.events = s.events.filter((e) => e.id !== id);
    });
    return delay(undefined);
  },

  signatureExists: (signature, exceptId) =>
    delay(
      loadState().events.some(
        (e) => e.id !== exceptId && eventSignature(e) === signature,
      ),
    ),
};

const timers: TimersRepo = {
  list: () => delay([...loadState().timers]),

  create: async (draft) => {
    const timer: StreamTimer = { ...draft, id: newId("tmr") };
    mutate((s) => {
      s.timers.push(timer);
    });
    return delay(timer);
  },

  update: async (id, draft) => {
    const updated: StreamTimer = { ...draft, id };
    mutate((s) => {
      const idx = s.timers.findIndex((t) => t.id === id);
      if (idx !== -1) s.timers[idx] = updated;
    });
    return delay(updated);
  },

  remove: async (id) => {
    mutate((s) => {
      s.timers = s.timers.filter((t) => t.id !== id);
    });
    return delay(undefined);
  },
};

const screens: ScreensRepo = {
  list: () => delay([...loadState().screens]),

  update: async (screen, patch) => {
    let result: OverlayScreen | undefined;
    mutate((s) => {
      const idx = s.screens.findIndex((x) => x.screen === screen);
      if (idx !== -1) {
        s.screens[idx] = { ...s.screens[idx], ...patch };
        result = s.screens[idx];
      }
    });
    return delay(result ?? { screen, name: `Screen ${screen}`, maxQueueLength: 10, online: false });
  },
};

const settings: SettingsRepo = {
  get: () => delay(loadState().settings),

  /**
   * Bölüm bazında BİRLEŞTİRİR (sığ merge değil).
   *
   * Sığ merge'de `patch({ obs: { ip } })` çağrısı port/password alanlarını silerdi;
   * port sözleşmesi `Partial<SetupSettings>` olduğu için çağıranın tam nesne
   * göndermek zorunda kalması bir tuzaktı. Bölümler tek seviye iç içe olduğundan
   * genel bir deep-merge yerine bölüm bazlı birleştirme yeterli ve öngörülebilir.
   */
  patch: async (patch) => {
    let result: SetupSettings = loadState().settings;
    mutate((s) => {
      const merged = { ...s.settings } as Record<string, unknown>;
      for (const [section, value] of Object.entries(patch)) {
        if (value === undefined) continue;
        const current = merged[section];
        merged[section] =
          current && typeof current === "object" && !Array.isArray(current)
            ? { ...(current as object), ...(value as object) }
            : value;
      }
      s.settings = merged as unknown as SetupSettings;
      result = s.settings;
    });
    return delay(result);
  },

  /** Mock "Test Bağlantısı" — PRD §15.4: gerçek soket yok, akış doğrulanır. */
  test: async (target) => {
    const state = loadState();
    const configured =
      target === "obs"
        ? !!state.settings.obs.ip
        : target === "streamerbot"
          ? !!state.settings.streamerbot.address
          : !!state.settings.minecraft.ip;

    await new Promise((r) => setTimeout(r, 600));
    return configured
      ? { ok: true, messageKey: "setup.test.success", latencyMs: 40 + Math.floor(Math.random() * 60) }
      : { ok: false, messageKey: "setup.test.failed" };
  },

  export: () => delay(JSON.stringify(loadState(), null, 2)),

  import: async (json) => {
    const parsed = JSON.parse(json) as { settings?: unknown };
    const next = setupSettingsSchema.parse(parsed.settings ?? parsed);
    mutate((s) => {
      s.settings = next;
    });
    return delay(next);
  },

  reset: async () => delay(resetState().settings),

  /**
   * TikFinity (.tfc) içe aktarma planını yerel depoya uygular — ADR-0007.
   *
   * TEK `mutate()` içinde yapılır: 50 eylem için tek tek `actions.create()`
   * çağırmak 50 ayrı yazma + 50×80 ms sahte gecikme demekti. Ayrıca yarım
   * uygulama oluşamaz (ya hepsi ya hiçbiri).
   *
   * EKLER, EZMEZ: eylem/etkinlik/zamanlayıcı mevcut listelerin sonuna gelir
   * (id'ler `lib/tfc` tarafında zaten yeniden üretilmiştir). Tekil olanlar
   * (ayarlar/ekranlar/widget) üzerine yazılır — kullanıcı bunu önizlemede görür.
   */
  applyImport: async (plan) => {
    mutate((s) => {
      s.actions = [...s.actions, ...plan.actions];
      s.events = [...s.events, ...plan.events];
      s.timers = [...s.timers, ...plan.timers];
      s.screens = plan.screens;
      s.settings = plan.settings;
      s.widgetSettings = { ...s.widgetSettings, ...plan.widgetSettings };
    });
    return delay(undefined);
  },
};

/**
 * Widget (overlay) sayfalarının servis edildiği kök adres.
 *
 * NEDEN AYARLANABİLİR: Ekran URL'i normalde panelin açık olduğu adresten
 * türetilir (`window.location.origin`). Ama panel yerelde çalışırken widget'ın
 * BAŞKA bir adresten servis edilmesi gerekebilir — TikTok LIVE Studio
 * `localhost` adreslerini tarayıcı kaynağı olarak KABUL ETMİYOR ("Doğru URL'yi
 * girin"), https bir adres istiyor. Bu durumda panel yerelde kalır (Supabase'e
 * yazabilen tek taraf odur), widget ise yayındaki kopyadan servis edilir.
 *
 * `NEXT_PUBLIC_WIDGET_ORIGIN` verilmişse Kopyala butonu doğrudan o adresi üretir
 * — kullanıcının URL'i elle düzenlemesi (ve `id`'yi bozması) gerekmez.
 */
function widgetOrigin(): string {
  const configured = process.env.NEXT_PUBLIC_WIDGET_ORIGIN?.trim();
  if (configured) return configured.replace(/\/+$/, ""); // sondaki / çift kalmasın
  return typeof window !== "undefined" ? window.location.origin : "";
}

const widgets: WidgetRepo = {
  getSettings: (widgetId) =>
    delay(loadState().widgetSettings[widgetId] ?? widgetSettingsSchema.parse({})),

  saveSettings: async (widgetId, next: WidgetSettings) => {
    mutate((s) => {
      s.widgetSettings[widgetId] = next;
    });
    return delay(next);
  },

  url: (widgetId, params) => {
    const cid = loadState().channelId;
    const search = new URLSearchParams({ cid });
    for (const [k, v] of Object.entries(params ?? {})) search.set(k, String(v));
    return `${widgetOrigin()}/widget/${widgetId}?${search.toString()}`;
  },
};

const points: PointsRepo = {
  listViewers: (query) => {
    const all = loadState().viewers;
    const search = query?.search?.toLowerCase();
    const filtered = search
      ? all.filter(
          (v) =>
            v.uniqueId.toLowerCase().includes(search) ||
            v.nickname.toLowerCase().includes(search),
        )
      : all;
    return delay({ rows: filtered.slice(0, query?.limit ?? 100), total: filtered.length });
  },

  listTransactions: (query) => {
    const all = [...loadState().transactions].sort((a, b) => b.ts - a.ts);
    return delay({ rows: all.slice(0, query?.limit ?? 100), total: all.length });
  },

  addTransaction: async (tx) => {
    const existing = tx.sourceEventId
      ? loadState().transactions.find((t) => t.sourceEventId === tx.sourceEventId)
      : undefined;
    // Idempotency — aynı olay iki kez ledger'a yazılmaz (PRD §13).
    if (existing) return delay(existing);

    const record: Transaction = { ...tx, id: newId("tx"), ts: Date.now() };
    mutate((s) => {
      s.transactions.push(record);
      const viewer = s.viewers.find((v) => v.userId === tx.userId);
      if (viewer) {
        viewer.points += tx.amount;
        viewer.lastActivityTs = record.ts;
      } else {
        s.viewers.push({
          userId: tx.userId,
          uniqueId: tx.uniqueId,
          nickname: tx.uniqueId,
          points: tx.amount,
          level: 0,
          firstActivityTs: record.ts,
          lastActivityTs: record.ts,
        });
      }
    });
    return delay(record);
  },

  removeTransaction: async (id) => {
    mutate((s) => {
      const tx = s.transactions.find((t) => t.id === id);
      if (tx) {
        const viewer = s.viewers.find((v) => v.userId === tx.userId);
        if (viewer) viewer.points -= tx.amount;
      }
      s.transactions = s.transactions.filter((t) => t.id !== id);
    });
    return delay(undefined);
  },
};

/* -------------------------------------------------------------------------- */
/* Bağlantı durum makinesi — PRD §12.4                                         */
/* -------------------------------------------------------------------------- */

function createConnection(): ConnectionService {
  let state: ConnectionState = "disconnected";
  const listeners = new Set<(s: ConnectionState) => void>();

  const set = (next: ConnectionState) => {
    state = next;
    for (const l of listeners) l(next);
  };

  return {
    getState: () => state,

    connect: async (username: string) => {
      if (!username.trim()) throw new Error("invalidUsername");
      set("connecting");
      // Disconnected → Connecting → LIVE (mock gecikme).
      await new Promise((r) => setTimeout(r, 1200));
      mutate((s) => {
        s.settings.tiktok = { username: username.replace(/^@/, "") };
      });
      set("live");
    },

    disconnect: async () => {
      await new Promise((r) => setTimeout(r, 200));
      set("disconnected");
    },

    subscribe: (listener) => {
      listeners.add(listener);
      listener(state);
      return () => listeners.delete(listener);
    },
  };
}

/**
 * Olay veri yolu — PRD §6.3 kanal modelinin Faz 1 karşılığı.
 *
 * Bellek içi Set tek başına yetmez: `/widget/*` AYRI bir belgedir (kendi sekmesi veya
 * OBS kaynağı), yani Event Simulator'ın olayı widget'a hiç ulaşmazdı. BroadcastChannel
 * aynı origin'deki tüm sekmeleri birbirine bağlar → widget'ı başka sekmede açıp
 * simülatörü çalıştırmak gerçekten iş görür.
 *
 * SINIR: OBS'in browser source'u ayrı bir tarayıcı sürecidir; BroadcastChannel oraya
 * ulaşmaz. Gerçek OBS entegrasyonu Faz 2'deki WS gateway'i bekliyor (PRD §6.3).
 */
const BUS_CHANNEL = "livekit.bus.v1";

function createBus(): RealtimeBus {
  const listeners = new Set<(e: LiveEvent) => void>();

  const channel =
    typeof BroadcastChannel !== "undefined" ? new BroadcastChannel(BUS_CHANNEL) : null;

  if (channel) {
    channel.onmessage = (msg: MessageEvent<LiveEvent>) => {
      // Uzak sekmeden gelen olay — yerel dinleyicilere ver, geri yayınlama (döngü olur).
      for (const l of listeners) l(msg.data);
    };
  }

  return {
    publish: (event) => {
      for (const l of listeners) l(event);
      // Aynı olay id'si diğer sekmeye gider; motor dedup'ı çift işlemeyi zaten engeller.
      channel?.postMessage(event);
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

/* -------------------------------------------------------------------------- */
/* Akış Profilleri — ADR-0006                                                  */
/* -------------------------------------------------------------------------- */

function readProfile(id: string): StreamProfile {
  const found = loadState().streamProfiles.find((p) => p.id === id);
  if (!found) throw new Error(`Profil bulunamadı: ${id}`);
  return found;
}

/** Aktif profil kaydı — bozuk/eksik id'de listenin ilkine düşer (UI asla boş kalmaz). */
function readActive(): StreamProfile {
  const state = loadState();
  return (
    state.streamProfiles.find((p) => p.id === state.activeProfileId) ??
    state.streamProfiles[0]
  );
}

/**
 * Profili yürürlüğe koyar. Faz 1'de görünür etkisi Hızlı Erişim anahtarlarıdır
 * (PRD §5.1); ses/çarpan/ekran alanları motora Faz 2'de bağlanacak (ADR-0006 §Sonuç).
 */
function applyProfile(profile: StreamProfile, at: number): void {
  mutate((s) => {
    s.activeProfileId = profile.id;
    s.lastProfileSwitchAt = at;
    s.quickAccess = {
      tts: profile.settings.ttsEnabled,
      sounds: profile.settings.soundsEnabled,
      actions: profile.settings.actionsEnabled,
    };
  });
}

function insertProfile(draft: StreamProfileDraft): StreamProfile {
  if (loadState().streamProfiles.length >= MAX_STREAM_PROFILES) {
    throw new Error(PROFILE_LIMIT_ERROR);
  }
  const profile: StreamProfile = { ...streamProfileDraftSchema.parse(draft), id: newId("prf") };
  mutate((s) => {
    s.streamProfiles = [...s.streamProfiles, profile];
  });
  return profile;
}

const profiles: StreamProfilesRepo = {
  list: () => delay([...loadState().streamProfiles]),
  active: () => delay(readActive()),

  create: async (draft) => delay(insertProfile(draft)),

  duplicate: async (id) => {
    const source = readProfile(id);
    const { id: _ignored, ...draft } = source;
    return delay(insertProfile(draft));
  },

  update: async (id, patch) => {
    const current = readProfile(id);
    const updated: StreamProfile = {
      ...streamProfileDraftSchema.parse({ ...current, ...patch }),
      id,
    };
    mutate((s) => {
      const idx = s.streamProfiles.findIndex((p) => p.id === id);
      if (idx !== -1) s.streamProfiles[idx] = updated;
    });
    // Aktif profil düzenlendiyse yeni ayarlar anında yürürlüğe girer. Düzenleme bir
    // GEÇİŞ değildir; dwell sayacı korunur, aksi halde her kaydırma dwell'i sıfırlardı.
    if (loadState().activeProfileId === id) {
      applyProfile(updated, loadState().lastProfileSwitchAt);
    }
    return delay(updated);
  },

  remove: async (id) => {
    const state = loadState();
    if (state.streamProfiles.length <= 1) throw new Error(PROFILE_LAST_ERROR);
    readProfile(id); // yoksa hata verir
    const remaining = state.streamProfiles.filter((p) => p.id !== id);
    mutate((s) => {
      s.streamProfiles = remaining;
    });
    if (state.activeProfileId === id) applyProfile(remaining[0], Date.now());
    return delay(undefined);
  },

  activate: async (id, opts) => {
    const profile = readProfile(id);
    const now = Date.now();
    applyProfile(profile, now);
    if (opts?.manual) {
      // Elle seçim, otomatik geçişi bir süre susturur (PRD §6.2 mantığıyla aynı ruh).
      mutate((s) => {
        s.autoSwitch = {
          ...s.autoSwitch,
          manualHoldUntil: now + s.autoSwitch.manualHoldSeconds * 1000,
        };
      });
    }
    return delay(profile);
  },

  importProfile: async (json) => {
    const raw: unknown = JSON.parse(json);
    // Hem dosya sarmalayıcısı hem çıplak profil nesnesi kabul edilir.
    const file = streamProfileFileSchema.safeParse(raw);
    const draft = file.success
      ? file.data.profile
      : streamProfileDraftSchema.parse(raw);
    return delay(insertProfile(draft));
  },

  exportProfile: async (id) => {
    const { id: _ignored, ...draft } = readProfile(id);
    return delay(
      JSON.stringify(
        streamProfileFileSchema.parse({
          kind: "livekit.streamProfile",
          version: 1,
          profile: draft,
        }),
        null,
        2,
      ),
    );
  },

  getAutoSwitch: () => delay({ ...loadState().autoSwitch }),

  setAutoSwitch: async (patch) => {
    const next = autoSwitchStateSchema.parse({ ...loadState().autoSwitch, ...patch });
    mutate((s) => {
      s.autoSwitch = next;
    });
    return delay(next);
  },

  getSignal: () => delay({ ...loadState().gameSignal }),

  reportSignal: async (patch) => {
    const now = Date.now();
    const signal = gameSignalSchema.parse({ ...loadState().gameSignal, ts: now, ...patch });
    mutate((s) => {
      s.gameSignal = signal;
    });

    const state = loadState();
    const decision = resolveSwitch({
      profiles: state.streamProfiles,
      activeProfileId: state.activeProfileId,
      signal,
      state: state.autoSwitch,
      lastSwitchAt: state.lastProfileSwitchAt,
      now,
    });

    if (decision.switched) applyProfile(readProfile(decision.profileId), now);
    return delay({ signal, decision, active: readActive() });
  },

  resetAll: async () => {
    const fresh = defaultStreamProfiles();
    mutate((s) => {
      s.streamProfiles = fresh;
      s.autoSwitch = autoSwitchStateSchema.parse({});
      s.gameSignal = gameSignalSchema.parse({});
    });
    applyProfile(fresh[0], Date.now());
    return delay(fresh);
  },
};

const simulator: EventSimulator = {
  simulate: (kind, options) => simulateEvent(kind, options),
};

/** Free/Pro limitleri — PRD §10 tablosu birebir. */
const entitlements: EntitlementsService = {
  isPro: () => loadState().isPro,
  limit: (feature) => {
    const pro = loadState().isPro;
    const table: Record<typeof feature, [number, number]> = {
      actions: [5, Infinity],
      sounds: [5, Infinity],
      ttsDaily: [100, Infinity],
      giftCounter: [1, 3],
      streamProfiles: [1, 10],
      socialRotator: [2, 100],
      pointsUsers: [2500, 100_000],
    };
    return table[feature][pro ? 1 : 0];
  },
};

/* -------------------------------------------------------------------------- */

let backend: DataBackend | null = null;

export function createMockBackend(): DataBackend {
  if (backend) return backend;
  backend = {
    actions,
    events,
    timers,
    screens,
    settings,
    profiles,
    widgets,
    points,
    connection: createConnection(),
    bus: createBus(),
    simulator,
    entitlements,
  };
  return backend;
}

export { defaultState, loadState, resetState };
