/**
 * Modül kayıt defteri — PRD §2 (29 modül) + §4.1 (10 bubble + aksan renkleri).
 *
 * `pageId` orijinal SPA'nın `data-pageid` değeriyle birebir.
 * `labelKey` i18n anahtarı (nav.<key>) — burada ham metin YOK.
 * `phase` PRD §2 faz tablosundan; aktif faz dışındakiler "yakında" durumunda render edilir.
 */

export type BubbleKey =
  | "start"
  | "setup"
  | "layers"
  | "actions"
  | "sounds"
  | "chat"
  | "points"
  | "song"
  | "tools"
  | "agencies";

export interface NavItem {
  /** Orijinal SPA data-pageid */
  pageId: string;
  /** Klon route'u (locale prefix'i next-intl ekler) */
  href: string;
  labelKey: string;
  phase: number;
}

export interface NavBubble {
  key: BubbleKey;
  labelKey: string;
  /** globals.css token'ı — bileşende hex yok (CLAUDE.md §5.3). */
  accentVar: string;
  /** Lucide ikon adı — PRD §4.5 FA eşlemesi (FA Pro ikonları Lucide karşılığıyla). */
  icon: string;
  /** Tek sayfalık bubble (alt menü açmaz). */
  href?: string;
  pageId?: string;
  phase?: number;
  items?: NavItem[];
}

export const NAV: NavBubble[] = [
  {
    key: "start",
    labelKey: "nav.start",
    accentVar: "--bubble-start",
    icon: "Home",
    href: "/start",
    pageId: "start",
    phase: 1,
  },
  {
    key: "setup",
    labelKey: "nav.setup",
    accentVar: "--bubble-setup",
    icon: "SlidersHorizontal",
    href: "/setup",
    pageId: "setup",
    phase: 1,
  },
  {
    key: "layers",
    labelKey: "nav.layers",
    accentVar: "--bubble-layers",
    icon: "Monitor",
    items: [
      { pageId: "obsoverlays", href: "/overlays", labelKey: "nav.obsoverlays", phase: 4 },
      { pageId: "obsdocks", href: "/docks", labelKey: "nav.obsdocks", phase: 4 },
      { pageId: "goals", href: "/goals", labelKey: "nav.goals", phase: 5 },
      { pageId: "countdowngoals", href: "/countdown-goals", labelKey: "nav.countdowngoals", phase: 5 },
      { pageId: "followercounter", href: "/follower-counter", labelKey: "nav.followercounter", phase: 5 },
      { pageId: "lastx", href: "/lastx", labelKey: "nav.lastx", phase: 5 },
      { pageId: "giftoverlays", href: "/gift-overlays", labelKey: "nav.giftoverlays", phase: 5 },
      { pageId: "graphicoverlays", href: "/graphic-overlays", labelKey: "nav.graphicoverlays", phase: 5 },
    ],
  },
  {
    key: "actions",
    labelKey: "nav.actions",
    accentVar: "--bubble-actions",
    icon: "Zap",
    href: "/actionsandevents",
    pageId: "actionsandevents",
    phase: 1,
  },
  {
    key: "sounds",
    labelKey: "nav.sounds",
    accentVar: "--bubble-sounds",
    icon: "Volume2",
    href: "/sounds",
    pageId: "sounds",
    phase: 3,
  },
  {
    key: "chat",
    labelKey: "nav.chat",
    accentVar: "--bubble-chat",
    icon: "MessagesSquare",
    items: [
      { pageId: "tts", href: "/tts", labelKey: "nav.tts", phase: 3 },
      { pageId: "chatbot", href: "/chatbot", labelKey: "nav.chatbot", phase: 3 },
      { pageId: "chatcommands", href: "/chatcommands", labelKey: "nav.chatcommands", phase: 3 },
    ],
  },
  {
    key: "points",
    labelKey: "nav.points",
    accentVar: "--bubble-points",
    icon: "Coins",
    items: [
      { pageId: "user", href: "/user", labelKey: "nav.user", phase: 5 },
      { pageId: "transactions", href: "/transactions", labelKey: "nav.transactions", phase: 5 },
      { pageId: "challenge", href: "/challenge", labelKey: "nav.challenge", phase: 6 },
      { pageId: "halving", href: "/halving", labelKey: "nav.halving", phase: 6 },
    ],
  },
  {
    key: "song",
    labelKey: "nav.song",
    accentVar: "--bubble-song",
    icon: "ListMusic",
    href: "/songrequests",
    pageId: "songrequests",
    phase: 6,
  },
  {
    key: "tools",
    labelKey: "nav.tools",
    accentVar: "--bubble-tools",
    icon: "Gamepad2",
    items: [
      { pageId: "wheel", href: "/wheel", labelKey: "nav.wheel", phase: 6 },
      { pageId: "coindrop", href: "/coindrop", labelKey: "nav.coindrop", phase: 6 },
      { pageId: "timer", href: "/timer", labelKey: "nav.timer", phase: 6 },
      { pageId: "likeathon", href: "/likeathon", labelKey: "nav.likeathon", phase: 6 },
      { pageId: "rtmpgen", href: "/rtmpgen", labelKey: "nav.rtmpgen", phase: 6 },
      { pageId: "christmasevent", href: "/christmas-event", labelKey: "nav.christmasevent", phase: 7 },
      { pageId: "dapi", href: "/dapi", labelKey: "nav.dapi", phase: 2 },
    ],
  },
  {
    key: "agencies",
    labelKey: "nav.agencies",
    accentVar: "--bubble-agencies",
    icon: "Users",
    items: [
      { pageId: "agencyregistry", href: "/agencies", labelKey: "nav.agencyregistry", phase: 7 },
      { pageId: "agencyapplications", href: "/agencies/applications", labelKey: "nav.agencyapplications", phase: 7 },
    ],
  },
];

/** Şu an geliştirilen faz — bunun üstündeki modüller "yakında" (CLAUDE.md §7). */
export const CURRENT_PHASE = 1;

/** Tüm modülleri düz liste olarak (arama ve breadcrumb için). */
export function allModules(): Array<NavItem & { bubble: BubbleKey }> {
  return NAV.flatMap((b) => {
    if (b.href && b.pageId) {
      return [
        {
          pageId: b.pageId,
          href: b.href,
          labelKey: b.labelKey,
          phase: b.phase ?? 99,
          bubble: b.key,
        },
      ];
    }
    return (b.items ?? []).map((i) => ({ ...i, bubble: b.key }));
  });
}

/** Bir pathname'in hangi bubble'a ait olduğunu bulur (locale prefix'i temizlenmiş). */
export function bubbleForPath(pathname: string): NavBubble | undefined {
  const modules = allModules();
  const match = modules
    .filter((m) => pathname === m.href || pathname.startsWith(`${m.href}/`))
    // En uzun eşleşme kazanır (/agencies vs /agencies/applications).
    .sort((a, b) => b.href.length - a.href.length)[0];
  if (!match) return undefined;
  return NAV.find((b) => b.key === match.bubble);
}

export function moduleForPath(
  pathname: string,
): (NavItem & { bubble: BubbleKey }) | undefined {
  return allModules()
    .filter((m) => pathname === m.href || pathname.startsWith(`${m.href}/`))
    .sort((a, b) => b.href.length - a.href.length)[0];
}

/** Breadcrumb bölüm sayısı rozeti — PRD §4.4.3 (ör. setup → 14). */
export const SECTION_COUNTS: Record<string, number> = {
  start: 10,
  setup: 14,
};
