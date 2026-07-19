"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import {
  Bell,
  ExternalLink,
  Gift,
  Layers,
  Loader2,
  Mail,
  MessageSquare,
  Radio,
  Search,
  Trophy,
  Volume2,
  Zap,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, type ComponentType } from "react";
import { useForm } from "react-hook-form";
import { LiveKitMark } from "@/components/brand/livekit-mark";
import { useRouter } from "@/lib/i18n/navigation";
import { signInSchema, type SignInInput } from "@/lib/schemas/auth";
import { createClient } from "@/lib/supabase/client";
import { APP_NAME, cn } from "@/lib/utils";

type Mode = "signin" | "signup";

/** Supabase hata metnini i18n anahtarına eşler. */
function mapAuthError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("invalid login credentials")) return "auth.errors.invalidCredentials";
  if (m.includes("email not confirmed")) return "auth.errors.emailNotConfirmed";
  if (m.includes("already registered") || m.includes("already been registered"))
    return "auth.errors.userExists";
  if (m.includes("rate limit") || m.includes("too many")) return "auth.errors.rateLimited";
  return "auth.errors.generic";
}

const NEXT_PATH = "/start";

/**
 * LiveKit giriş ekranı — tek sayfa, TikTok marka renkleri.
 *
 * Arka plan: loş/bulanık dashboard önizlemesi (homepage tanıtımı).
 * Ön plan: Google öncelikli cam login kartı. En altta tek fikoai.de linki.
 * Tümü mobil + tablet uyumlu.
 */
export function LiveKitLogin({ initialError }: { initialError?: string }) {
  const t = useTranslations();
  const router = useRouter();
  const supabase = createClient();

  const [mode, setMode] = useState<Mode>("signin");
  const [showEmail, setShowEmail] = useState(false);
  const [pending, setPending] = useState(false);
  const [googlePending, setGooglePending] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [formError, setFormError] = useState<string | null>(
    initialError ? "auth.errors.callback" : null,
  );

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<SignInInput>({
    resolver: zodResolver(signInSchema),
    defaultValues: { email: "", password: "" },
  });

  async function onGoogle() {
    setFormError(null);
    setGooglePending(true);
    const redirectTo = `${window.location.origin}/auth/callback?next=${NEXT_PATH}`;
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo },
    });
    if (error) {
      setFormError(mapAuthError(error.message));
      setGooglePending(false);
    }
  }

  async function onSubmit(values: SignInInput) {
    setFormError(null);
    setPending(true);
    try {
      if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword(values);
        if (error) {
          setFormError(mapAuthError(error.message));
          return;
        }
        router.refresh();
        router.replace(NEXT_PATH);
      } else {
        const emailRedirectTo = `${window.location.origin}/auth/callback?next=${NEXT_PATH}`;
        const { data, error } = await supabase.auth.signUp({
          email: values.email,
          password: values.password,
          options: { emailRedirectTo },
        });
        if (error) {
          setFormError(mapAuthError(error.message));
          return;
        }
        if (!data.session) {
          setEmailSent(true);
          return;
        }
        router.refresh();
        router.replace(NEXT_PATH);
      }
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="relative flex min-h-[100dvh] flex-col">
      {/* Arka plan: dashboard önizlemesi (homepage tanıtımı) */}
      <HomepagePreview />
      {/* Loşlaştırma + vinyet — kart okunabilirliği */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 z-[1]"
        style={{
          background:
            "radial-gradient(120% 90% at 50% 40%, transparent 0%, rgba(8,8,10,0.55) 55%, rgba(8,8,10,0.9) 100%)",
        }}
      />

      {/* Login kartı */}
      <main className="relative z-10 flex flex-1 items-center justify-center px-4 py-8 sm:px-6">
        <div className="tt-rise w-full max-w-md">
          <div className="relative overflow-hidden rounded-3xl border border-[var(--tt-border)] bg-[var(--tt-panel)] p-6 shadow-[var(--tt-shadow)] backdrop-blur-2xl sm:p-8">
            {/* Üst degrade hairline (cyan → kırmızı) */}
            <div
              aria-hidden
              className="absolute inset-x-0 top-0 h-px"
              style={{
                background:
                  "linear-gradient(90deg, transparent, var(--tt-cyan), var(--tt-red), transparent)",
              }}
            />

            {emailSent ? (
              <EmailSentView onBack={() => { setEmailSent(false); setMode("signin"); setShowEmail(false); }} />
            ) : (
              <>
                {/* Marka */}
                <div className="flex flex-col items-center gap-4 text-center">
                  <LiveKitMark className="size-14" />
                  <div className="flex flex-col gap-1.5">
                    <h1 className="text-2xl font-bold tracking-tight text-[var(--tt-ink)] sm:text-[1.7rem]">
                      {t("landing.login.title")}
                    </h1>
                    <p className="text-sm text-[var(--tt-muted)]">{t("landing.login.subtitle")}</p>
                  </div>
                </div>

                {/* Google — birincil */}
                <button
                  type="button"
                  onClick={onGoogle}
                  disabled={googlePending || pending}
                  className={cn(
                    "mt-7 inline-flex h-12 w-full items-center justify-center gap-3 rounded-xl px-5",
                    "bg-white text-[15px] font-semibold text-[#1f1f23]",
                    "transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_10px_28px_-8px_rgba(255,255,255,0.35)] active:translate-y-0",
                    "disabled:pointer-events-none disabled:opacity-60",
                  )}
                >
                  {googlePending ? (
                    <Loader2 className="size-5 animate-spin" aria-hidden />
                  ) : (
                    <GoogleGlyph />
                  )}
                  {t("landing.login.google")}
                </button>

                {/* E-posta — ikincil, katlanır */}
                {!showEmail ? (
                  <button
                    type="button"
                    onClick={() => setShowEmail(true)}
                    className="mt-3 inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-[var(--tt-border-strong)] bg-[var(--tt-panel-2)] text-sm font-medium text-[var(--tt-ink-soft)] transition-colors hover:bg-[var(--tt-solid-2)]"
                  >
                    <Mail className="size-4" aria-hidden />
                    {t("landing.login.emailToggle")}
                  </button>
                ) : (
                  <>
                    <div className="mt-5 flex items-center gap-3 text-xs text-[var(--tt-muted-2)]">
                      <span className="h-px flex-1 bg-[var(--tt-border)]" />
                      {t("auth.or")}
                      <span className="h-px flex-1 bg-[var(--tt-border)]" />
                    </div>

                    <form
                      onSubmit={handleSubmit(onSubmit)}
                      className="mt-5 flex flex-col gap-3.5"
                      noValidate
                    >
                      <div className="flex flex-col gap-1.5">
                        <label htmlFor="lk-email" className="text-sm font-medium text-[var(--tt-ink-soft)]">
                          {t("auth.emailLabel")}
                        </label>
                        <input
                          id="lk-email"
                          type="email"
                          autoComplete="email"
                          placeholder="ornek@eposta.com"
                          aria-invalid={!!errors.email}
                          className="h-11 w-full rounded-xl border border-[var(--tt-border-strong)] bg-[var(--tt-solid)] px-3.5 text-sm text-[var(--tt-ink)] placeholder:text-[var(--tt-muted-2)] transition-colors focus:border-[var(--tt-cyan)] focus:outline-none aria-[invalid=true]:border-[var(--tt-red)]"
                          {...register("email")}
                        />
                        {errors.email && (
                          <p role="alert" className="text-xs text-[var(--tt-red)]">
                            {t(errors.email.message as string)}
                          </p>
                        )}
                      </div>

                      <div className="flex flex-col gap-1.5">
                        <label htmlFor="lk-password" className="text-sm font-medium text-[var(--tt-ink-soft)]">
                          {t("auth.passwordLabel")}
                        </label>
                        <input
                          id="lk-password"
                          type="password"
                          autoComplete={mode === "signin" ? "current-password" : "new-password"}
                          aria-invalid={!!errors.password}
                          className="h-11 w-full rounded-xl border border-[var(--tt-border-strong)] bg-[var(--tt-solid)] px-3.5 text-sm text-[var(--tt-ink)] placeholder:text-[var(--tt-muted-2)] transition-colors focus:border-[var(--tt-cyan)] focus:outline-none aria-[invalid=true]:border-[var(--tt-red)]"
                          {...register("password")}
                        />
                        {mode === "signup" && !errors.password && (
                          <p className="text-xs text-[var(--tt-muted-2)]">{t("auth.passwordHint")}</p>
                        )}
                        {errors.password && (
                          <p role="alert" className="text-xs text-[var(--tt-red)]">
                            {t(errors.password.message as string)}
                          </p>
                        )}
                      </div>

                      <button
                        type="submit"
                        disabled={pending || googlePending}
                        className="mt-1 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[var(--tt-red)] text-sm font-semibold text-white transition-colors hover:bg-[var(--tt-red-hover)] disabled:pointer-events-none disabled:opacity-60"
                      >
                        {pending && <Loader2 className="size-4 animate-spin" aria-hidden />}
                        {pending
                          ? t("auth.submitting")
                          : mode === "signin"
                            ? t("auth.signInSubmit")
                            : t("auth.signUpSubmit")}
                      </button>
                    </form>

                    <p className="mt-4 text-center text-sm text-[var(--tt-muted)]">
                      {mode === "signin" ? t("auth.noAccount") : t("auth.haveAccount")}{" "}
                      <button
                        type="button"
                        className="font-semibold text-[var(--tt-cyan)] hover:underline"
                        onClick={() => {
                          setMode((p) => (p === "signin" ? "signup" : "signin"));
                          setFormError(null);
                        }}
                      >
                        {mode === "signin" ? t("auth.switchToSignUp") : t("auth.switchToSignIn")}
                      </button>
                    </p>
                  </>
                )}

                {formError && (
                  <p
                    role="alert"
                    className="mt-4 rounded-lg border border-[var(--tt-red)]/40 bg-[var(--tt-red)]/12 px-3 py-2 text-center text-sm text-[var(--tt-red)]"
                  >
                    {t(formError)}
                  </p>
                )}

                <p className="mt-5 text-center text-xs leading-relaxed text-[var(--tt-muted-2)]">
                  {t("auth.legalNote", { tos: t("auth.tos"), privacy: t("auth.privacy") })}
                </p>
              </>
            )}
          </div>
        </div>
      </main>

      {/* Sayfa altı — TEK fikoai.de referansı (link) */}
      <footer className="relative z-10 pb-6 pt-2 text-center sm:pb-8">
        <p className="text-xs text-[var(--tt-muted-2)] sm:text-sm">
          {t.rich("landing.footer.product", {
            link: (chunks) => (
              <a
                href="https://fikoai.de"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 font-semibold text-[var(--tt-ink-soft)] underline-offset-4 transition-colors hover:text-[var(--tt-cyan)] hover:underline"
              >
                {chunks}
                <ExternalLink className="size-3" aria-hidden />
              </a>
            ),
          })}
        </p>
      </footer>
    </div>
  );

  // ---------------------------------------------------------------------------

  function EmailSentView({ onBack }: { onBack: () => void }) {
    return (
      <div className="flex flex-col items-center gap-4 py-2 text-center">
        <div className="flex size-14 items-center justify-center rounded-full bg-[var(--tt-cyan)]/15 text-[var(--tt-cyan)]">
          <Mail className="size-7" aria-hidden />
        </div>
        <h1 className="text-xl font-bold text-[var(--tt-ink)]">{t("auth.checkEmailTitle")}</h1>
        <p className="max-w-sm text-sm text-[var(--tt-muted)]">{t("auth.checkEmailBody")}</p>
        <button
          type="button"
          onClick={onBack}
          className="text-sm font-semibold text-[var(--tt-cyan)] hover:underline"
        >
          {t("auth.backToSignIn")}
        </button>
      </div>
    );
  }

  /** Arka plan dashboard önizlemesi — dekoratif, bulanık, aria-hidden. Responsive. */
  function HomepagePreview() {
    const rail: { icon: ComponentType<{ className?: string }>; tone: "cyan" | "red" | "white" }[] = [
      { icon: Radio, tone: "red" },
      { icon: Layers, tone: "cyan" },
      { icon: Zap, tone: "white" },
      { icon: Volume2, tone: "cyan" },
      { icon: MessageSquare, tone: "white" },
      { icon: Trophy, tone: "red" },
      { icon: Gift, tone: "cyan" },
    ];
    const toneColor = (tone: "cyan" | "red" | "white") =>
      tone === "cyan" ? "var(--tt-cyan)" : tone === "red" ? "var(--tt-red)" : "#ffffff";

    return (
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 z-0 origin-center scale-[1.06] blur-[3px] sm:blur-[2px]"
      >
        <div className="flex h-full w-full">
          {/* İkon rayı */}
          <div className="hidden w-[56px] shrink-0 flex-col items-center gap-3 border-r border-[var(--tt-border)] bg-black/40 py-4 sm:flex">
            <div className="mb-2 size-8 rounded-xl bg-gradient-to-br from-[var(--tt-cyan)] to-[var(--tt-red)]" />
            {rail.map(({ icon: Icon, tone }, i) => (
              <div
                key={i}
                className="flex size-9 items-center justify-center rounded-xl"
                style={{ backgroundColor: "rgba(255,255,255,0.05)", color: toneColor(tone) }}
              >
                <Icon className="size-4" />
              </div>
            ))}
          </div>

          {/* Ana içerik */}
          <div className="flex min-w-0 flex-1 flex-col">
            {/* Topbar */}
            <div className="flex h-[52px] shrink-0 items-center justify-between border-b border-[var(--tt-border)] bg-black/35 px-4 sm:px-6">
              <div className="flex items-center gap-2">
                <span className="text-base font-bold tracking-tight text-white">{APP_NAME}</span>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--tt-red)] px-2 py-0.5 text-[10px] font-bold uppercase text-white">
                  <span className="size-1.5 rounded-full bg-white" />
                  {t("landing.preview.live")}
                </span>
              </div>
              <div className="flex items-center gap-3 text-[var(--tt-muted)]">
                <Search className="size-4" />
                <Bell className="size-4" />
                <span className="size-7 rounded-full bg-gradient-to-br from-[var(--tt-cyan)] to-[var(--tt-red)]" />
              </div>
            </div>

            {/* İçerik grid */}
            <div className="grid flex-1 gap-4 p-4 sm:grid-cols-5 sm:gap-5 sm:p-6 lg:p-8">
              {/* Bağlan kartı */}
              <div className="flex flex-col justify-center gap-3 rounded-2xl border border-[var(--tt-border)] bg-white/[0.03] p-5 sm:col-span-3">
                <span className="text-lg font-bold text-white sm:text-2xl">
                  {t("landing.preview.connectTitle")}
                </span>
                <p className="max-w-md text-xs text-[var(--tt-muted)] sm:text-sm">
                  {t("landing.preview.connectDesc")}
                </p>
                <div className="mt-1 flex items-center gap-2">
                  <div className="h-10 flex-1 rounded-lg border border-[var(--tt-border)] bg-black/40" />
                  <div className="flex h-10 items-center rounded-lg bg-[var(--tt-red)] px-4 text-sm font-semibold text-white">
                    {t("landing.preview.connectCta")}
                  </div>
                </div>
              </div>

              {/* Sağ kolon: alert + hedef */}
              <div className="flex flex-col gap-4 sm:col-span-2">
                {/* Alert toast */}
                <div className="flex items-center gap-3 rounded-2xl border border-[var(--tt-cyan)]/25 bg-white/[0.03] p-4">
                  <div className="flex size-10 items-center justify-center rounded-full bg-[var(--tt-cyan)]/15 text-[var(--tt-cyan)]">
                    <Trophy className="size-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-white">
                      {t("landing.preview.alertTitle")}
                    </p>
                    <p className="truncate text-xs text-[var(--tt-muted)]">
                      {t("landing.preview.alertBody")}
                    </p>
                  </div>
                </div>
                {/* Hedef çubuğu */}
                <div className="rounded-2xl border border-[var(--tt-border)] bg-white/[0.03] p-4">
                  <div className="mb-2 flex items-center justify-between text-xs">
                    <span className="font-medium text-[var(--tt-ink-soft)]">
                      {t("landing.preview.goal")}
                    </span>
                    <span className="font-bold text-[var(--tt-cyan)]">720 / 1000</span>
                  </div>
                  <div className="h-2.5 overflow-hidden rounded-full bg-white/10">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: "72%",
                        background: "linear-gradient(90deg, var(--tt-cyan), var(--tt-red))",
                      }}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }
}

/** Google "G" — beyaz zeminli küçük rozet. */
function GoogleGlyph() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden focusable="false">
      <path
        fill="#4285F4"
        d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.71-1.57 2.68-3.88 2.68-6.62Z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18Z"
      />
      <path
        fill="#FBBC05"
        d="M3.97 10.72a5.4 5.4 0 0 1 0-3.44V4.95H.96a9 9 0 0 0 0 8.1l3.01-2.33Z"
      />
      <path
        fill="#EA4335"
        d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.47.9 11.43 0 9 0A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58Z"
      />
    </svg>
  );
}
