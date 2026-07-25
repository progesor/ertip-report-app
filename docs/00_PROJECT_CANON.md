# Ertip Report App — Project Canon

## 1. Kimlik

- Ürün adı: **Ertip Report App**
- Ürün türü: Odoo bağlantılı özel yönetim raporlama web uygulaması
- Sahip: Er Tıbbi Ürünler Sağlık Hiz. Paz. ve Dış Tic. Ltd. Şti.
- Dağıtım hedefi: Şirketin Coolify sunucusu
- Kaynak yönetimi: Özel GitHub deposu
- Birincil dil: Türkçe
- Canlı kaynak sürümü: **Odoo Online 19.0+e**

## 2. Problem

Odoo Studio ile hazırlanan raporlar, değişken yönetim ihtiyaçlarını karşılamakta zorlanmakta; teknik olmayan yöneticiler rapor oluşturma ve veri modelleme işlemlerini bağımsız yapamamaktadır. Rapor hazırlama yükü tek bir teknik kullanıcı üzerinde kalmaktadır.

## 3. Çözüm

Owner tarafından önceden hazırlanan ve yayımlanan rapor şablonlarını yöneticilerin teknik bilgi gerektirmeden çalıştırabildiği bir portal oluşturulacaktır.

Manager kullanıcısı:

- rapor seçer,
- tarih veya ay seçer,
- izin verilen filtreleri uygular,
- genel/personel/müşteri görünümüne geçer,
- sonucu ekranda inceler,
- PDF, Excel veya yazdırma çıktısı alır.

Owner kullanıcısı:

- Odoo bağlantısını ve şirket eşlemelerini yönetir,
- veri senkronizasyonunu takip eder,
- rapor şablonlarını oluşturur ve yayımlar,
- veri kalitesi sorunlarını inceler,
- kullanıcı ve erişim kapsamlarını yönetir.

## 4. Kapsam ilkeleri

1. Sistem genel amaçlı bir BI ürünü değildir.
2. Personel self-service erişimi yoktur.
3. Yöneticiler rapor mantığını veya formüllerini değiştiremez.
4. Tüm metrikler merkezi ve sürümlenmiş tanımlardan hesaplanır.
5. Aynı metrik farklı ekranlarda farklı sonuç üretmemelidir.
6. Odoo API anahtarı yalnızca sunucu tarafında tutulur.
7. Manager talepleri doğrudan Odoo’ya sınırsız sorgu göndermez.
8. Raporlama için yerel PostgreSQL veri katmanı kullanılır.
9. İlk çalışır sürümden itibaren staging ortamı bulunur.
10. `develop` staging’e, `main` production’a otomatik dağıtılır.
11. Odoo entegrasyonu ilk sürümde kesinlikle salt okunurdur.

## 5. Kullanıcı rolleri

### Owner

Tam teknik ve yönetsel erişim.

### Manager

Yayımlanmış raporlara ve izin verilen iş birimlerine erişim.

İlk sürümde başka rol bulunmayacaktır.

## 6. Organizasyon modeli

Odoo’daki iki şirket uygulamada iş birimi olarak sunulur. 25 Temmuz 2026 canlı tenant keşfiyle kanonik eşleme doğrulanmıştır:

- **Yurt Dışı** → `res.company.id = 1`, kaynak para birimi USD (`res.currency.id = 1`)
- **Yurt İçi** → `res.company.id = 25`, kaynak para birimi TRY (`res.currency.id = 31`)

Uygulama, görünen iş birimi adlarını Odoo `res.company` kayıtlarıyla yalnızca sabit kimlik üzerinden eşler. Şirket adları neredeyse aynı olduğundan ad, noktalama, son ek veya para birimi güvenilir runtime eşleme kuralı değildir.

## 7. İlk rapor

**Yurt Dışı Aylık Teklif Performansı**

Zorunlu görünümler:

- Genel özet
- Personel karşılaştırması
- Seçili personel detayı
- Müşteri özeti
- Teklif detay listesi
- Tüm personel yazdırma/PDF raporu

Kanonik teklif kohortu `sale.order.create_date` alanıdır. `sale.order.date_order`, canlı kayıtlarda onay sonrası değişebildiği ve ay sınırını aşabildiği için teklif üretim ayını belirlemez.

## 8. Arayüz yönü

Arayüz:

- şık,
- profesyonel,
- yönetici sunumuna uygun,
- ölçülü biçimde gösterişli,
- kolay anlaşılır,
- masaüstü öncelikli fakat responsive

olmalıdır.

Görsel yön “Executive Intelligence” olarak tanımlanır: koyu grafit yüzeyler, kaliteli tipografi, kontrollü vurgu renkleri, geniş KPI kartları, güçlü veri hiyerarşisi, ölçülü animasyon ve baskıda temiz görünüm.

## 9. Teknik yön

Önerilen başlangıç:

- TypeScript monorepo
- Next.js tabanlı web ve sunucu katmanı
- PostgreSQL
- Redis ve arka plan worker
- Odoo entegrasyon adaptörü
- HTML tabanlı baskı/PDF üretimi
- Docker/Coolify dağıtımı

Uygulama büyümeden gereksiz mikroservis ayrıştırması yapılmaz.

## 10. Kalite kapıları

Production’a giden her değişiklik en az şu kontrollerden geçmelidir:

- format
- lint
- typecheck
- unit test
- integration test
- production build
- kritik rapor hesaplama testleri
- temel browser smoke testi

## 11. Kapsam dışı

İlk aşamada kapsam dışıdır:

- personele hesap açılması,
- genel amaçlı sürükle-bırak BI editörü,
- mobil uygulama,
- Odoo’ya veri yazma,
- yapay zekâ ile serbest SQL çalıştırma,
- finansal muhasebe raporlarının ilk sürüme eklenmesi,
- tam çok kiracılı SaaS mimarisi.
