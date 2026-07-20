/**
 * TikTok LIVE hediye kataloğu — Türkçe arayüz adları ve coin (elmas) değerleri.
 *
 * Kaynak: TikTok LIVE hediye panelinin TR yerelindeki ekran görüntüleri
 * (kullanıcı tarafından sağlanan `png/` klasörü, 2026-07-20).
 *
 * Hediye adları TikTok platformundan gelen VERİDİR, arayüz metni değildir —
 * bu yüzden `messages/*.json` içine taşınmaz (bkz. CLAUDE.md §5.2 istisnası:
 * enum/etiket değil, platform verisi).
 *
 * `id` alanı kararlı bir slug'dır; TikTok'un sayısal `giftId` değeriyle aynı
 * DEĞİLDİR. Bu yüzden `gift_specific` eşleştirmesi hem id hem ad üzerinden
 * çalışır (bkz. `lib/engine/matcher.ts`).
 */

export interface GiftCatalogEntry {
  /** Kararlı slug — `gift_specific` koşulunda ve ikon dosya adında kullanılır. */
  id: string;
  /** TikTok TR arayüzünde göründüğü ad. */
  name: string;
  /** Coin (elmas) değeri. Etkileşimli hediyelerde sabit değer yoktur → 0. */
  coins: number;
  /** `/public/gifts` altındaki ikon yolu. */
  icon: string;
  /** Coin değeri sabit olmayan etkileşim hediyesi (ör. Hazine Kutusu). */
  interactive?: boolean;
}

function gift(id: string, name: string, coins: number, interactive = false): GiftCatalogEntry {
  return interactive
    ? { id, name, coins, icon: `/gifts/${id}.png`, interactive: true }
    : { id, name, coins, icon: `/gifts/${id}.png` };
}

/**
 * Coin değerine göre artan sıralı katalog — `gift_specific` açılır listesi
 * bu sırayla gösterilir (ucuzdan pahalıya, yayıncının aradığı düzen).
 */
export const GIFT_CATALOG: readonly GiftCatalogEntry[] = [
  // ── Etkileşim hediyesi (sabit coin değeri yok) ──
  gift("hazine-kutusu", "Hazine Kutusu", 0, true),

  // ── 1 coin ──
  gift("gul", "Gül", 1),
  gift("gg", "GG", 1),
  gift("tiktok", "TikTok", 1),
  gift("dondurma-kulahi", "Dondurma Külahı", 1),
  gift("macin-yildizi", "Maçın Yıldızı", 1),
  gift("beni-sev", "Beni Sev", 1),
  gift("parliyorsun", "Parlıyorsun!", 1),
  gift("hindistan-cevizi", "Hindistan Cevizi", 1),
  gift("seni-seviyorum", "Seni seviyorum", 1),
  gift("lale", "Lale", 1),
  gift("goz-kirpma", "Göz kırpma", 1),
  gift("alkis", "Alkış", 1),
  gift("lazer-cubugu", "Lazer Çubuğu", 1),
  gift("pasta-dilimi", "Pasta Dilimi", 1),
  gift("umut-kirintisi", "Umut Kırıntısı", 1),
  gift("pop", "Pop", 1),
  gift("aferin", "Aferin", 1),
  gift("serbest-stil", "Serbest stil", 1),
  gift("eskiler", "Eskiler", 1),
  gift("ruzgar-gulu", "Rüzgâr gülü", 1),

  // ── 5-10 coin ──
  gift("finger-heart", "Finger Heart", 5),
  gift("turk-kahvesi", "Türk kahvesi", 5),
  gift("blue-bead", "Blue Bead", 5),
  gift("donen-top", "Dönen Top", 5),
  gift("patlamis-misir", "Patlamış mısır", 5),
  gift("asiri-tepki", "Aşırı tepki", 5),
  gift("isimle-selamlama", "İsimle selamlama", 5),
  gift("ilahi-parmaklar", "İlahi Parmaklar", 6),
  gift("rosa", "Rosa", 10),
  gift("kalp", "Kalp", 10),
  gift("dostluk-kolyesi", "Dostluk Kolyesi", 10),
  gift("yolculuk-bileti", "Yolculuk Bileti", 10),
  gift("agir-cekim", "Ağır çekim", 10),
  gift("yok-artik", "Yok Artık", 10),
  gift("mahrem-yakinlik", "Mahrem Yakınlık", 10),

  // ── 15-90 coin ──
  gift("bravo", "Bravo!", 15),
  gift("yildizima-tebrikler", "Yıldızıma Tebrikler", 15),
  gift("parfum", "Parfüm", 20),
  gift("buket", "Buket", 20),
  gift("keci-sokak-muzisyeni", "Keçi Sokak Müzisyeni", 20),
  gift("donat", "Donat", 30),
  gift("cay", "Çay", 50),
  gift("kelebek", "Kelebek", 88),
  gift("harika", "Harika", 88),
  gift("aile", "Aile", 90),

  // ── 99-100 coin ──
  gift("sapka-ve-biyik", "Şapka ve Bıyık", 99),
  gift("kagittan-turna", "Kâğıttan Turna", 99),
  gift("minik-kanat", "Minik Kanat", 99),
  gift("yukselen-yildiz", "Yükselen Yıldız", 99),
  gift("sarki-soyleyen-mantar", "Şarkı Söyleyen Mantar", 99),
  gift("melodi-cicegi", "Melodi Çiçeği", 99),
  gift("groove-gitar", "Groove Gitar", 99),
  gift("oyun-kumandasi", "Oyun Kumandası", 100),
  gift("super-gg", "Süper GG", 100),
  gift("elle-kalp", "Elle Kalp", 100),
  gift("konfeti", "Konfeti", 100),
  gift("mishka-bear", "Mishka Bear", 100),
  gift("kabuk-enerjisi", "Kabuk Enerjisi", 100),
  gift("balon-hediye-kutusu", "Balon Hediye Kutusu", 100),
  gift("buket-100", "Buket", 100),
  gift("pudra", "Pudra", 100),

  // ── 129-200 coin ──
  gift("crosette-havai-fisek", "Crosette Havai Fişek", 129),
  gift("ask-gozlugu", "Aşk Gözlüğü", 149),
  gift("tempo-flut", "Tempo Flüt", 149),
  gift("sceptre", "Sceptre", 150),
  gift("opucuk", "Öpücük", 150),
  gift("tac", "Taç", 199),
  gift("kalpler", "Kalpler", 199),
  gift("gece-yildizi", "Gece Yıldızı", 199),
  gift("seni-seviyorum-199", "Seni Seviyorum", 199),
  gift("dans-eden-eller", "Dans Eden Eller", 199),
  gift("panda-tirmanisi", "Panda Tırmanışı", 199),
  gift("buz-gibi-limonata", "Buz Gibi Limonata", 199),
  gift("meerkat", "Meerkat", 199),
  gift("rose-el-yapimi", "Rose el yapımı", 199),
  gift("kaleci-kurtarisi", "Kaleci Kurtarışı", 199),
  gift("baloncuklari-ufle", "Baloncukları Üfle", 199),
  gift("ritim-robotu", "Ritim Robotu", 199),
  gift("kavun-suyu", "Kavun Suyu", 199),
  gift("cicekli-trompet", "Çiçekli Trompet", 199),
  gift("valiz", "Valiz", 199),
  gift("best-to-give-me", "Best to give me", 199),
  gift("semsemia", "Semsemia", 200),
  gift("baglama", "Bağlama", 200),

  // ── 214-300 coin ──
  gift("gul-ayi", "Gül Ayı", 214),
  gift("kedi", "Kedi", 222),
  gift("ud", "Ud", 249),
  gift("darbuka", "Darbuka", 249),
  gift("ruya-gibi-keman", "Rüya Gibi Keman", 249),
  gift("sarki-soyleyen-kurbaga", "Şarkı Söyleyen Kurbağa", 249),
  gift("siir-notasi", "Şiir Notası", 249),
  gift("muzigin-enerjisi", "Müziğin Enerjisi", 249),
  gift("corgi", "Corgi", 299),
  gift("boks-eldivenleri", "Boks Eldivenleri", 299),
  gift("meyve-arkadaslar", "Meyve Arkadaşlar", 299),
  gift("sevgi-tabagi", "Sevgi Tabağı", 299),
  gift("yildiz-isigi-pusulasi", "Yıldız Işığı Pusulası", 299),
  gift("sevimli-patiler", "Sevimli Patiler", 299),
  gift("tezahurat-havlusu", "Tezahürat Havlusu", 299),
  gift("elmas-ask-yuzugu", "Elmas aşk yüzüğü", 300),
  gift("ruzgar-dansozu", "Rüzgar Dansözü", 300),

  // ── 349-500 coin ──
  gift("elektronik-ritimler", "Elektronik Ritimler", 349),
  gift("rockci-mantar", "Rock'çı Mantar", 349),
  gift("yagmurda-chopin", "Yağmurda Chopin", 349),
  gift("sonsuzluk-gulu", "Sonsuzluk Gülü", 399),
  gift("gullerin-dostu-rosie", "Güllerin Dostu Rosie", 399),
  gift("rockci-dost-rocky", "Rock'çı Dost Rocky", 399),
  gift("kaktus-dansi", "Kaktüs Dansı", 399),
  gift("akilli-dost-sage", "Akıllı Dost Sage", 399),
  gift("eglenceli-dost-jollie", "Eğlenceli Dost Jollie", 399),
  gift("sarki-soyleyen-saksafon", "Şarkı Söyleyen Saksafon", 399),
  gift("iyi-aksamlar", "İyi Akşamlar", 399),
  gift("ritim-kanatlari", "Ritim Kanatları", 399),
  gift("rockci-kediler", "Rock'çı Kediler", 400),
  gift("popcu-papagan", "Popçu Papağan", 400),
  gift("dj-dalgasi", "DJ Dalgası", 400),
  gift("korsan-hazinesi", "Korsan Hazinesi", 449),
  gift("palyaco-boogie", "Palyaço Boogie", 449),
  gift("ask-koalasi", "Aşk Koalası", 450),
  gift("pembe-kovboy", "Pembe Kovboy", 450),
  gift("mercan", "Mercan", 499),
  gift("lolipop-hediye-kutusu", "Lolipop Hediye Kutusu", 499),
  gift("para-tabancasi", "Para Tabancası", 500),
  gift("make-it-rain", "Make it rain", 500),
  gift("harikasin", "Harikasın", 500),
  gift("muzikte-kaybolmak", "Müzikte Kaybolmak", 500),
  gift("guller", "Güller", 500),
  gift("davul-patlamasi", "Davul Patlaması", 500),
  gift("kalp-gitar", "Kalp Gitar", 500),
  gift("bateri-dahisi", "Bateri Dâhisi", 500),

  // ── 549-1000 coin ──
  gift("davulcu-hamster", "Davulcu Hamster", 549),
  gift("kugu", "Kuğu", 699),
  gift("van-kedisi", "Van Kedisi", 799),
  gift("tren", "Tren", 899),
  gift("birlikte-seyahat", "Birlikte Seyahat", 999),
  gift("sansli-airdrop-kutusu", "Şanslı Airdrop Kutusu", 999),
  gift("galaksi", "Galaksi", 1000),
  gift("zurafa", "Zürafa", 1000),
  gift("parlayan-denizanasi", "Parlayan Denizanası", 1000),
  gift("su-kaydiragi", "Su Kaydırağı", 1000),

  // ── 1000+ coin (üst segment) ──
  gift("havai-fisek", "Havai fişek", 1088),
  gift("gelecekte-karsilasma", "Gelecekte Karşılaşma", 1500),
  gift("balina-dalisi", "Balina Dalışı", 2150),
  gift("rosiye-opucuk-gonder", "Rosie'ye Öpücük Gönder", 2199),
  gift("motorsiklet", "Motorsiklet", 2988),
  gift("meteor-yagmuru", "Meteor Yağmuru", 3000),
  gift("yavru-kedi-leon", "Yavru Kedi Leon", 4888),
  gift("ozel-jet", "Özel Jet", 4888),
  gift("ucan-jetler", "Uçan Jetler", 5000),
  gift("kurt", "Kurt", 5500),
  gift("leon-ve-lili", "Leon ve Lili", 9699),
  gift("gun-batimi-otoyolu", "Gün Batımı Otoyolu", 10000),
  gift("tiktok-universe", "TikTok Universe", 44999),
];

/** Slug → hediye. */
const BY_ID = new Map(GIFT_CATALOG.map((g) => [g.id, g]));

/**
 * Ad → hediye. TikTok olayları sayısal id yerine ad gönderdiğinde eşleştirme
 * buradan yapılır; Türkçe'ye duyarlı küçültme (İ/ı) kullanılır.
 */
const BY_NAME = new Map(GIFT_CATALOG.map((g) => [normalizeGiftName(g.name), g]));

/** Hediye adını karşılaştırma için normalleştirir (TR yereline duyarlı). */
export function normalizeGiftName(name: string): string {
  return name.toLocaleLowerCase("tr").trim();
}

/** Slug ile hediye getirir. */
export function findGiftById(id: string): GiftCatalogEntry | undefined {
  return BY_ID.get(id);
}

/** Ad ile hediye getirir (büyük/küçük harf duyarsız). */
export function findGiftByName(name: string): GiftCatalogEntry | undefined {
  return BY_NAME.get(normalizeGiftName(name));
}

/** Slug veya ad ile hediye getirir — hangisi elimizdeyse. */
export function findGift(ref: { giftId?: string; giftName?: string }): GiftCatalogEntry | undefined {
  return (
    (ref.giftId ? BY_ID.get(ref.giftId) : undefined) ??
    (ref.giftName ? BY_NAME.get(normalizeGiftName(ref.giftName)) : undefined)
  );
}

/** Verilen coin değerine eşit/üstü en ucuz hediye — simülatör için. */
export function findGiftByCoins(coins: number): GiftCatalogEntry | undefined {
  return GIFT_CATALOG.find((g) => !g.interactive && g.coins >= coins);
}
