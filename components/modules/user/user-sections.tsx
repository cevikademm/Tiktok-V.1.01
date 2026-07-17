import {
  AlertTriangle,
  Download,
  Search,
  Settings,
  Users,
} from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardTitle } from "@/components/ui/card";

/**
 * Kullanıcı ve Puanlar bölümleri — PRD §5: user modülü.
 * Server Component'ler (CLAUDE.md §5.1).
 */

/* Açıklama ve bağlantılar. */
export async function UserHeader() {
  const t = await getTranslations();
  return (
    <Card id="section-users">
      <CardTitle>{t("userPoints.title")}</CardTitle>
      <CardBody>
        <p>
          {t("userPoints.description")}{" "}
          {t("userPoints.userCount", { count: 0 })}
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <span className="inline-flex items-center gap-1 text-sm text-link">
            <Settings className="size-3.5" aria-hidden />
            {t("userPoints.pointsSettings")}
          </span>
          <span className="text-muted">·</span>
          <span className="inline-flex items-center gap-1 text-sm text-link">
            {t("userPoints.resetOptions")}
          </span>
        </div>
      </CardBody>
    </Card>
  );
}

/* Uyarı şeridi. */
export async function UserSetupWarning() {
  const t = await getTranslations();
  return (
    <div className="flex w-full max-w-[var(--card-w)] items-center gap-3 rounded-[var(--card-radius)] border border-error/40 bg-error/10 px-4 py-3">
      <AlertTriangle className="size-4 shrink-0 text-error" aria-hidden />
      <p className="flex-1 text-sm text-error">{t("userPoints.setupWarning")}</p>
    </div>
  );
}

/* Kullanıcı tablosu — arama + dışa aktarma + veri tablosu. */
export async function UserDataGrid() {
  const t = await getTranslations();
  return (
    <Card>
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex flex-1 items-center gap-2 rounded-lg border border-border-soft bg-surface-2 px-3 py-1.5">
          <Search className="size-4 text-muted" aria-hidden />
          <span className="text-sm text-muted">
            {t("userPoints.searchPlaceholder")}
          </span>
        </div>
        <Button variant="secondary" size="sm">
          <Download className="size-3.5" aria-hidden />
          {t("userPoints.exportUsers")}
        </Button>
      </div>

      {/* Veri tablosu */}
      <div className="mt-4 overflow-hidden rounded-lg border border-border-subtle">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <caption className="sr-only">{t("userPoints.title")}</caption>
            <thead className="bg-surface-2 text-xs text-muted uppercase">
              <tr>
                <th scope="col" className="px-4 py-2.5 font-medium">
                  {t("userPoints.table.user")}
                </th>
                <th scope="col" className="px-4 py-2.5 font-medium">
                  {t("userPoints.table.level")}
                </th>
                <th scope="col" className="px-4 py-2.5 font-medium">
                  {t("userPoints.table.pointsTotal")}
                </th>
                <th scope="col" className="px-4 py-2.5 font-medium">
                  {t("userPoints.table.pointsCounted")}
                </th>
                <th scope="col" className="px-4 py-2.5 font-medium">
                  {t("userPoints.table.firstActivity")}
                </th>
                <th scope="col" className="px-4 py-2.5 font-medium">
                  {t("userPoints.table.lastActivity")}
                </th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center">
                  <div className="flex flex-col items-center gap-3">
                    <Users className="size-10 text-muted/40" aria-hidden />
                    <p className="text-muted">{t("userPoints.noUsers")}</p>
                    <p className="text-xs text-muted-2">
                      {t("userPoints.noUsersHint")}
                    </p>
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
