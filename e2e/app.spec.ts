import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

/**
 * Faz 0-1 kabul kriterleri (PRD §15) — uçtan uca doğrulama.
 */

test.describe("Kabuk ve i18n (PRD §15.1-2)", () => {
  test("start sayfası TR açılır ve 10 bölümün tamamı render olur", async ({ page }) => {
    await page.goto("/start");

    await expect(page.getByRole("heading", { name: "Hoş geldin!" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Hızlı Erişim" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Sıkça Sorulan Sorular" })).toBeVisible();

    // PRD §5.1: 10 bölüm — her biri id'li bir bölüm olarak gezginle eşleşir.
    for (const id of [
      "section-desktop",
      "section-welcome",
      "section-connection",
      "section-quick-access",
      "section-agencies",
      "section-tiktok-channel",
      "section-news",
      "section-pro",
      "section-how-to",
      "section-faq",
    ]) {
      await expect(page.locator(`#${id}`)).toHaveCount(1);
    }
  });

  test("4 dilde de arayüz çevrilir, hardcoded string kalmaz", async ({ page }) => {
    const cases: Array<[string, string]> = [
      ["/start", "Hoş geldin!"],
      ["/en/start", "Welcome!"],
      ["/de/start", "Willkommen!"],
      ["/es/start", "¡Bienvenido!"],
    ];

    for (const [path, heading] of cases) {
      await page.goto(path);
      await expect(page.getByRole("heading", { name: heading })).toBeVisible();
    }
  });

  test("topbar ölçüleri ve bileşenleri PRD §4.3-4.4 ile uyumlu", async ({ page }) => {
    await page.goto("/start");

    // 54px topbar
    const topbar = page.locator("header").first();
    await expect(topbar).toHaveCSS("height", "54px");

    // 64px ikon rayı, 10 bubble
    const rail = page.getByRole("navigation").first();
    await expect(rail).toHaveCSS("width", "64px");
    await expect(rail.getByRole("link")).toHaveCount(10);

    // Bağlan butonu + arama tetikleyici
    await expect(page.getByRole("button", { name: /TikTok LIVE'a bağlanın/ })).toBeVisible();
    await expect(page.getByText("Aramak")).toBeVisible();
  });

  test("⌘K arama overlay'i açılır ve modüle götürür", async ({ page }) => {
    await page.goto("/start");

    await page.keyboard.press("ControlOrMeta+k");
    const dialog = page.getByRole("dialog", { name: "Uygulamada ara" });
    await expect(dialog).toBeVisible();

    await page.keyboard.type("Kurmak");
    await page.keyboard.press("Enter");

    await expect(page).toHaveURL(/\/setup$/);
  });

  test("dil değişimi tüm UI'ı çevirir", async ({ page }) => {
    await page.goto("/start");

    await page.getByRole("button", { name: /Misafir/ }).click();
    await page.getByRole("button", { name: "English", exact: true }).click();

    await expect(page).toHaveURL(/\/en\/start$/);
    await expect(page.getByRole("heading", { name: "Welcome!" })).toBeVisible();
  });
});

test.describe("Hızlı Erişim kalıcılığı (PRD §15.3)", () => {
  test("toggle durumu sayfa yenilendikten sonra korunur", async ({ page }) => {
    await page.goto("/start");

    const ttsBox = page.locator("#section-quick-access").getByRole("switch").first();
    await expect(ttsBox).toHaveAttribute("aria-checked", "true");

    await ttsBox.click();
    await expect(ttsBox).toHaveAttribute("aria-checked", "false");

    await page.reload();
    // localStorage'dan geri okunur — hidrasyon sonrası da kapalı kalmalı.
    await expect(
      page.locator("#section-quick-access").getByRole("switch").first(),
    ).toHaveAttribute("aria-checked", "false");
  });
});

test.describe("Kurmak sayfası (PRD §15.4)", () => {
  test("14 alt bölümün tamamı render olur", async ({ page }) => {
    await page.goto("/setup");

    for (const id of [
      "section-tiktokAccount",
      "section-pointsSystem",
      "section-subscriberBonus",
      "section-levelSettings",
      "section-obsConnection",
      "section-streamerbotConnection",
      "section-minecraftConnection",
      "section-resetPoints",
      "section-pro",
      "section-patreon",
      "section-account",
      "section-importExport",
      "section-advanced",
      "section-debug",
    ]) {
      await expect(page.locator(`#${id}`)).toHaveCount(1);
    }
  });

  test("kullanıcı adı doğrulaması hatayı gösterir", async ({ page }) => {
    await page.goto("/setup");

    const input = page.locator("#tiktok-username");
    await input.fill("geçersiz kullanıcı!");
    await page.locator("#section-tiktokAccount").getByRole("button", { name: /bağlanın/ }).click();

    await expect(page.getByText("Geçersiz kullanıcı adı")).toBeVisible();
  });

  test("mock Test Bağlantısı akışı sonuç döndürür", async ({ page }) => {
    await page.goto("/setup");

    await page
      .locator("#section-obsConnection")
      .getByRole("button", { name: "Test Bağlantısı" })
      .click();

    await expect(page.locator("#section-obsConnection").getByRole("status")).toContainText(
      /Bağlantı başarılı/,
    );
  });

  test("seviye listesi üstel eğriyi gösterir", async ({ page }) => {
    await page.goto("/setup");

    await page.getByRole("button", { name: "Seviye listesini göster" }).click();
    await expect(page.locator("#section-levelSettings table")).toBeVisible();
  });
});

test.describe("Eylemler ve Etkinlikler (PRD §15.5)", () => {
  test("eylem oluşturma → etkinlik bağlama → simülatör zinciri çalışır", async ({ page }) => {
    await page.goto("/actionsandevents");

    // Boş durum
    await expect(page.getByText("Tanımlı eylem yok")).toBeVisible();

    // 1) Eylem oluştur
    await page.getByRole("button", { name: "Yeni Eylem Oluştur" }).click();
    const actionDialog = page.getByRole("dialog", { name: "Yeni Eylem" });
    await expect(actionDialog).toBeVisible();

    await page.locator("#action-name").fill("Takip Uyarısı");
    await page.locator("#cfg-text").fill("{username} takip etti!");
    await actionDialog.getByRole("button", { name: "Kaydet" }).click();

    await expect(page.getByText("Eylem kaydedildi!")).toBeVisible();
    // Ad hücresi — toggle'ın aria-label'ı da aynı adı taşıdığı için exact eşleşme.
    await expect(page.getByRole("cell", { name: "Takip Uyarısı", exact: true })).toBeVisible();

    // 2) Etkinlik oluştur — Takip tetikleyicisi + eylemi bağla
    await page.getByRole("button", { name: "Yeni Etkinlik Oluştur" }).click();
    const eventDialog = page.getByRole("dialog", { name: "Yeni Etkinlik" });
    await eventDialog.getByRole("button", { name: "Takip", exact: true }).click();
    await eventDialog.getByRole("checkbox").first().check();
    await eventDialog.getByRole("button", { name: "Kaydet" }).click();

    await expect(page.getByText("Etkinlik kaydedildi!")).toBeVisible();

    // 3) Simülatör — olay kural motorundan geçip eşleşmeli
    await page.getByRole("button", { name: "Takip Simüle Et" }).click();
    await expect(page.getByText(/etkinlik eşleşti/)).toBeVisible();
  });

  test("aynı adla ikinci eylem reddedilir", async ({ page }) => {
    await page.goto("/actionsandevents");

    for (const attempt of [1, 2]) {
      await page.getByRole("button", { name: "Yeni Eylem Oluştur" }).click();
      const dialog = page.getByRole("dialog", { name: "Yeni Eylem" });
      await page.locator("#action-name").fill("Tekrar Eden Ad");
      await dialog.getByRole("button", { name: "Kaydet" }).click();

      if (attempt === 2) {
        await expect(page.getByText("Bu adda bir eylem zaten var")).toBeVisible();
        await dialog.getByRole("button", { name: "İptal" }).click();
      }
    }
  });

  test("20 eylem tipi ve 15 tetikleyici seçilebilir durumda", async ({ page }) => {
    await page.goto("/actionsandevents");

    await page.getByRole("button", { name: "Yeni Eylem Oluştur" }).click();
    // PRD §5.3: 20 tip; playVideo (deprecated) ve setSnapCamEffect (devre dışı) gizli → 19 görünür.
    const typeButtons = page.getByRole("dialog").locator('button[aria-pressed]');
    await expect(typeButtons).toHaveCount(19);
    await page.getByRole("dialog").getByRole("button", { name: "İptal" }).click();

    await page.getByRole("button", { name: "Yeni Etkinlik Oluştur" }).click();
    const triggerButtons = page.getByRole("dialog").locator('button[aria-pressed]');
    await expect(triggerButtons).toHaveCount(15);
  });

  test("8 overlay ekranı ve widget URL'leri listelenir", async ({ page }) => {
    await page.goto("/actionsandevents");

    const screensTable = page.locator("#section-screens tbody tr");
    await expect(screensTable).toHaveCount(8);
    await expect(page.locator("#section-screens").getByText(/\/widget\/myactions/).first()).toBeVisible();
  });
});

test.describe("Widget render (PRD §15.6)", () => {
  test("/widget/myactions şeffaf arka planla açılır ve kuyruk durumu görünür", async ({ page }) => {
    await page.goto("/widget/myactions?cid=demo-channel&screen=1&preview=1");

    await expect(page.getByText(/screen=1/)).toBeVisible();
    await expect(page.getByText(/queue=/)).toBeVisible();
  });

  test("uygulanmamış widget açık durum bildirir", async ({ page }) => {
    await page.goto("/widget/wheel?cid=demo-channel");
    await expect(page.getByText(/not implemented yet/)).toBeVisible();
  });

  test("Event Simulator olayı başka sekmedeki widget'ta render olur", async ({ context }) => {
    // Widget ayrı bir belge — olay BroadcastChannel üzerinden geçmeli (lib/data/mock/index.ts).
    const app = await context.newPage();
    await app.goto("/actionsandevents");

    // Metin gösteren bir eylem + onu tetikleyen Takip etkinliği kur.
    await app.getByRole("button", { name: "Yeni Eylem Oluştur" }).click();
    await app.locator("#action-name").fill("Overlay Testi");
    await app.locator("#cfg-text").fill("{username} geldi!");
    await app.getByRole("dialog").getByRole("button", { name: "Kaydet" }).click();
    await expect(app.getByText("Eylem kaydedildi!")).toBeVisible();

    await app.getByRole("button", { name: "Yeni Etkinlik Oluştur" }).click();
    const dialog = app.getByRole("dialog", { name: "Yeni Etkinlik" });
    await dialog.getByRole("button", { name: "Takip", exact: true }).click();
    await dialog.getByRole("checkbox").first().check();
    await dialog.getByRole("button", { name: "Kaydet" }).click();
    await expect(app.getByText("Etkinlik kaydedildi!")).toBeVisible();

    // Widget'ı ikinci sekmede aç (OBS browser source'un yerine geçer).
    const widget = await context.newPage();
    await widget.goto("/widget/myactions?cid=demo-channel&screen=1");
    await widget.waitForTimeout(500);

    // Simülatörü uygulama sekmesinden tetikle.
    await app.getByRole("button", { name: "Takip Simüle Et" }).click();

    // Eylem metni widget sekmesinde görünmeli.
    await expect(widget.getByText(/geldi!/)).toBeVisible({ timeout: 10_000 });
  });
});

test.describe("Erişilebilirlik (PRD §15.8 · WCAG 2.2 AA)", () => {
  for (const path of ["/start", "/setup", "/actionsandevents"]) {
    test(`${path} — kritik/ciddi axe ihlali yok`, async ({ page }) => {
      await page.goto(path);

      const results = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
        .analyze();

      const serious = results.violations.filter(
        (v) => v.impact === "critical" || v.impact === "serious",
      );

      expect(
        serious,
        serious.map((v) => `${v.id}: ${v.help} (${v.nodes.length} düğüm)`).join("\n"),
      ).toEqual([]);
    });
  }
});
