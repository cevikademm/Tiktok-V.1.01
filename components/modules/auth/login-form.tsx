"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Mail } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { useRouter } from "@/lib/i18n/navigation";
import { signInSchema, type SignInInput } from "@/lib/schemas/auth";
import { createClient } from "@/lib/supabase/client";
import { APP_NAME, cn } from "@/lib/utils";

type Mode = "signin" | "signup";

/** Supabase hata metnini i18n anahtarına eşler (kullanıcıya dostça mesaj). */
function mapAuthError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("invalid login credentials")) return "auth.errors.invalidCredentials";
  if (m.includes("email not confirmed")) return "auth.errors.emailNotConfirmed";
  if (m.includes("already registered") || m.includes("already been registered"))
    return "auth.errors.userExists";
  if (m.includes("rate limit") || m.includes("too many"))
    return "auth.errors.rateLimited";
  return "auth.errors.generic";
}

/** Site-içi geri dönüş yolu (open-redirect'e karşı callback route'da da süzülür). */
const NEXT_PATH = "/start";

export function LoginForm({ initialError }: { initialError?: string }) {
  const t = useTranslations();
  const router = useRouter();
  const supabase = createClient();

  const [mode, setMode] = useState<Mode>("signin");
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
        // Çerezler yazıldı — sunucu bileşenlerini tazele ve panele geç.
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
        // E-posta onayı AÇIKSA oturum gelmez → "postanı kontrol et" durumu.
        if (!data.session) {
          setEmailSent(true);
          return;
        }
        // Onay KAPALIYSA oturum hemen kurulur.
        router.refresh();
        router.replace(NEXT_PATH);
      }
    } finally {
      setPending(false);
    }
  }

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
    // Başarılıysa tarayıcı Google'a yönlenir — pending'i sıfırlamaya gerek yok.
  }

  // "E-postanı kontrol et" durumu — onaylı kayıt sonrası.
  if (emailSent) {
    return (
      <div className="flex flex-col items-center gap-4 text-center">
        <div className="flex size-14 items-center justify-center rounded-full bg-primary/15 text-primary">
          <Mail className="size-7" aria-hidden />
        </div>
        <h1 className="text-xl font-semibold text-heading">
          {t("auth.checkEmailTitle")}
        </h1>
        <p className="max-w-sm text-sm text-muted">{t("auth.checkEmailBody")}</p>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            setEmailSent(false);
            setMode("signin");
          }}
        >
          {t("auth.backToSignIn")}
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1 text-center">
        <h1 className="text-2xl font-semibold text-heading">
          {mode === "signin"
            ? t("auth.signInTitle", { app: APP_NAME })
            : t("auth.signUpTitle", { app: APP_NAME })}
        </h1>
        <p className="text-sm text-muted">{t("auth.gateTitle")}</p>
      </div>

      {/* Google ile giriş */}
      <Button
        type="button"
        variant="outline"
        size="lg"
        className="w-full"
        onClick={onGoogle}
        disabled={googlePending || pending}
      >
        <GoogleIcon />
        {t("auth.signInGoogle")}
      </Button>

      <div className="flex items-center gap-3 text-xs text-muted">
        <span className="h-px flex-1 bg-border-soft" />
        {t("auth.or")}
        <span className="h-px flex-1 bg-border-soft" />
      </div>

      {/* E-posta + parola */}
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
        <Field
          label={t("auth.emailLabel")}
          htmlFor="auth-email"
          error={errors.email ? t(errors.email.message as string) : undefined}
        >
          <Input
            id="auth-email"
            type="email"
            autoComplete="email"
            placeholder="ornek@eposta.com"
            aria-invalid={!!errors.email}
            {...register("email")}
          />
        </Field>

        <Field
          label={t("auth.passwordLabel")}
          htmlFor="auth-password"
          hint={mode === "signup" ? t("auth.passwordHint") : undefined}
          error={errors.password ? t(errors.password.message as string) : undefined}
        >
          <Input
            id="auth-password"
            type="password"
            autoComplete={mode === "signin" ? "current-password" : "new-password"}
            aria-invalid={!!errors.password}
            {...register("password")}
          />
        </Field>

        {formError && (
          <p role="alert" className="text-sm text-error">
            {t(formError)}
          </p>
        )}

        <Button
          type="submit"
          variant="primary"
          size="lg"
          className="w-full"
          disabled={pending || googlePending}
        >
          {pending
            ? t("auth.submitting")
            : mode === "signin"
              ? t("auth.signInSubmit")
              : t("auth.signUpSubmit")}
        </Button>
      </form>

      {/* Mod değiştir */}
      <p className="text-center text-sm text-muted">
        {mode === "signin" ? t("auth.noAccount") : t("auth.haveAccount")}{" "}
        <button
          type="button"
          className={cn("font-medium text-link hover:text-link-hover hover:underline")}
          onClick={() => {
            setMode((prev) => (prev === "signin" ? "signup" : "signin"));
            setFormError(null);
          }}
        >
          {mode === "signin" ? t("auth.switchToSignUp") : t("auth.switchToSignIn")}
        </button>
      </p>

      {/* Yasal not */}
      <p className="text-center text-xs text-muted">
        {t("auth.legalNote", {
          tos: t("auth.tos"),
          privacy: t("auth.privacy"),
        })}
      </p>
    </div>
  );
}

/** Google çok renkli "G" logosu (özgün SVG — marka varlığı kopyalanmaz). */
function GoogleIcon() {
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
