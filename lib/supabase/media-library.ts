"use client";

/**
 * Medya kütüphanesi — yüklenen dosyaların listelenmesi/silinmesi (migration 0006).
 *
 * Kayıtlar `media_assets` tablosunda, dosyalar `media` Storage bucket'ında tutulur.
 * RLS gereği yalnız kullanıcının kendi kayıtları görünür (oturumlu client).
 */

import { createClient } from "./client";

export type MediaKind = "audio" | "image" | "video" | "other";

export interface MediaAsset {
  id: string;
  name: string;
  mimeType: string;
  sizeBytes: number;
  storagePath: string;
  publicUrl: string;
  createdAt: string;
  kind: MediaKind;
}

/** MIME tipinden kaba tür — UI filtreleri ve önizleme için. */
export function mediaKind(mimeType: string, name = ""): MediaKind {
  const m = (mimeType || "").toLowerCase();
  if (m.startsWith("audio/")) return "audio";
  if (m.startsWith("image/")) return "image";
  if (m.startsWith("video/")) return "video";
  // MIME boşsa uzantıdan tahmin et (bazı tarayıcılar boş bırakır).
  const ext = name.toLowerCase().split(".").pop() ?? "";
  if (["mp3", "wav", "ogg", "m4a", "aac", "flac"].includes(ext)) return "audio";
  if (["png", "jpg", "jpeg", "gif", "webp", "svg", "avif"].includes(ext)) return "image";
  if (["mp4", "webm", "mov", "mkv"].includes(ext)) return "video";
  return "other";
}

interface MediaRow {
  id: string;
  name: string;
  mime_type: string | null;
  size_bytes: number | null;
  storage_path: string;
  public_url: string;
  created_at: string;
}

/** Kullanıcının yüklediği medyayı (en yeni önce) döner; `kind` ile filtrelenebilir. */
export async function listMedia(kind?: MediaKind): Promise<MediaAsset[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("media_assets")
    .select("id,name,mime_type,size_bytes,storage_path,public_url,created_at")
    .order("created_at", { ascending: false });
  if (error) throw error;

  const assets: MediaAsset[] = ((data ?? []) as MediaRow[]).map((r) => ({
    id: r.id,
    name: r.name,
    mimeType: r.mime_type ?? "",
    sizeBytes: r.size_bytes ?? 0,
    storagePath: r.storage_path,
    publicUrl: r.public_url,
    createdAt: r.created_at,
    kind: mediaKind(r.mime_type ?? "", r.name),
  }));

  return kind ? assets.filter((a) => a.kind === kind) : assets;
}

/** Dosyayı hem Storage'dan hem katalogdan siler. */
export async function deleteMedia(asset: MediaAsset): Promise<void> {
  const supabase = createClient();
  const { error: storageError } = await supabase.storage
    .from("media")
    .remove([asset.storagePath]);
  if (storageError) throw storageError;
  const { error } = await supabase.from("media_assets").delete().eq("id", asset.id);
  if (error) throw error;
}

/** İnsan-okunur dosya boyutu. */
export function formatBytes(bytes: number): string {
  if (bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  return `${(bytes / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}
