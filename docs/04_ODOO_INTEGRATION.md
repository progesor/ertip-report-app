# Odoo Integration

## 1. Entegrasyon yaklaşımı

- Odoo Online Custom plan API erişimi kullanılır.
- Canlı tenant sürümü `Odoo 19.0+e` olarak doğrulanmıştır.
- Odoo 19 External JSON-2 API birincil ve kanonik adaptördür.
- Daha eski sürümlerde sürüme uygun RPC adaptörü kullanılabilir.
- Raporlama uygulaması browser’dan Odoo’ya doğrudan bağlanmaz.
- Entegrasyon kullanıcısı mümkün olan en düşük, salt okunur yetkilere sahip olur.

## 2. Bağlantı ayarları

- Base URL
- Database bilgisi, sürümün gerektirdiği durumda
- API key
- Entegrasyon kullanıcı kimliği
- Aktif/pasif
- Son bağlantı testi
- Algılanan Odoo sürümü

API key şifreli veya güvenli secret store üzerinden saklanmalı; loglarda ve hata mesajlarında maskelenmelidir.

JSON-2 istek sözleşmesi `/json/2/<model>/<method>` yolunu, bearer API key’i ve gerektiğinde `X-Odoo-Database` header’ını kullanır. Tenant’a özel model ve yöntemler `/doc` dinamik dokümantasyonundan doğrulanır.

## 3. İlk keşfedilen modeller

Canlı tenant üzerinde şu modellerin gerekli alanları okunabilir olarak doğrulanmıştır:

- `res.company`
- `res.users`
- `res.partner`
- `sale.order`
- `res.currency`

Sonraki senkronizasyon dilimlerinde ayrıca incelenecek modeller:

- `sale.order.line`
- `product.product`
- `product.template`
- yetki varsa `ir.model` ve `ir.model.fields`

Canlı `sale.order.fields_get` sonucu 144 standart alan ve sıfır `x_` / `x_studio_` alan göstermiştir. Standart alan varsayımları yine de alan envanteriyle sürümlenmeye devam eder.

## 4. Kaynak kimliği

Yerel benzersiz anahtar:

```text
connection_id + model_name + odoo_record_id
```

Odoo ID değeri tek başına global kimlik olarak kullanılmaz.

## 5. Çok şirketli bağlam

- Kaynak kayıtların `company_id` alanı saklanır.
- Erişilebilen şirketler entegrasyon kullanıcısının Odoo yetkileriyle sınırlandırılır.
- Uygulama tarafındaki iş birimi eşlemesi `res.company.id` üzerinden yapılır.
- Manager kapsamı her rapor sorgusunda sunucu tarafında uygulanır.

Canlı ve kanonik eşleme:

```text
Yurt Dışı -> res.company.id = 1
Yurt İçi   -> res.company.id = 25
```

Şirket adları birbirine çok yakın olduğundan ad, noktalama veya son ek eşleme anahtarı olarak kullanılmaz. İlk keşifte iki `res.company` kaydı okunmuştur; `sale.order` satır kapsamının iki şirket için ayrı sayımla doğrulanması M2’nin açık maddesidir.

`res.users` taraması görünür kullanıcıları ve onların `company_ids` kapsamını gösterir; bu liste tek başına runtime API key sahibini tanımlamaz. API anahtarı sahibi operasyonel olarak doğrulanıp bağlantı metadata’sına sabitlenmelidir.

## 6. Senkronizasyon stratejisi

### İlk yükleme

- Tarih aralığı kontrollü partiler halinde çekilir.
- Sayfalama kararlı bir sıralamayla yapılır.
- Her parti ayrı checkpoint üretir.

### Artımlı yükleme

- `write_date` ve `id` tabanlı cursor kullanılır.
- Aynı zaman damgasındaki kayıtları kaçırmamak için örtüşmeli pencere uygulanır.
- Upsert işlemleri idempotent olmalıdır.

### Gece mutabakatı

- Son dönemler yeniden taranır.
- Eksik, değişmiş veya silinmiş kayıtlar işaretlenir.
- Rapor sayıları ile kaynak sayıları karşılaştırılır.

## 7. Tarih alanları

Canlı Odoo 19.0+e tenant doğrulaması, `sale.order.date_order` alanının teklif üretim kohortu için değişmez olmadığını kanıtlamıştır.

100 onaylı kayıt örneğinde:

- 55 kaydın `date_order` değeri `create_date` sonrasına taşınmıştır.
- 4 kayıt ay sınırını geçmiştir.
- Maksimum gözlenen fark 147,86 gündür.

Bu nedenle kanonik tarih eksenleri:

```text
teklif oluşturma kohortu = sale.order.create_date
sipariş/onay dönemi       = sale.order.date_order, yalnızca onaylı kayıtlar
```

Aşağıdaki kavramlar birbirine karıştırılmaz:

- kayıt oluşturma zamanı,
- teklif tarihi/kohortu,
- sipariş onay tarihi,
- geçerlilik tarihi,
- son değişiklik zamanı.

Her rapor hangi tarih eksenini kullandığını açıkça belirtir. Dönüşüm analizi için teklif oluşturma kohortu ile sipariş onay dönemi ayrı metriklerdir.

## 8. Durum normalizasyonu

Canlı kaynak seçenekleri:

- `draft`
- `sent`
- `sale`
- `cancel`

Uygulama normalizasyonu:

- Açık
- Gerçekleşti
- Gerçekleşmedi
- İptal
- Süresi doldu
- Belirsiz

Özet eşleme `docs/05_REPORTING_DOMAIN.md` içinde tanımlanır. `validity_date` davranışı ve boş geçerlilik tarihleri canlı kayıt örnekleriyle tamamlanmadan durum sözlüğü kapatılmaz.

## 9. Hata yönetimi

- Timeout ve geçici ağ hatalarında sınırlı exponential backoff
- Yetki hatalarında otomatik sonsuz retry yok
- Hatalı kayıtların dead-letter kaydı
- Owner ekranında hata özeti
- Secret ve kişisel veri içermeyen yapılandırılmış log

Tenant discovery tek çalışmada çok sayıda bağımsız okuma yapabilir. İlk canlı çalışmada iki durum sayımı geçici olarak tamamlanamamıştır. Eksik durum sayımları sınırlı sayıda, sırayla yeniden denenir; başarılı mevcut sonuçlar tekrar sorgulanmaz ve erişim reddi gibi kalıcı hatalar `null/Okunamadı` olarak korunur.

## 10. Salt okunur yöntem politikası

İzin verilen yöntem allowlist’i başlangıçta şunlarla sınırlıdır:

- `fields_get`
- `search`
- `read`
- `search_read`
- `search_count`

`create`, `write`, `unlink`, `action_confirm` ve başka iş eylemleri adaptör yüzeyinde bulunmayacaktır. Salt okunur yetki, gerçek kaydı değiştiren negatif API denemesiyle değil ACL/yetki incelemesiyle doğrulanır.

## 11. Odoo’ya yazma

İlk sürüm salt okunurdur. Odoo üzerinde kayıt oluşturma, güncelleme veya silme fonksiyonları uygulanmayacaktır.

Canlı keşif süreci `docs/development/M0_LIVE_DISCOVERY_RUNBOOK.md`; doğrulanmış M2 bulguları `docs/development/M2_LIVE_TENANT_FINDINGS_2026-07-25.md` ile izlenir.
