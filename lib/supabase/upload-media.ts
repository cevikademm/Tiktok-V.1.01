"use client";

/**
 * Eylem medyası yükleyici — Supabase Storage (`media` bucket'ı).
 *
 * NEDEN: Daha önce dosya `URL.createObjectURL()` ile `blob:` URL'e çevriliyordu.
 * O URL YALNIZ onu üreten sekmede geçerlidir; widget ayrı bir sekme/süreçte
 * (OBS'te ayrı bir tarayıcı) çalıştığı için medyayı yükleyemiyordu → ses/görsel
 * hiç oynamıyordu. Artık dosya Storage'a yüklenir ve KALICI public URL saklanır;
 * bu URL'i widget, OBS ve başka cihazlar da açabilir (migration 0006).
 *
 * Dosya yolu: `<kullanıcı-uuid>/<zaman>-<rastgele>.<uzantı>` — Storage RLS
 * yalnız kendi klasörüne yazmaya izin verir.
 */

import { isSupabaseConfigured } from "@/lib/overlay/realtime";
import { createClient } from "./client";

export interface UploadedMedia {
  mediaName: string;
  mediaUrl: string;
}

/** Çakışmayan, güvenli bir depolama dosya adı üretir. */
function safeFileName(original: string): string {
  const dot = original.lastIndexOf(".");
  const ext = dot > 0 ? original.slice(dot + 1).toLowerCase().replace(/[^a-z0-9]/g, "") : "";
  const stamp = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 8);
  return ext ? `${stamp}-${rand}.${ext}` : `${stamp}-${rand}`;
}

/**
 * Dosyayı yükler ve eylem config'ine yazılacak `{ mediaName, mediaUrl }` döner.
 * Supabase yapılandırılmamışsa (saf yerel mock geliştirme) eski object-URL
 * davranışına düşer — o durumda medya yalnız aynı sekmede çalışır.
 */
export async function uploadActionMedia(file: File): Promise<UploadedMedia> {
  if (!isSupabaseConfigured()) {
    return { mediaName: file.name, mediaUrl: URL.createObjectURL(file) };
  }

  const supabase = createClient();
  const { data: userData } = await supabase.auth.getUser();
  const uid = userData.user?.id;
  if (!uid) throw new Error("notSignedIn");

  const path = `${uid}/${safeFileName(file.name)}`;

  const { error: uploadError } = await supabase.storage
    .from("media")
    .upload(path, file, {
      cacheControl: "31536000",
      upsert: false,
      contentType: file.type || undefined,
    });
  if (uploadError) throw uploadError;

  const {
    data: { publicUrl },
  } = supabase.storage.from("media").getPublicUrl(path);

  // Katalog kaydı — best-effort; başarısızlığı yüklemeyi geçersiz kılmaz.
  const { error: catalogError } = await supabase.from("media_assets").insert({
    user_id: uid,
    name: file.name,
    mime_type: file.type ?? "",
    size_bytes: file.size,
    storage_path: path,
    public_url: publicUrl,
  });
  if (catalogError) {
    console.warn("[upload-media] katalog kaydı yazılamadı:", catalogError.message);
  }

  return { mediaName: file.name, mediaUrl: publicUrl };
}
