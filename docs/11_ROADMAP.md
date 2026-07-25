# Roadmap

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

Hedef: salt okunur, izlenebilir veri senkronizasyonu.

Çıktılar:

- Odoo adapter
- bağlantı testi
- şirket eşleme
- customer, salesperson, sale.order sync
- cursor ve retry
- sync geçmişi
- veri kalite temel ekranı

Toplu sync-core dilimi:

- şirket `1` / `25` eşlemeleri PostgreSQL’e sabitlendi,
- schema version `2` oluşturuldu,
- PostgreSQL tabanlı durable sync kuyruğu eklendi,
- ayrı worker ile source-ID cursor sayfalama uygulandı,
- customer, salesperson ve `sale.order` upsert’i eklendi,
- `user_id = false` kayıtları **Atanmamış** olarak korundu,
- yalnızca başarılı tam tarama sonrası stale-row temizliği eklendi,
- şirket/durum/missing-salesperson mutabakatı eklendi,
- Owner queue ve sync-history yüzeyi eklendi,
- web ve worker production image’ları ayrıldı.

Çıkış kriteri: Seçilen dönem verisi tekrar çalıştırıldığında idempotent ve sayısal olarak doğrulanmış biçimde yerel veritabanına alınır.

Kalan M2 production kanıtı:

1. web ve worker’ın aynı commit ile deploy edilmesi,
2. ilk tam sync’in `6.875` kayıtla mutabık kapanması,
3. ikinci tam sync’in aynı sayılarla duplication olmadan kapanması.

## M3 — First Report

Hedef: Yurt Dışı Aylık Teklif Performansı.

Çıktılar:

- rapor kartı
- ay/tarih filtreleri
- genel görünüm
- personel görünümü
- müşteri görünümü
- KPI ve grafikler
- drill-down tablo
- önceki dönem karşılaştırması, veri uygunsa

Çıkış kriteri: Manuel doğrulanmış fixture ve seçili gerçek ay ile aynı sonuç.

## M4 — Exports and Production Readiness

Hedef: toplantıda kullanılabilir çıktı ve production dağıtımı.

Çıktılar:

- print CSS
- personel PDF
- tüm personel PDF
- XLSX
- audit log
- production backup ve restore kontrolü
- `main` otomatik production deploy

Çıkış kriteri: Manager raporu yardım almadan çalıştırıp yazdırabilir; production rollback prosedürü test edilmiştir.

## M5 — Additional Reports

- Personel Performansı
- Müşteri Teklif Geçmişi
- Açık ve Yaşlanan Teklifler
- Tekliften Siparişe Dönüşüm

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
