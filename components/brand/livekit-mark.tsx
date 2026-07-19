import { cn } from "@/lib/utils";

/**
 * LiveKit marka simgesi — özgün neon (TikTok cyan/kırmızı chromatic kayması).
 * Hiçbir üçüncü taraf logosunun kopyası değildir. `.tt-surface` altında,
 * `--tt-*` token'larıyla renklenir; `size-*` ile ölçeklenir.
 */
export function LiveKitMark({ className }: { className?: string }) {
  return (
    <span className={cn("relative inline-flex items-center justify-center", className)}>
      {/* Kırmızı ve cyan ofset katmanları — chromatic neon */}
      <span
        aria-hidden
        className="absolute inset-0 translate-x-[1.5px] translate-y-[1px] rounded-2xl"
        style={{ background: "var(--tt-red)", opacity: 0.9, filter: "blur(0.5px)" }}
      />
      <span
        aria-hidden
        className="absolute inset-0 -translate-x-[1.5px] -translate-y-[1px] rounded-2xl"
        style={{ background: "var(--tt-cyan)", opacity: 0.9, filter: "blur(0.5px)" }}
      />
      <span className="relative flex size-full items-center justify-center rounded-2xl bg-[#0c0c0f]">
        <svg viewBox="0 0 24 24" className="size-1/2" fill="none" aria-hidden>
          {/* Özgün "canlı dalga" glifi */}
          <path
            d="M4 12h2.2l1.6-5 2.4 12 2.6-9 1.6 4H20"
            stroke="url(#lk-g)"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <defs>
            <linearGradient id="lk-g" x1="4" y1="6" x2="20" y2="18" gradientUnits="userSpaceOnUse">
              <stop offset="0" stopColor="#25f4ee" />
              <stop offset="1" stopColor="#fe2c55" />
            </linearGradient>
          </defs>
        </svg>
      </span>
    </span>
  );
}
