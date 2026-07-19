import { describe, expect, it } from "vitest";
import { describeCloseReason } from "@/lib/server/eulerstream";

/**
 * Euler kapanış nedeni → kullanıcı mesajı.
 *
 * Gerçek olay: yayında olmayan bir hesap için Euler `1011 / "WS State Error"`
 * gönderiyor ve bu ham metin kullanıcıya olduğu gibi gösteriliyordu. Kullanıcı
 * yalnız "hata verdi" görüyor, yayınının kapalı olduğunu anlamıyordu.
 */
describe("describeCloseReason", () => {
  it("Euler'in 'WS State Error' kapanışını 'yayında değil' olarak açıklar", () => {
    const r = describeCloseReason(1011, "WS State Error", "furkan_agluc76");
    expect(r.code).toBe("USER_OFFLINE");
    expect(r.message).toContain("@furkan_agluc76");
    expect(r.message).toContain("canlı yayında değil");
  });

  it("neden boş geldiğinde de yayın kapalı varsayar (en olası sebep)", () => {
    expect(describeCloseReason(1006, "", "abc").code).toBe("USER_OFFLINE");
    expect(describeCloseReason(1006, "   ", "abc").code).toBe("USER_OFFLINE");
  });

  it("kota dolduğunda RATE_LIMITED döner", () => {
    expect(describeCloseReason(1000, "Rate limit exceeded", "a").code).toBe("RATE_LIMITED");
    expect(describeCloseReason(1000, "daily quota reached", "a").code).toBe("RATE_LIMITED");
    expect(describeCloseReason(1013, "", "a").code).toBe("RATE_LIMITED");
  });

  it("anahtar reddedildiğinde INVALID_KEY döner", () => {
    expect(describeCloseReason(1008, "Invalid API key", "a").code).toBe("INVALID_KEY");
    expect(describeCloseReason(1008, "Unauthorized", "a").code).toBe("INVALID_KEY");
  });

  it("tanımadığı nedeni ham hâliyle ama kodla birlikte iletir", () => {
    const r = describeCloseReason(1005, "something unexpected", "a");
    expect(r.code).toBe("WS_CLOSED");
    expect(r.message).toContain("something unexpected");
    expect(r.message).toContain("1005");
  });

  it("kota kontrolü anahtar kontrolünden önce gelir (öncelik sırası)", () => {
    // Euler bazen ikisini aynı metinde birleştirir; kota daha eyleme dönüştürülebilir.
    expect(describeCloseReason(1013, "api key rate limit", "a").code).toBe("RATE_LIMITED");
  });
});
