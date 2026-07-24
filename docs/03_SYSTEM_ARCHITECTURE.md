# System Architecture

## 1. Mimari stil

Başlangıç mimarisi **modüler monolit + ayrı worker** olacaktır. Bu seçim küçük kullanıcı sayısı, tek teknik Owner ve kontrollü rapor kapsamı için yeterlidir; gereksiz dağıtık sistem yükünü önler.

## 2. Bileşenler

```text
Browser
  │
  ▼
Ertip Report Web/API
  ├── Authentication
  ├── Authorization
  ├── Report execution
  ├── Owner administration
  ├── Export request handling
  └── Audit logging
  │
  ├──────────────► PostgreSQL
  │
  ├──────────────► Redis / Queue
  │                    │
  │                    ▼
  │                 Worker
  │                    ├── Odoo sync
  │                    ├── PDF/XLSX generation
  │                    └── reconciliation
  │
  └────────────────► Odoo API Adapter ──► Odoo Online
```

## 3. Önerilen repository yapısı

```text
apps/
  web/                 Next.js uygulaması
  worker/              senkronizasyon ve export worker
packages/
  db/                  şema, migration ve sorgular
  odoo-client/         sürüme göre API adaptörleri
  reporting/           metrikler, veri kümeleri ve rapor hesapları
  auth/                rol ve kapsam politikaları
  ui/                  ortak tasarım sistemi
  config/              ortak TypeScript, lint ve env şemaları
  observability/       log, metric ve audit yardımcıları
docs/
```

## 4. Ana modüller

### Identity

Kullanıcı, rol, oturum ve parola işlemleri.

### Authorization

Owner/Manager ve iş birimi kapsamının sunucu tarafında uygulanması.

### Odoo Integration

Bağlantı, sürüm tespiti, veri okuma, sayfalama, retry ve rate-control.

### Sync

Artımlı veri çekme, normalizasyon, upsert, mutabakat ve hata kuyruğu.

### Reporting

Merkezi metrik tanımları, filtre doğrulama, sorgu oluşturma ve sonuç sözleşmeleri.

### Export

Yazdırma HTML’i, PDF ve XLSX üretimi.

### Administration

Bağlantı, eşleme, kullanıcı, rapor metadata’sı ve veri kalite ekranları.

### Audit

Kritik yönetim işlemleri, rapor çalıştırmaları ve export kayıtları.

## 5. Veri akışı

1. Worker Odoo’dan değişen kayıtları çeker.
2. Kaynak veri normalleştirilerek PostgreSQL’e yazılır.
3. Gerekli özet veya materialized view yapıları güncellenir.
4. Manager rapor çalıştırdığında doğrulanmış filtreler raporlama katmanına iletilir.
5. Raporlama katmanı yalnızca kullanıcının kapsamındaki yerel veriyi sorgular.
6. Sonuç ekran, PDF veya XLSX sözleşmesine dönüştürülür.

## 6. Teknoloji ilkeleri

- TypeScript strict mode
- Sunucu tarafında şema doğrulama
- SQL sorgularında parametre kullanımı
- Migration tabanlı veritabanı değişiklikleri
- İş mantığının React bileşenlerine gömülmemesi
- Odoo’ya özgü detayların raporlama çekirdeğine sızmaması
- Uzun süren işlerin request lifecycle içinde yapılmaması

## 7. Ölçekleme yolu

Gerektiğinde bağımsızlaştırılabilecek sınırlar:

- sync worker,
- export worker,
- reporting query service,
- object storage.

İlk sürümde bunların ayrı mikroservis olarak dağıtılması zorunlu değildir.
