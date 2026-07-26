# Roadmap

## MVP status

**Initial MVP completed and closed on 26 July 2026.**

The production application now has authenticated Owner/Manager access, durable read-only Odoo synchronization, the first live management report, mixed-currency display, XLSX/PDF outputs, export audit history and repeatable operational rehearsals.

## M0 — Discovery and Canon

Hedef: gerçek Odoo veri modelini ve rapor kurallarını doğrulamak.

Çıktılar:

- Odoo sürümü
- API bağlantı testi
- şirket kimlikleri
- satış alan envanteri
- Studio özel alanları
- tarih ve durum eşlemeleri
- seçili tutarsız ayın kayıt bazlı analizi
- onaylanmış metrik sözlüğü

Çıkış kriteri: İlk raporun her metriği örnek kayıtlar üzerinden açıklanabilir.

Canlı tenant keşfi ve şirket kapsamı 25 Temmuz 2026 tarihinde tamamlandı. Açık keşif maddeleri yalnızca entegrasyon API-key kullanıcısının operasyonel kimliği ve `validity_date` durum örneklemidir.

## M1 — Foundation and Live Staging

Hedef: GitHub’dan Coolify staging’e otomatik dağıtılan güvenli iskelet.

Çıktılar:

- monorepo
- web ve worker
- PostgreSQL ve Redis
- migration sistemi
- Owner/Manager login
- health endpoints
- GitHub CI
- `develop` otomatik staging deploy
- temel tasarım sistemi ve shell

Çıkış kriteri: Staging URL’de giriş yapılabilir, rol tabanlı boş dashboard açılır.

## M2 — Odoo Sync Core

**Durum: Kapalı.**

Hedef: salt okunur, izlenebilir veri senkronizasyonu.

Teslim edilenler:

- Odoo adapter ve bağlantı testi,
- şirket `1` / `25` eşlemeleri,
- PostgreSQL tabanlı durable sync kuyruğu,
- ayrı worker ve source-ID cursor sayfalama,
- customer, salesperson, currency ve `sale.order` upsert/metadata,
- retry ve restart recovery,
- `user_id = false` için **Atanmamış** kovası,
- yalnızca başarılı tam tarama sonrası stale-row temizliği,
- şirket/durum/missing-salesperson mutabakatı,
- Owner queue ve sync geçmişi,
- web/worker production image ayrımı,
- PostgreSQL worker leadership lease.

Production kabulü iki ardışık tam senkronizasyonla tamamlandı:

- kaynak `6.875`,
- işlenen `6.875`,
- mutabakat `Tam`,
- ikinci çalışmada duplicate artışı ve stale silme yok.

## M3 — First Report

**Durum: Kapalı.**

Hedef: Yurt Dışı Aylık Teklif Performansı.

Teslim edilenler:

- rapor kartı ve canlı rapor rotası,
- ay/tarih, iş birimi, personel, müşteri ve durum filtreleri,
- genel / personel / müşteri görünümleri,
- KPI ve grafikler,
- drill-down tablo,
- önceki dönem karşılaştırması,
- Owner/Manager kapsam güvenliği,
- JSON API ve A4 yazdırma görünümü,
- teklif bazında USD/EUR/TRY gösterimi.

Rapor production’da çalışır durumda doğrulandı. İlave görsel/analitik iyileştirmeler MVP sonrasına ertelendi. Ayrıntılı kapanış: `docs/development/M3_EXIT_REPORT.md`.

## M4 — Exports and Production Readiness

**Durum: Kapalı.**

Hedef: toplantıda kullanılabilir çıktı ve kontrollü production operasyonu.

Teslim edilenler:

- print CSS,
- seçili personel PDF,
- tüm personel PDF,
- filtrelenmiş XLSX,
- export audit log ve Owner audit geçmişi,
- fixed-coordinate A4 PDF renderer ve Türkçe font paketi,
- izole PostgreSQL backup/restore provası,
- önceki web/worker sürümünün güncel şemayla rollback uyumluluk provası,
- belgelenmiş web/worker birlikte rollback prosedürü,
- `main` otomatik production deploy akışı.

Kabul sonucu:

- XLSX production kullanımında kabul edildi,
- yeniden oluşturulan PDF’ler MVP için kabul edildi,
- backup ve restore imzaları birebir eşleşti,
- önceki web readiness, Owner oturumu, rapor API’si, worker başlangıcı ve leadership lease güncel şemada geçti,
- production üzerinde yapay kesinti oluşturulmadı.

Ayrıntılı kapanış: `docs/development/M4_EXIT_REPORT.md`.

## M5 — Additional Reports

**Durum: Devam ediyor.**

Teslim sırası:

1. Açık ve Yaşlanan Teklifler — tamamlandı,
2. Müşteri Teklif Geçmişi — tamamlandı,
3. Personel Performansı — tamamlandı,
4. Tekliften Siparişe Dönüşüm — aktif geliştirme.

M5 kapanışında kabul edilmiş rapor rotaları, filtreler, metrik sözleşmeleri, JSON API’leri ve çıktı formatları dondurulur. Kaynak para birimi bazlı tutar analizlerinin eski raporlara uygulanması ayrıca #24 ile izlenir.

## M5.5 — Complete Frontend Redesign

**M6 öncesi zorunlu geçiş kapısıdır.**

M5 boyunca dikey rapor dilimleri hızlı ve güvenli biçimde teslim edildiği için mevcut arayüz geçici ekranlar, tekrarlanan report shell’leri ve sabit hızlı erişim yüzeyleri içerir. M6 başlamadan önce uygulamanın tüm frontend’i tek bir profesyonel ürün deneyimi olarak yeniden kurulacaktır.

Kapsam:

- gerçek rapor kütüphanesi ve bilgi mimarisi,
- ortak uygulama shell’i, aktif navigasyon ve breadcrumb yapısı,
- Owner ve Manager için ayrıştırılmış deneyim,
- Owner yönetim ekranlarının özel yönetim rotalarına taşınması,
- ortak filtre, KPI, grafik, tablo, durum, boş/hata/yükleme ve aksiyon bileşenleri,
- tutarlı tipografi, boşluk, responsive davranış ve erişilebilirlik,
- ekran ile print/PDF sunumunun kontrollü ayrımı,
- tüm mevcut rapor, API, XLSX/PDF ve yetki sözleşmelerinin regresyon korunumu.

Çıkış kriteri: yeniden tasarlanan frontend production’da Owner ve Manager oturumlarıyla kabul edilmeden M6 geliştirmesi başlamaz. Ayrıntılı takip: GitHub issue #22.

## M6 — Owner Report Configuration

Tam BI editörü değil, kontrollü yapılandırıcı:

- hazır dataset seçimi,
- izin verilen metric seçimi,
- filtre seçimi,
- grafik ve tablo düzeni,
- yayınlama,
- sürümleme.

## M7 — Advanced Analytics

- ürün eğilimleri,
- satış tahminleri,
- planlı rapor gönderimi,
- snapshot karşılaştırması,
- kontrollü doğal dil rapor taslağı.
