import type { ReactNode } from "react";
import { HataBildirWidget } from "@/components/error-report/hata-bildir-widget";
import { IconRail } from "@/components/layout/icon-rail";
import { SubMenu } from "@/components/layout/sub-menu";
import { Topbar } from "@/components/layout/topbar";

/**
 * SPA kabuğu — PRD §4.3:
 * topbar 54px + sol ikon rayı 64px + alt menü 256px + içerik h-[calc(100%-54px)].
 */
export default function AppShellLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-screen flex-col overflow-hidden">
      <Topbar />

      <div className="flex h-[calc(100%-var(--topbar-h))] flex-1">
        <IconRail />
        <SubMenu />

        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>

      {/* Hata Bildir FAB — yalnızca admin modunda görünür (kendi içinde kapılı). */}
      <HataBildirWidget />
    </div>
  );
}
