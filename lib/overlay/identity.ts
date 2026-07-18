/**
 * Overlay kimliği — ADR-0002.
 *
 * Auth henüz yok; her tarayıcı (yayıncı) için benzersiz, tahmin-edilemez bir
 * `overlayId` (UUID) üretilir ve localStorage'da saklanır. Bu id overlay URL'inde
 * (`/widget/myactions?id=<uuid>`) taşınır ve config sync'inde sunucu kaydını anahtarlar.
 *
 * Faz 2 (Supabase + auth): `overlayId` sunucu-sahipli/imzalı token olur (PRD §13).
 */

const STORAGE_KEY = "livekit.overlayId.v1";

export function getOverlayId(): string {
  if (typeof window === "undefined") return "";
  try {
    let id = window.localStorage.getItem(STORAGE_KEY);
    if (!id) {
      id = crypto.randomUUID();
      window.localStorage.setItem(STORAGE_KEY, id);
    }
    return id;
  } catch {
    // localStorage erişilemezse (gizli mod vb.) oturumluk id üret.
    return crypto.randomUUID();
  }
}
