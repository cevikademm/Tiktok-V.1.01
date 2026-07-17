import { Construction } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Card, CardBody, CardTitle } from "@/components/ui/card";
import { CURRENT_PHASE } from "@/lib/nav";

/**
 * Faz dışı modüller — CLAUDE.md §7:
 * "Aktif faz dışındaki modüller için route iskeleti + 'yakında' durumu dışında kod yazılmaz."
 */
export async function ComingSoon({
  labelKey,
  phase,
}: {
  labelKey: string;
  phase: number;
}) {
  const t = await getTranslations();

  return (
    <div className="flex flex-col items-center p-6">
      <Card>
        <div className="flex items-center gap-3">
          <Construction className="size-5 text-warning" aria-hidden />
          <CardTitle className="mb-0">{t(labelKey)}</CardTitle>
        </div>
        <CardBody className="mt-3">
          {t("common.comingSoonBody", { phase, current: CURRENT_PHASE })}
        </CardBody>
      </Card>
    </div>
  );
}
