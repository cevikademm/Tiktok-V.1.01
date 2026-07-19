"use client";

import { Copy, Trash2, Upload as UploadIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import {
  deleteMedia,
  formatBytes,
  listMedia,
  type MediaAsset,
  type MediaKind,
} from "@/lib/supabase/media-library";
import { uploadActionMedia } from "@/lib/supabase/upload-media";

/**
 * Medya kütüphanesi — yüklenen ses/görsel/video dosyalarını listeler (migration 0006).
 *
 * Dosyalar Supabase Storage'da tutulur; `publicUrl` kalıcıdır ve widget/OBS
 * tarafından okunabilir (eski `blob:` URL'lerin aksine). Eylem editöründe bir
 * medya seçildiğinde de aynı yere yüklenir, yani burada görünür.
 */
export function MediaLibrary({
  kind,
  accept,
}: {
  /** Yalnız bu türü listele (verilmezse hepsi). */
  kind?: MediaKind;
  /** Dosya seçici filtresi, ör. "audio/*". */
  accept?: string;
}) {
  const t = useTranslations();
  const toast = useToast();
  const inputRef = useRef<HTMLInputElement>(null);

  const [items, setItems] = useState<MediaAsset[] | null>(null);
  const [busy, setBusy] = useState(false);

  /** Olay işleyicilerinden (yükle/sil sonrası) yeniden yükleme. */
  const refresh = useCallback(async () => {
    try {
      setItems(await listMedia(kind));
    } catch {
      setItems([]);
      toast.show(t("media.loadFailed"), "error");
    }
  }, [kind, t, toast]);

  // İlk yükleme — setState yalnız await sonrası ve iptal korumalı (React Compiler kuralı).
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const data = await listMedia(kind);
        if (!cancelled) setItems(data);
      } catch {
        if (!cancelled) setItems([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [kind]);

  async function handleFile(file: File) {
    setBusy(true);
    try {
      await uploadActionMedia(file);
      await refresh();
      toast.show(t("media.uploaded"), "success");
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.show(
        msg === "notSignedIn" ? t("media.signInRequired") : t("media.uploadFailed"),
        "error",
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(asset: MediaAsset) {
    setBusy(true);
    try {
      await deleteMedia(asset);
      await refresh();
      toast.show(t("media.deleted"), "success");
    } catch {
      toast.show(t("media.deleteFailed"), "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      {/* Araç çubuğu */}
      <div className="flex items-center gap-2">
        <Button size="sm" disabled={busy} onClick={() => inputRef.current?.click()}>
          <UploadIcon className="size-3.5" aria-hidden />
          {busy ? t("media.uploading") : t("media.upload")}
        </Button>
        <span className="text-xs text-muted-2">
          {items ? t("media.count", { count: items.length }) : ""}
        </span>
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (file) void handleFile(file);
          }}
        />
      </div>

      {/* Liste */}
      <div className="mt-4 overflow-hidden rounded-lg border border-border-subtle">
        {items === null ? (
          <p className="px-4 py-8 text-center text-sm text-muted">{t("common.loading")}</p>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
            <UploadIcon className="size-8 text-muted/40" aria-hidden />
            <p className="text-muted">{t("media.empty")}</p>
            <p className="text-xs text-muted-2">{t("media.emptyHint")}</p>
          </div>
        ) : (
          <ul className="divide-y divide-border-subtle">
            {items.map((a) => (
              <li key={a.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                {/* Önizleme */}
                {a.kind === "audio" ? (
                  <audio src={a.publicUrl} controls preload="none" className="h-8 max-w-[240px]" />
                ) : a.kind === "image" ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={a.publicUrl}
                    alt={a.name}
                    className="size-10 rounded object-cover"
                  />
                ) : a.kind === "video" ? (
                  <video src={a.publicUrl} className="h-10 rounded" muted />
                ) : null}

                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-white">{a.name}</p>
                  <p className="text-xs text-muted-2">
                    {formatBytes(a.sizeBytes)} · {new Date(a.createdAt).toLocaleString()}
                  </p>
                </div>

                <Button
                  variant="ghost"
                  size="sm"
                  title={t("media.copyUrl")}
                  onClick={() => {
                    void navigator.clipboard.writeText(a.publicUrl);
                    toast.show(t("common.copied"));
                  }}
                >
                  <Copy className="size-3.5" aria-hidden />
                </Button>
                <Button
                  variant="danger"
                  size="sm"
                  disabled={busy}
                  title={t("media.delete")}
                  onClick={() => void handleDelete(a)}
                >
                  <Trash2 className="size-3.5" aria-hidden />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
