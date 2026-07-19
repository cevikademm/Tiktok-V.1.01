import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { sha256Hex, TfcDecodeError } from "@/lib/tfc/container";
import { readTfc } from "@/lib/tfc/import";
import { countPlan } from "@/lib/tfc/types";

/**
 * TikFinity `.tfc` İÇE AKTARMA UÇ NOKTASI — ADR-0007.
 *
 * İki mod:
 *   • `dryRun=1` → dosya çözülür ve haritalanır, HİÇBİR ŞEY YAZILMAZ.
 *     Kullanıcıya gösterilecek önizleme raporu döner.
 *   • Aksi hâlde → aynı plan `import_tfc()` RPC'siyle TEK TRANSACTION'da yazılır.
 *
 * Çözme/haritalama SUNUCUDA yapılır: 64 MB'lık bir sıkıştırma bombası veya
 * bozuk arşiv kullanıcının sekmesini kilitlemesin, ayrıca yazma yolu ile
 * önizleme yolu AYNI kodu kullansın (onaylanan rapor ≡ yazılan veri).
 *
 * Yetki: kullanıcı oturumu (anon key + RLS) — service-role KULLANILMAZ.
 */

/** Dosya boyutu tavanı — TikFinity ayar dosyaları birkaç yüz KB'dır. */
const MAX_FILE_BYTES = 5 * 1024 * 1024;

export async function POST(request: Request): Promise<NextResponse> {
  const dryRun = new URL(request.url).searchParams.get("dryRun") === "1";

  /* ── Dosyayı al ────────────────────────────────────────────────────────── */
  let file: File | null = null;
  let label: string | undefined;
  try {
    const form = await request.formData();
    const candidate = form.get("file");
    file = candidate instanceof File ? candidate : null;
    const rawLabel = form.get("label");
    label = typeof rawLabel === "string" && rawLabel.trim() ? rawLabel.trim() : undefined;
  } catch {
    return NextResponse.json({ error: "badRequest" }, { status: 400 });
  }

  if (!file) {
    return NextResponse.json({ error: "noFile" }, { status: 400 });
  }
  if (file.size > MAX_FILE_BYTES) {
    return NextResponse.json({ error: "tooLarge" }, { status: 413 });
  }

  const bytes = new Uint8Array(await file.arrayBuffer());

  /* ── Oturum (opsiyonel) ────────────────────────────────────────────────── */
  // Supabase yapılandırılmamışsa veya oturum yoksa yazma atlanır; istemci
  // planı alıp yerel depoya (mock store) uygular. Auth-opsiyonel duruş korunur.
  const supabase = isSupabaseConfigured() ? await createClient() : null;
  const userId = supabase
    ? (await supabase.auth.getUser()).data.user?.id ?? null
    : null;

  /* ── Çöz + haritala ────────────────────────────────────────────────────── */
  // Mevcut kütüphanedeki adlar: içe aktarılan eylemler bunlara karşı da
  // tekilleştirilir ("Kalp Yağmuru" → "Kalp Yağmuru (2)").
  let existingActionNames: string[] = [];
  if (supabase && userId) {
    const { data } = await supabase.from("actions").select("name").eq("user_id", userId);
    existingActionNames = (data ?? []).map((row: { name: string }) => row.name);
  }

  let result;
  try {
    result = await readTfc(bytes, {
      label,
      fileName: file.name,
      existingActionNames,
    });
  } catch (error) {
    if (error instanceof TfcDecodeError) {
      // `code` i18n anahtarıdır: setup.importExport.error.<code>
      return NextResponse.json({ error: error.code }, { status: 422 });
    }
    throw error;
  }

  const { container, plan } = result;
  const counts = countPlan(plan);

  /* ── Önizleme ──────────────────────────────────────────────────────────── */
  if (dryRun) {
    return NextResponse.json({
      dryRun: true,
      persisted: false,
      container: container.format,
      counts,
      plan,
    });
  }

  /* ── Yazma ─────────────────────────────────────────────────────────────── */
  if (!supabase || !userId) {
    // Oturum yok: plan istemciye döner, yerel depoya uygulanır.
    return NextResponse.json({
      dryRun: false,
      persisted: false,
      reason: "notAuthenticated",
      container: container.format,
      counts,
      plan,
    });
  }

  const { data: importId, error } = await supabase.rpc("import_tfc", {
    payload: {
      label: plan.label,
      settings: plan.settings,
      actions: plan.actions,
      events: plan.events,
      timers: plan.timers,
      screens: plan.screens,
      widgetSettings: plan.widgetSettings,
    },
    meta: {
      fileName: file.name,
      fileSize: file.size,
      container: container.format,
      sourceVersion: plan.sourceVersion,
      checksum: await sha256Hex(bytes),
      summary: {
        counts,
        warnings: plan.warnings,
        skipped: plan.skipped,
      },
    },
  });

  if (error) {
    // RPC hataları kullanıcı verisini bozmaz (tek transaction geri alınır).
    return NextResponse.json(
      { error: "persistFailed", detail: error.message },
      { status: 500 },
    );
  }

  return NextResponse.json({
    dryRun: false,
    persisted: true,
    importId,
    container: container.format,
    counts,
    plan,
  });
}

/** Toplu geri alma — `import_tfc` ile etiketlenen kayıtları siler. */
export async function DELETE(request: Request): Promise<NextResponse> {
  const importId = new URL(request.url).searchParams.get("importId");
  if (!importId) {
    return NextResponse.json({ error: "noImportId" }, { status: 400 });
  }
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "notAuthenticated" }, { status: 401 });
  }

  const supabase = await createClient();
  const userId = (await supabase.auth.getUser()).data.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "notAuthenticated" }, { status: 401 });
  }

  const { error } = await supabase.rpc("undo_tfc_import", { p_import_id: importId });
  if (error) {
    return NextResponse.json(
      { error: "undoFailed", detail: error.message },
      { status: 500 },
    );
  }

  return NextResponse.json({ reverted: true, importId });
}
