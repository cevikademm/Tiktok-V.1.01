"use client";

import { useTranslations } from "next-intl";
import type { StreamProfile } from "@/lib/schemas/stream-profile";

/**
 * Profil etiketi — kullanıcı adı > bağlı oyunun çevirisi > "Stream Profile {n}".
 * Profil adı kullanıcı verisi olduğu için i18n'e taşınmaz; boşken çeviriye düşer
 * (CLAUDE.md §5.2 "hardcoded string yasak" kuralı böylece korunur).
 */
export function useProfileLabel(): (profile: StreamProfile, index: number) => string {
  const t = useTranslations();

  return (profile, index) => {
    const custom = profile.name.trim();
    if (custom) return custom;
    if (profile.autoSwitch.gameId) {
      return t(`streamProfiles.games.${profile.autoSwitch.gameId}`);
    }
    return t("topbar.streamProfile", { n: index + 1 });
  };
}
