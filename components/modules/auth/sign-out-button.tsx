"use client";

import { LogOut } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Button, type ButtonProps } from "@/components/ui/button";
import { useRouter } from "@/lib/i18n/navigation";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

/**
 * Çıkış butonu — oturumu kapatır, sunucu bileşenlerini tazeler ve login'e döner.
 * `variant`/`size`/`className` ile çağıran yere uyum sağlar; ikon opsiyonel.
 */
export function SignOutButton({
  variant = "ghost",
  size = "sm",
  className,
  withIcon = false,
  onDone,
}: {
  variant?: ButtonProps["variant"];
  size?: ButtonProps["size"];
  className?: string;
  withIcon?: boolean;
  onDone?: () => void;
}) {
  const t = useTranslations();
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function handleSignOut() {
    setPending(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    onDone?.();
    router.refresh();
    router.replace("/login");
  }

  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      className={cn(className)}
      onClick={handleSignOut}
      disabled={pending}
    >
      {withIcon && <LogOut className="size-4" aria-hidden />}
      {t("auth.signOut")}
    </Button>
  );
}
