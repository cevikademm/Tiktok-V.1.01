"use client";

import type { User } from "@supabase/supabase-js";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

/**
 * Girişli kullanıcıyı istemcide izler (oturum değişimlerine abone).
 * `user === undefined` → yükleniyor, `null` → oturum yok, obje → girişli.
 */
export function useUser(): { user: User | null | undefined } {
  const [user, setUser] = useState<User | null | undefined>(undefined);

  useEffect(() => {
    const supabase = createClient();
    let active = true;

    supabase.auth.getUser().then(({ data }) => {
      if (active) setUser(data.user ?? null);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  return { user };
}
