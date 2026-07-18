/**
 * Hata Bildirimleri yedeği — /api/error-reports (ADR-0004)
 *
 * "Hata Bildir" kayıtları yerelde mock store'da (localStorage) tutulur; bu route
 * onları Supabase `error_reports` tablosuna SÜREKLİ yedekler. Tarayıcı yalnız anon
 * key'e sahip (RLS yazmayı engeller), bu yüzden yazma SUNUCUDA service-role ile yapılır.
 *
 *   POST   { reports: ErrorReport[] }  → bulk upsert (onConflict id)
 *   GET                                → { configured, ids: string[] }  (yedekteki id'ler)
 *   DELETE ?id=<id>                    → satırı sil (yerel silme yedeğe yansısın)
 *
 * Supabase yapılandırılmamışsa (env yok) hepsi zararsız no-op döner (transport:"none").
 */

import { z } from "zod";
import { getAdminSupabase } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const ERROR_REPORTS_TABLE = "error_reports";

const reportSchema = z.object({
  id: z.string().min(1),
  reporterName: z.string().default("Admin"),
  severity: z.enum(["low", "normal", "high"]).default("normal"),
  status: z.enum(["new", "in_progress", "resolved"]).default("new"),
  description: z.string().default(""),
  pageUrl: z.string().nullable().default(null),
  pagePath: z.string().nullable().default(null),
  userAgent: z.string().nullable().default(null),
  screenSize: z.string().nullable().default(null),
  appVersion: z.string().nullable().default(null),
  screenshotData: z.string().nullable().default(null),
  createdAt: z.string(),
  resolvedAt: z.string().nullable().default(null),
});
type ReportInput = z.infer<typeof reportSchema>;

const bodySchema = z.object({
  reports: z.array(reportSchema).min(1).max(200),
});

/** ErrorReport (camelCase) → error_reports satırı (snake_case). */
function toRow(r: ReportInput) {
  return {
    id: r.id,
    reporter_name: r.reporterName,
    severity: r.severity,
    status: r.status,
    description: r.description,
    page_url: r.pageUrl,
    page_path: r.pagePath,
    user_agent: r.userAgent,
    screen_size: r.screenSize,
    app_version: r.appVersion,
    screenshot_data: r.screenshotData,
    created_at: r.createdAt,
    resolved_at: r.resolvedAt,
    backed_up_at: new Date().toISOString(),
  };
}

export async function POST(request: Request) {
  const supabase = getAdminSupabase();
  if (!supabase) return Response.json({ ok: true, transport: "none" });

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return Response.json({ error: "Geçersiz JSON gövdesi" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) {
    return Response.json(
      { error: "validation", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const rows = parsed.data.reports.map(toRow);
  const { error } = await supabase
    .from(ERROR_REPORTS_TABLE)
    .upsert(rows, { onConflict: "id" });

  if (error) {
    return Response.json(
      { error: "supabase", message: error.message },
      { status: 500 },
    );
  }
  return Response.json({ ok: true, transport: "supabase", count: rows.length });
}

export async function GET() {
  const supabase = getAdminSupabase();
  if (!supabase) return Response.json({ configured: false, ids: [] });

  const { data, error } = await supabase.from(ERROR_REPORTS_TABLE).select("id");
  if (error) {
    return Response.json(
      { error: "supabase", message: error.message },
      { status: 500 },
    );
  }
  return Response.json({
    configured: true,
    ids: (data ?? []).map((d) => d.id as string),
  });
}

export async function DELETE(request: Request) {
  const supabase = getAdminSupabase();
  if (!supabase) return Response.json({ ok: true, transport: "none" });

  const id = new URL(request.url).searchParams.get("id")?.trim();
  if (!id) {
    return Response.json({ error: "id parametresi gereklidir" }, { status: 400 });
  }

  const { error } = await supabase.from(ERROR_REPORTS_TABLE).delete().eq("id", id);
  if (error) {
    return Response.json(
      { error: "supabase", message: error.message },
      { status: 500 },
    );
  }
  return Response.json({ ok: true, transport: "supabase" });
}
