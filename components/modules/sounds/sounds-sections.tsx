import {
  AlertTriangle,
  Download,
  Keyboard,
  Plus,
  Trash2,
  Upload,
  Volume2,
} from "lucide-react";
import { getTranslations } from "next-intl/server";
import { MediaLibrary } from "@/components/modules/media/media-library";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardTitle } from "@/components/ui/card";

/**
 * Sesli Uyarılar bölümleri — PRD §5: sounds modülü.
 * Server Component'ler (CLAUDE.md §5.1).
 */

/* Açıklama ve özellik bilgileri. */
export async function SoundsHeader() {
  const t = await getTranslations();
  return (
    <Card id="section-sounds">
      <CardTitle>{t("sounds.title")}</CardTitle>
      <CardBody>
        <p>{t("sounds.description")}</p>
        <p className="mt-2">{t("sounds.descriptionObs")}</p>
        <p className="mt-2">{t("sounds.descriptionMultiple")}</p>
        <p className="mt-1 font-medium text-white">
          {t("sounds.descriptionKeyboard")}
        </p>
      </CardBody>
    </Card>
  );
}

/* Uyarı şeridi — bağlantı yok ise gösterilir. */
export async function SoundsSetupWarning() {
  const t = await getTranslations();
  return (
    <div className="flex w-full max-w-[var(--card-w)] items-center gap-3 rounded-[var(--card-radius)] border border-error/40 bg-error/10 px-4 py-3">
      <AlertTriangle className="size-4 shrink-0 text-error" aria-hidden />
      <p className="flex-1 text-sm text-error">{t("sounds.setupWarning")}</p>
    </div>
  );
}

/* Ana ses uyarıları grid'i — toolbar + boş durum + liste. */
export async function SoundsGrid() {
  const t = await getTranslations();

  return (
    <Card>
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm">
          <Plus className="size-3.5" aria-hidden />
          {t("sounds.createSound")}
        </Button>
        <Button variant="secondary" size="sm">
          <Upload className="size-3.5" aria-hidden />
          {t("sounds.importSound")}
        </Button>
        <Button variant="secondary" size="sm">
          <Download className="size-3.5" aria-hidden />
          {t("sounds.exportSound")}
        </Button>
        <div className="flex-1" />
        <Button variant="danger" size="sm">
          <Trash2 className="size-3.5" aria-hidden />
          {t("sounds.deleteAll")}
        </Button>
      </div>

      {/* Tablo başlıkları */}
      <div className="mt-4 overflow-hidden rounded-lg border border-border-subtle">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <caption className="sr-only">{t("sounds.title")}</caption>
            <thead className="bg-surface-2 text-xs text-muted uppercase">
              <tr>
                <th scope="col" className="px-4 py-2.5 font-medium">{t("sounds.table.enabled")}</th>
                <th scope="col" className="px-4 py-2.5 font-medium">{t("sounds.table.name")}</th>
                <th scope="col" className="px-4 py-2.5 font-medium">{t("sounds.table.trigger")}</th>
                <th scope="col" className="px-4 py-2.5 font-medium">{t("sounds.table.sound")}</th>
                <th scope="col" className="px-4 py-2.5 font-medium">{t("sounds.table.volume")}</th>
                <th scope="col" className="px-4 py-2.5 font-medium">{t("sounds.table.cooldown")}</th>
                <th scope="col" className="px-4 py-2.5 font-medium">{t("sounds.table.keyboard")}</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center">
                  <div className="flex flex-col items-center gap-3">
                    <Volume2 className="size-10 text-muted/40" aria-hidden />
                    <p className="text-muted">{t("sounds.noSounds")}</p>
                    <p className="text-xs text-muted-2">{t("sounds.noSoundsHint")}</p>
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

/* Yüklenen medya kütüphanesi — Supabase Storage (migration 0006).
   Eylem editöründen veya buradan yüklenen dosyalar burada listelenir. */
export async function SoundsLibrary() {
  const t = await getTranslations();
  return (
    <Card id="section-library">
      <CardTitle>{t("sounds.sections.library")}</CardTitle>
      <CardBody className="mb-3">{t("sounds.libraryHint")}</CardBody>
      <MediaLibrary kind="audio" accept="audio/*" />
    </Card>
  );
}

/* Sesler ayarları bölümü. */
export async function SoundsSettings() {
  const t = await getTranslations();

  const triggers = [
    "gift", "follow", "subscribe", "share", "join", "like", "command", "keyboard",
  ] as const;

  return (
    <Card id="section-settings">
      <CardTitle as="h3">{t("sounds.sections.settings")}</CardTitle>
      <CardBody>
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {triggers.map((key) => (
            <div
              key={key}
              className="flex items-center gap-2 rounded-lg border border-border-subtle bg-surface-2 px-3 py-2"
            >
              {key === "keyboard" ? (
                <Keyboard className="size-4 text-primary" aria-hidden />
              ) : (
                <Volume2 className="size-4 text-primary" aria-hidden />
              )}
              <span className="text-xs text-white">{t(`sounds.triggers.${key}`)}</span>
            </div>
          ))}
        </div>
      </CardBody>
    </Card>
  );
}
