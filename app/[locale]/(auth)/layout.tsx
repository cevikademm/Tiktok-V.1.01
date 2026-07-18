import type { ReactNode } from "react";

/**
 * Auth kabuğu — SPA chrome'u (topbar/sidebar) YOK. Ortalanmış, sade kart düzeni.
 * Marka arka planı `app/globals.css` token'larından gelir (bileşende hex yok).
 */
export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-surface-0 px-4 py-10">
      <main className="w-full max-w-md rounded-[var(--card-radius)] border border-border-subtle bg-surface-1 p-6 shadow-2xl sm:p-8">
        {children}
      </main>
    </div>
  );
}
