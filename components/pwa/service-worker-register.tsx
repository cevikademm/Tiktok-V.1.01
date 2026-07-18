"use client";

import { useEffect } from "react";

/**
 * Service worker kaydı — PWA yüklenebilirliği için gerekli.
 *
 * Yalnız ÜRETİMDE kaydeder: dev modunda SW + Turbopack HMR çakışır ve bayat
 * içerik/garip hatalar üretir. Kayıt `load` sonrası yapılır (ilk boyayı yavaşlatmaz).
 */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;

    const register = () => {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // Kayıt başarısızsa sessizce geç — uygulama SW olmadan da tam çalışır.
      });
    };

    if (document.readyState === "complete") {
      register();
    } else {
      window.addEventListener("load", register, { once: true });
      return () => window.removeEventListener("load", register);
    }
  }, []);

  return null;
}
