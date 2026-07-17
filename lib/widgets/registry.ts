import type { WidgetCategory, WidgetId, WidgetMeta } from "@/lib/schemas/widget";

/**
 * Widget envanteri — PRD §5.4.
 * `implemented: true` olanlar render edilir; diğerleri galeride "yakında" durumunda.
 */
export const WIDGETS: WidgetMeta[] = [
  { id: "myactions", category: "actions", pro: false, implemented: true, params: ["screen"] },
  { id: "gifts", category: "feeds", pro: false, implemented: false, params: [] },
  { id: "chat", category: "feeds", pro: false, implemented: false, params: [] },
  { id: "activity-feed", category: "feeds", pro: false, implemented: false, params: [] },
  { id: "viewercount", category: "counters", pro: false, implemented: false, params: [] },
  { id: "followercounter", category: "counters", pro: false, implemented: false, params: ["c"] },
  { id: "topgifter", category: "counters", pro: false, implemented: false, params: [] },
  { id: "topliker", category: "counters", pro: false, implemented: false, params: [] },
  { id: "ranking", category: "counters", pro: false, implemented: false, params: [] },
  { id: "transactionviewer", category: "feeds", pro: false, implemented: false, params: [] },
  { id: "userinfo", category: "feeds", pro: false, implemented: false, params: [] },
  { id: "carousel", category: "feeds", pro: false, implemented: false, params: [] },
  { id: "goal", category: "goals", pro: true, implemented: false, params: ["metric"] },
  { id: "countdowngoals", category: "goals", pro: true, implemented: false, params: [] },
  { id: "gcounter", category: "counters", pro: false, implemented: false, params: ["c"] },
  { id: "lastx", category: "feeds", pro: false, implemented: false, params: ["x"] },
  { id: "timer", category: "games", pro: false, implemented: false, params: [] },
  { id: "wheel", category: "games", pro: false, implemented: false, params: [] },
  { id: "wheelofactions", category: "games", pro: true, implemented: false, params: [] },
  { id: "cannon", category: "graphics", pro: true, implemented: false, params: [] },
  { id: "firework", category: "graphics", pro: true, implemented: false, params: [] },
  { id: "likes", category: "graphics", pro: true, implemented: false, params: [] },
  { id: "christmasevent", category: "graphics", pro: false, implemented: false, params: [] },
  { id: "songrequests", category: "feeds", pro: false, implemented: false, params: [] },
  { id: "coindrop", category: "games", pro: false, implemented: false, params: [] },
  { id: "quiz", category: "games", pro: false, implemented: false, params: [] },
];

export function widgetMeta(id: string): WidgetMeta | undefined {
  return WIDGETS.find((w) => w.id === id);
}

export function widgetsByCategory(category: WidgetCategory): WidgetMeta[] {
  return WIDGETS.filter((w) => w.category === category);
}

export function isWidgetId(value: string): value is WidgetId {
  return WIDGETS.some((w) => w.id === value);
}
