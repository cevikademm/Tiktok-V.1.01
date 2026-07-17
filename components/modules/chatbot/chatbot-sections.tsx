import {
  AlertTriangle,
  ChevronRight,
  HelpCircle,
  MessageSquare,
  Plus,
  Settings,
  Shield,
  Terminal,
} from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardTitle } from "@/components/ui/card";

/**
 * Sohbet Komutları bölümleri — PRD §5: chatcommands / chatbot modülü.
 * Server Component'ler (CLAUDE.md §5.1).
 */

/* Açıklama ve uyarı. */
export async function ChatbotHeader() {
  const t = await getTranslations();
  return (
    <Card id="section-commands">
      <CardTitle>{t("chatbot.title")}</CardTitle>
      <CardBody>
        <p>{t("chatbot.description")}</p>
        <p className="mt-2 text-xs text-warning">{t("chatbot.descriptionNote")}</p>
      </CardBody>
    </Card>
  );
}

/* Uyarı şeridi. */
export async function ChatbotSetupWarning() {
  const t = await getTranslations();
  return (
    <div className="flex w-full max-w-[var(--card-w)] items-center gap-3 rounded-[var(--card-radius)] border border-error/40 bg-error/10 px-4 py-3">
      <AlertTriangle className="size-4 shrink-0 text-error" aria-hidden />
      <p className="flex-1 text-sm text-error">{t("chatbot.setupWarning")}</p>
    </div>
  );
}

/* Komut listesi — her komutun checkbox + text input + ayar butonu var. */
export async function CommandsList() {
  const t = await getTranslations();

  const commands = [
    "help",
    "getPoints",
    "leaderboard",
    "game",
    "play",
    "skip",
    "gamble",
    "duel",
    "givePoints",
    "watchtime",
  ] as const;

  return (
    <Card>
      <div className="flex flex-col divide-y divide-border-subtle">
        {commands.map((key) => (
          <div key={key} className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
            {/* Checkbox durumu */}
            <div className="mt-1 flex size-5 shrink-0 items-center justify-center rounded border border-border-soft bg-surface-2">
              <div className="size-3 rounded-sm bg-primary" />
            </div>

            {/* Komut adı ve açıklama */}
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-white">
                  {t(`chatbot.commands.${key}`)}
                </span>
                <code className="rounded bg-surface-3 px-1.5 py-0.5 text-xs text-link">
                  !{key === "getPoints" ? "points" : key === "givePoints" ? "give" : key}
                </code>
              </div>
              <p className="mt-1 text-xs text-muted-2">
                {t(`chatbot.commands.${key}Desc`)}
              </p>
            </div>

            {/* Ayar ve yardım butonları */}
            <div className="flex items-center gap-1">
              <button
                type="button"
                className="flex size-8 items-center justify-center rounded-lg text-muted transition-colors hover:bg-white/8 hover:text-white"
                aria-label={t("chatbot.howItWorks")}
              >
                <HelpCircle className="size-4" aria-hidden />
              </button>
              <button
                type="button"
                className="flex size-8 items-center justify-center rounded-lg text-muted transition-colors hover:bg-white/8 hover:text-white"
                aria-label={t("common.customize")}
              >
                <Settings className="size-4" aria-hidden />
              </button>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

/* Mesaj günlüğü bölümü. */
export async function MessageLogSection() {
  const t = await getTranslations();
  return (
    <Card id="section-messageLog">
      <CardTitle as="h3">{t("chatbot.messageLog.title")}</CardTitle>
      <CardBody>{t("chatbot.messageLog.description")}</CardBody>

      <div className="mt-4 overflow-hidden rounded-lg border border-border-subtle">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <caption className="sr-only">{t("chatbot.messageLog.title")}</caption>
            <thead className="bg-surface-2 text-xs text-muted uppercase">
              <tr>
                <th scope="col" className="px-4 py-2.5 font-medium">{t("chatbot.messageLog.table.time")}</th>
                <th scope="col" className="px-4 py-2.5 font-medium">{t("chatbot.messageLog.table.user")}</th>
                <th scope="col" className="px-4 py-2.5 font-medium">{t("chatbot.messageLog.table.message")}</th>
                <th scope="col" className="px-4 py-2.5 font-medium">{t("chatbot.messageLog.table.type")}</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td colSpan={4} className="px-4 py-10 text-center">
                  <div className="flex flex-col items-center gap-2">
                    <MessageSquare className="size-8 text-muted/40" aria-hidden />
                    <p className="text-muted">{t("chatbot.messageLog.noMessages")}</p>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </Card>
  );
}

/* Spam koruması bölümü. */
export async function SpamProtectionSection() {
  const t = await getTranslations();

  const settings = [
    { key: "enabled", type: "toggle" },
    { key: "maxRepeat", type: "number" },
    { key: "cooldown", type: "number" },
    { key: "blockLinks", type: "toggle" },
    { key: "blockCaps", type: "toggle" },
  ] as const;

  return (
    <Card id="section-spamProtection">
      <CardTitle as="h3">
        <span className="flex items-center gap-2">
          <Shield className="size-4 text-primary" aria-hidden />
          {t("chatbot.spamProtection.title")}
        </span>
      </CardTitle>
      <CardBody>{t("chatbot.spamProtection.description")}</CardBody>

      <div className="mt-4 flex flex-col gap-3">
        {settings.map(({ key, type }) => (
          <div
            key={key}
            className="flex items-center justify-between rounded-lg border border-border-subtle bg-surface-2 px-4 py-3"
          >
            <span className="text-sm text-white">
              {t(`chatbot.spamProtection.${key}`)}
            </span>
            {type === "toggle" ? (
              <div className="relative h-5 w-9 rounded-full bg-primary">
                <span className="absolute top-0.5 left-0.5 size-4 translate-x-4 rounded-full bg-white" />
              </div>
            ) : (
              <div className="h-8 w-20 rounded-lg border border-border-soft bg-surface-1 px-2 text-sm text-muted" />
            )}
          </div>
        ))}
      </div>
    </Card>
  );
}

/* Streamer.bot mesajları bölümü. */
export async function StreamerbotMessagesSection() {
  const t = await getTranslations();
  return (
    <Card id="section-streamerbotMessages">
      <CardTitle as="h3">
        <span className="flex items-center gap-2">
          <Terminal className="size-4 text-primary" aria-hidden />
          {t("chatbot.streamerbotMessages.title")}
        </span>
      </CardTitle>
      <CardBody>{t("chatbot.streamerbotMessages.description")}</CardBody>
      <div className="mt-3 flex items-center justify-between rounded-lg border border-border-subtle bg-surface-2 px-4 py-3">
        <span className="text-sm text-white">{t("chatbot.streamerbotMessages.enabled")}</span>
        <div className="relative h-5 w-9 rounded-full bg-surface-4">
          <span className="absolute top-0.5 left-0.5 size-4 rounded-full bg-white" />
        </div>
      </div>
    </Card>
  );
}

/* Snippet yapılandırması bölümü. */
export async function SnippetsSection() {
  const t = await getTranslations();
  return (
    <Card id="section-snippets">
      <CardTitle as="h3">{t("chatbot.snippets.title")}</CardTitle>
      <CardBody>{t("chatbot.snippets.description")}</CardBody>
      <div className="mt-4 flex flex-col items-center gap-3 rounded-lg border border-border-subtle bg-surface-2 py-8">
        <p className="text-sm text-muted">{t("chatbot.snippets.noSnippets")}</p>
        <Button size="sm">
          <Plus className="size-3.5" aria-hidden />
          {t("chatbot.snippets.createSnippet")}
        </Button>
      </div>
    </Card>
  );
}
