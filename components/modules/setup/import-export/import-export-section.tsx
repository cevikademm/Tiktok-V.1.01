"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { useApp } from "@/components/providers/app-provider";
import { useToast } from "@/components/ui/toast";
import { exportTfcFile } from "@/lib/tfc/export";
import { ImportDialog } from "./import-dialog";

/**
 * "Ayarları İçe / Dışa Aktar" bölümü — ADR-0007.
 *
 * İçe aktarma: gerçek TikFinity'nin `.tfc` dosyası (ve kendi `.json`'umuz).
 * Dışa aktarma: `.tfc` (gzip — TikFinity uyumlu alan adlandırması) ve okunabilir
 * `.json` yedeği. İkisi de aynı yükü taşır, yalnız kapsayıcı farklıdır.
 */
export function ImportExportSection() {
  const t = useTranslations();
  const { backend, refresh, actions, events, timers } = useApp();
  const toast = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  async function handleExport(kind: "tfc" | "json") {
    setBusy(true);
    try {
      const [settings, screens] = await Promise.all([
        backend.settings.get(),
        backend.screens.list(),
      ]);

      const file = await exportTfcFile(
        {
          label: t("setup.importExport.defaultExportName"),
          exportedAt: new Date().toISOString(),
          settings,
          actions,
          events,
          timers,
          screens,
          // Widget ayarları tembel yüklenir; dışa aktarmada kayıtlı olanlar yeter.
          widgetSettings: {},
        },
        kind,
      );

      // Blob URL kısa ömürlüdür; indirme tetiklenir tetiklenmez serbest bırakılır.
      const blob = new Blob([file.bytes as unknown as BlobPart], {
        type: file.mimeType,
      });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = file.filename;
      anchor.click();
      URL.revokeObjectURL(url);

      toast.show(t("setup.importExport.exported"));
    } catch {
      toast.show(t("setup.importExport.error.exportFailed"), "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card id="section-importExport">
      <CardTitle>{t("setup.sections.importExport")}</CardTitle>

      <p className="mt-2 text-sm text-muted">{t("setup.importExport.description")}</p>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Button size="sm" onClick={() => setDialogOpen(true)}>
          {t("setup.importExport.import")}
        </Button>

        <Button
          variant="secondary"
          size="sm"
          disabled={busy}
          onClick={() => void handleExport("tfc")}
        >
          {t("setup.importExport.exportTfc")}
        </Button>

        <Button
          variant="outline"
          size="sm"
          disabled={busy}
          onClick={() => void handleExport("json")}
        >
          {t("setup.importExport.exportJson")}
        </Button>

        <Button
          variant="ghost"
          size="sm"
          disabled={busy}
          onClick={async () => {
            await backend.settings.reset();
            refresh();
            toast.show(t("setup.saved"));
          }}
        >
          {t("setup.importExport.reset")}
        </Button>
      </div>

      <ImportDialog open={dialogOpen} onClose={() => setDialogOpen(false)} />
    </Card>
  );
}
