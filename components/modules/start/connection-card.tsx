"use client";

import { Link2, Radio } from "lucide-react";
import { useTranslations } from "next-intl";
import { useApp } from "@/components/providers/app-provider";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardTitle } from "@/components/ui/card";
import { useToast } from "@/components/ui/toast";
import { Link, useRouter } from "@/lib/i18n/navigation";

/**
 * PRD §5.1.3-4: offline'da "TikTok LIVE Connection" kartı,
 * bağlıyken "You are LIVE!" durumu (tarayıcı/masaüstü varyant metinleri).
 */
export function ConnectionCard() {
  const t = useTranslations();
  const router = useRouter();
  const toast = useToast();
  const { connection, connect, disconnect, backend } = useApp();

  const isLive = connection === "live";

  async function handleConnect() {
    const settings = await backend.settings.get();
    const username = settings.tiktok?.username;
    if (!username) {
      router.push("/setup");
      return;
    }
    try {
      await connect(username);
    } catch (err) {
      // Bağlantı hatasını kullanıcıya göster; reddi yakalamazsak
      // "Uncaught (in promise)" olarak konsola düşer.
      const message = err instanceof Error ? err.message : String(err);
      toast.show(message, "error");
    }
  }

  if (isLive) {
    return (
      <Card id="section-connection" featured>
        <div className="flex items-center gap-2">
          <Radio className="size-5 animate-live text-tiktok" aria-hidden />
          <CardTitle className="mb-0">{t("start.liveTitle")}</CardTitle>
        </div>
        <CardBody className="mt-2">
          <p>{t("start.liveBodyBrowser")}</p>
        </CardBody>
        <Button variant="secondary" size="sm" className="mt-4" onClick={() => disconnect()}>
          {t("topbar.disconnect")}
        </Button>
      </Card>
    );
  }

  return (
    <Card id="section-connection">
      <CardTitle as="h3">{t("start.connectionTitle")}</CardTitle>
      <CardBody>
        <p>{t("start.connectionBody")}</p>
      </CardBody>
      <Button
        raised
        className="mt-4"
        onClick={handleConnect}
        disabled={connection === "connecting"}
      >
        <Link2 className="size-4" aria-hidden />
        {connection === "connecting" ? t("topbar.connecting") : t("start.connectionTitle")}
      </Button>
    </Card>
  );
}

/** PRD §5.1.2: Hoş geldin kartı (offline durumda), TTS ve Sesler'e inline linkler. */
export function WelcomeCard() {
  const t = useTranslations();
  const { connection } = useApp();

  if (connection === "live") return null;

  return (
    <Card id="section-welcome">
      <CardTitle>{t("start.welcomeTitle")}</CardTitle>
      <CardBody>
        {/* Mesajdaki <tts>/<sounds> etiketleri link'e sarılır (next-intl t.rich). */}
        {t.rich("start.welcomeBody", {
          tts: (chunks) => (
            // Metin içi link: yalnız renkle ayrışmak WCAG 1.4.1'i ihlal eder (axe
            // link-in-text-block) — çevre metinle kontrast 3:1'in altında, altçizgi şart.
            <Link
              href="/tts"
              className="text-link underline underline-offset-2 hover:text-link-hover"
            >
              {chunks}
            </Link>
          ),
          sounds: (chunks) => (
            <Link
              href="/sounds"
              className="text-link underline underline-offset-2 hover:text-link-hover"
            >
              {chunks}
            </Link>
          ),
        })}
      </CardBody>
    </Card>
  );
}
