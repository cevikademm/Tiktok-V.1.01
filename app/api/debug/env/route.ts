/**
 * GEÇİCİ teşhis endpoint'i — Vercel'de hangi env değişkeninin RUNTIME'da görünür
 * olduğunu (yalnız var/yok + uzunluk) rapor eder. DEĞER SIZDIRMAZ. Sorun çözülünce
 * silinecek.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const names = [
    "SUPABASE_URL",
    "SUPABASE_SERVICE_ROLE_KEY",
    "EULER_STREAM_API_KEY",
    "NEXT_PUBLIC_SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  ];
  const report: Record<string, { present: boolean; length: number }> = {};
  for (const n of names) {
    const v = process.env[n];
    report[n] = { present: typeof v === "string" && v.length > 0, length: (v ?? "").length };
  }
  return Response.json(report);
}
