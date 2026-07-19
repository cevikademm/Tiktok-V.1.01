"use client";

import { useTranslations } from "next-intl";
import { useCallback, useId, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { useApp } from "@/components/providers/app-provider";
import { useToast } from "@/components/ui/toast";
import type { ImportCounts, ImportPlan } from "@/lib/tfc/types";
import { ImportReport } from "./import-report";

/**
 * `.tfc` İÇE AKTARMA DİYALOĞU — ADR-0007.
 *
 * Üç adım: dosya seç → ÖNİZLE (hiçbir şey yazılmaz) → onayla.
 * Önizleme sunucudaki `?dryRun=1` yolundan gelir; onaydaki yazma AYNI kodu
 * kullandığı için kullanıcının gördüğü rapor ile yazılan veri birebir aynıdır.
 */

type Step = "pick" | "preview" | "done";

interface PreviewResponse {
  counts: ImportCounts;
  plan: ImportPlan;
  container: string;
  persisted?: boolean;
  importId?: string;
  reason?: string;
}

const ACCEPT = ".tfc,.json,application/json,application/octet-stream";

export function ImportDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const t = useTranslations();
  const toast = useToast();
  const { backend, refresh } = useApp();
  const labelInputId = useId();

  const [step, setStep] = useState<Step>("pick");
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [label, setLabel] = useState("");
  const [preview, setPreview] = useState<PreviewResponse | null>(null);
  const [result, setResult] = useState<PreviewResponse | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const reset = useCallback(() => {
    setStep("pick");
    setBusy(false);
    setDragging(false);
    setFile(null);
    setLabel("");
    setPreview(null);
    setResult(null);
  }, []);

  function close() {
    reset();
    onClose();
  }

  /** Sunucudan hata kodu okur; gövde yoksa genel koda düşer. */
  async function errorCodeOf(response: Response): Promise<string> {
    try {
      const body = (await response.json()) as { error?: string };
      return body.error ?? "importFailed";
    } catch {
      return "importFailed";
    }
  }

  async function handlePreview(picked: File) {
    setFile(picked);
    setBusy(true);
    try {
      const form = new FormData();
      form.append("file", picked);

      const response = await fetch("/api/settings/import?dryRun=1", {
        method: "POST",
        body: form,
      });

      if (!response.ok) {
        toast.show(t(`setup.importExport.error.${await errorCodeOf(response)}`), "error");
        setFile(null);
        return;
      }

      const data = (await response.json()) as PreviewResponse;
      setPreview(data);
      setLabel(data.plan.label);
      setStep("preview");
    } catch {
      // Ağ hatası — dosya seçimi korunur, kullanıcı tekrar deneyebilir.
      toast.show(t("setup.importExport.error.network"), "error");
    } finally {
      setBusy(false);
    }
  }

  async function handleConfirm() {
    if (!file) return;
    setBusy(true);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("label", label.trim());

      const response = await fetch("/api/settings/import", {
        method: "POST",
        body: form,
      });

      if (!response.ok) {
        toast.show(t(`setup.importExport.error.${await errorCodeOf(response)}`), "error");
        return;
      }

      const data = (await response.json()) as PreviewResponse;

      // Yerel depo her hâlükârda güncellenir: oturum varsa Supabase'deki
      // kalıcı kopyayla senkron kalsın diye, yoksa TEK depo olduğu için.
      await backend.settings.applyImport(data.plan);
      refresh();

      setResult(data);
      setStep("done");
      toast.show(t("setup.importExport.imported"));
    } catch {
      toast.show(t("setup.importExport.error.network"), "error");
    } finally {
      setBusy(false);
    }
  }

  function onDrop(event: React.DragEvent) {
    event.preventDefault();
    setDragging(false);
    const dropped = event.dataTransfer.files?.[0];
    if (dropped) void handlePreview(dropped);
  }

  return (
    <Modal
      open={open}
      onClose={close}
      size="lg"
      title={t(`setup.importExport.step.${step}`)}
    >
      {step === "pick" && (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          className={[
            "flex flex-col items-center gap-3 rounded-xl border-2 border-dashed px-6 py-10 text-center transition-colors",
            dragging ? "border-primary bg-surface-3" : "border-surface-4",
          ].join(" ")}
        >
          <p className="text-sm text-white">{t("setup.importExport.dropHint")}</p>
          <p className="text-xs text-muted">{t("setup.importExport.dropFormats")}</p>

          <Button
            variant="secondary"
            size="sm"
            disabled={busy}
            onClick={() => fileInput.current?.click()}
          >
            {busy ? t("setup.importExport.reading") : t("setup.importExport.chooseFile")}
          </Button>

          <input
            ref={fileInput}
            type="file"
            accept={ACCEPT}
            className="sr-only"
            onChange={(e) => {
              const picked = e.target.files?.[0];
              // Aynı dosyanın ikinci kez seçilebilmesi için değer sıfırlanır.
              e.target.value = "";
              if (picked) void handlePreview(picked);
            }}
          />
        </div>
      )}

      {step === "preview" && preview && (
        <div className="flex flex-col gap-5">
          <p className="text-sm text-muted">
            {t("setup.importExport.previewHint", { file: file?.name ?? "" })}
          </p>

          <ImportReport
            counts={preview.counts}
            warnings={preview.plan.warnings}
            skipped={preview.plan.skipped}
            sourceVersion={preview.plan.sourceVersion}
            container={preview.container}
          />

          <div className="flex flex-col gap-1">
            <label htmlFor={labelInputId} className="text-xs text-muted">
              {t("setup.importExport.labelField")}
            </label>
            <input
              id={labelInputId}
              value={label}
              maxLength={120}
              onChange={(e) => setLabel(e.target.value)}
              className="rounded-lg border border-surface-4 bg-surface-2 px-3 py-2 text-sm text-white"
            />
          </div>

          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={reset} disabled={busy}>
              {t("setup.importExport.back")}
            </Button>
            <Button
              size="sm"
              onClick={handleConfirm}
              disabled={busy || preview.counts.actions + preview.counts.events === 0}
            >
              {busy
                ? t("setup.importExport.importing")
                : t("setup.importExport.confirm")}
            </Button>
          </div>
        </div>
      )}

      {step === "done" && result && (
        <div className="flex flex-col gap-4">
          <p className="text-sm text-white">
            {t("setup.importExport.doneSummary", {
              actions: result.counts.actions,
              events: result.counts.events,
            })}
          </p>

          {/* Oturum yoksa veri yalnız bu tarayıcıda durur — açıkça söylenir. */}
          {!result.persisted && (
            <p className="rounded-lg bg-surface-3 px-3 py-2 text-xs text-warning">
              {t("setup.importExport.localOnly")}
            </p>
          )}

          <div className="flex justify-end">
            <Button size="sm" onClick={close}>
              {t("setup.importExport.finish")}
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
