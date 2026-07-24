# Test Strategy

## 1. Test piramidi

### Unit

- tarih aralığı kuralları,
- durum normalizasyonu,
- dönüşüm oranı,
- para birimi kuralları,
- filtre doğrulama,
- authorization policy.

### Integration

- PostgreSQL repository işlemleri,
- Odoo adapter response mapping,
- sync upsert ve cursor,
- rapor sorguları,
- export metadata’sı,
- audit kayıtları.

### Contract

Kaydedilmiş Odoo fixture’larıyla:

- beklenen alanların varlığı,
- Studio alanlarının dönüşümü,
- sayfalama,
- hata response’ları,
- sürüm adaptörü davranışı.

Gerçek API’ye dayanan testler ayrı ve kontrollü çalıştırılır.

### Browser E2E

Kritik akışlar:

1. Manager giriş yapar.
2. Yayımlanmış raporu açar.
3. Ay ve personel filtresi seçer.
4. Rapor sonucu görüntülenir.
5. Detay satırına iner.
6. Yazdırma görünümünü açar.
7. Owner bağlantı durumunu ve sync geçmişini görür.

## 2. Rapor doğruluk testleri

Golden fixture veri seti oluşturulmalıdır. Bu veri setinde:

- aynı ayda açık, onaylı, iptal ve süresi dolmuş teklifler,
- ay sonunda oluşturulup sonraki ay onaylanan teklif,
- farklı şirketler,
- farklı personeller,
- farklı müşteriler,
- farklı para birimleri,
- eksik alanlı kayıt

bulunmalıdır.

Beklenen KPI sonuçları manuel olarak onaylanır ve regression testine dönüşür.

## 3. PDF/XLSX testleri

- PDF üretilebiliyor mu?
- Sayfa kırılımları mantıklı mı?
- Tüm personel bölümleri var mı?
- Grafikler boş değil mi?
- Metadata mevcut mu?
- XLSX özet ve detay sayfaları doğru mu?
- Türkçe karakterler korunuyor mu?

Görsel regression kritik baskı sayfalarında uygulanabilir.

## 4. Güvenlik testleri

- Manager Owner route’una erişememeli.
- Manager atanmadığı iş birimini query parametresiyle açamamalı.
- API key response veya logda görünmemeli.
- Export URL’i yetkisiz kullanılamamalı.
- Brute-force sınırı çalışmalı.

## 5. CI kalite kapıları

Her pull request:

- format check
- lint
- typecheck
- unit
- integration
- production build
- migration validation
- browser smoke

Production branch merge edilmeden geçmelidir.

## 6. Canlı doğrulama

Staging deploy sonrası otomatik smoke:

- health endpoint,
- login sayfası,
- database erişimi,
- örnek rapor route’u,
- worker heartbeat.

Gerçek Odoo senkronizasyonu başarısızsa deploy başarısız sayılmayabilir; fakat staging üzerinde açık uyarı üretmelidir.
