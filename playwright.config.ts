import { defineConfig, devices } from "@playwright/test";

const PORT = 3100;
const baseURL = `http://127.0.0.1:${PORT}`;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? "github" : "list",

  use: {
    baseURL,
    trace: "on-first-retry",
    /**
     * Tarayıcı dili sabitlenir: next-intl `Accept-Language` algılar (PRD §11), yani
     * dil pinlenmezse `/start` istemcinin diline göre `/en/start`'a yönlenir ve
     * testler ortamın diline göre farklı sonuç verir. `tr` varsayılan locale.
     */
    locale: "tr-TR",
  },

  /**
   * `channel: "chrome"` → sistemde kurulu Chrome kullanılır.
   * Playwright'ın kendi Chromium'unu indiremediği kısıtlı ağlarda da çalışır;
   * PRD §13 zaten hedef tarayıcı olarak Chrome'u listeliyor.
   */
  projects: [
    { name: "chrome", use: { ...devices["Desktop Chrome"], channel: "chrome" } },
  ],

  webServer: {
    // Üretim derlemesine karşı koşulur — dev sunucusunun derleme gecikmesi testleri yanıltmasın.
    command: `pnpm build && pnpm start --port ${PORT}`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
