import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { SectionNavigator } from "@/components/layout/section-navigator";
import {
  ChatbotHeader,
  ChatbotSetupWarning,
  CommandsList,
  MessageLogSection,
  SnippetsSection,
  SpamProtectionSection,
  StreamerbotMessagesSection,
} from "@/components/modules/chatbot/chatbot-sections";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale });
  return { title: t("chatbot.title") };
}

/**
 * Sohbet Komutları (`chatbot`) — PRD §5: sohbet komutları yönetimi.
 * Orijinal SPA'daki data-pageid="chatcommands" sayfasının birebir karşılığı.
 */
export default async function ChatbotPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations();

  const sections = [
    { id: "section-commands", label: t("chatbot.sections.commands") },
    { id: "section-messageLog", label: t("chatbot.sections.messageLog") },
    { id: "section-spamProtection", label: t("chatbot.sections.spamProtection") },
    { id: "section-streamerbotMessages", label: t("chatbot.sections.streamerbotMessages") },
    { id: "section-snippets", label: t("chatbot.sections.snippets") },
  ];

  return (
    <div className="flex gap-6 p-6">
      <div className="flex flex-1 flex-col items-center gap-4">
        <ChatbotHeader />
        <ChatbotSetupWarning />
        <CommandsList />
        <MessageLogSection />
        <SpamProtectionSection />
        <StreamerbotMessagesSection />
        <SnippetsSection />
      </div>

      <SectionNavigator sections={sections} />
    </div>
  );
}
