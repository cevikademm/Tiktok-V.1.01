import type { ReactNode } from "react";
import { DebugPanel } from "@/components/debug/debug-panel";
import { ErrorReportBackup } from "@/components/error-report/error-report-backup";
import { HataBildirWidget } from "@/components/error-report/hata-bildir-widget";
import { IconRail } from "@/components/layout/icon-rail";
import { SubMenu } from "@/components/layout/sub-menu";
import { Topbar } from "@/components/layout/topbar";
import { InstallBanner } from "@/components/pwa/install-banner";
import { redirect } from "@/lib/i18n/navigation";
import { createClient } from "@/lib/supabase/server";

/**
 * SPA kabuğu — PRD §4.3:
 * topbar 54px + sol ikon rayı 64px + alt menü 256px + içerik h-[calc(100%-54px)].
 *
 * SERT KAPI (auth gate): tüm panel rotaları giriş ister. Oturumsuz kullanıcı
 * `/login`e yönlendirilir (locale korunur). Token yenilemesi middleware'de
 * yapıldığı için `getUser()` burada taze oturumu görür.
 */
export default async function AppShellLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect({ href: "/login", locale });

  return (
    <div className="flex h-screen flex-col overflow-hidden">
      <Topbar />

      <div className="flex h-[calc(100%-var(--topbar-h))] flex-1">
        <IconRail />
        <SubMenu />

        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>

      {/* PWA "Ana ekrana ekle" banner'ı — uygun koşullarda alttan açılır (widget'larda görünmez). */}
      <InstallBanner />

      {/* Hata Bildir FAB — yalnızca admin modunda görünür (kendi içinde kapılı). */}
      <HataBildirWidget />

      {/* Hata Bildirimleri Supabase yedeği — mount catch-up (görsel çıktı yok, ADR-0004). */}
      <ErrorReportBackup />

      {/* Hata Ayıklama Paneli — yalnızca debugMode açıkken görünür (kendi içinde kapılı). */}
      <DebugPanel />
    </div>
  );
}
