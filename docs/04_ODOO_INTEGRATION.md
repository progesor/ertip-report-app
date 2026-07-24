# Odoo Integration

## 1. Entegrasyon yaklaşımı

- Odoo Online Custom plan API erişimi kullanılır.
- Kullanıcı beyan edilen ana sürüm Odoo 19'dur; minor/build sürümü canlı endpoint ile doğrulanacaktır.
- Odoo 19 için External JSON-2 API birincil ve kanonik adaptördür.
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

JSON-2 istek sözleşmesi `/json/2/<model>/<method>` yolunu, bearer API key'i ve gerektiğinde `X-Odoo-Database` header'ını kullanır. Tenant'a özel model ve yöntemler `/doc` dinamik dokümantasyonundan doğrulanır.

## 3. İlk keşfedilecek modeller

- `res.company`
- `res.users`
- `res.partner`
- `sale.order`
- `sale.order.line`
- `product.product`
- `product.template`
- `res.currency`
- gerekli Studio özel alanları

İlk keşif, yalnızca standart alan varsayımlarına dayanmayacaktır. Gerçek tenant üzerindeki `fields_get` sonucu ve yetki varsa `ir.model`/`ir.model.fields` bilgileri incelenmelidir. Studio alanları için tüm `x_`, özellikle `x_studio_` önekleri envantere alınır.

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

Odoo 19 için kritik kaynak davranışı: `sale.order.date_order`, taslak/gönderilmiş kayıtta oluşturma tarihini; onaylanmış `sale` kaydında onay tarihini temsil eder. Bu nedenle aylık teklif üretim kohortu için değişmez tarih olarak kullanılamaz. İlk kanonik aday `create_date` değeridir; varsa iş tarafından kullanılan Studio teklif tarihi canlı kayıtlarla ayrıca karşılaştırılır.

Aşağıdaki kavramlar birbirine karıştırılmaz:

- kayıt oluşturma zamanı,
- teklif tarihi,
- sipariş onay tarihi,
- geçerlilik tarihi,
- son değişiklik zamanı.

Her rapor hangi tarih eksenini kullandığını açıkça belirtir. Dönüşüm analizi için teklif oluşturma kohortu ile sipariş onay dönemi ayrı metriklerdir.

## 8. Durum normalizasyonu

Kaynak durum değerleri uygulamanın rapor durumlarına dönüştürülür:

- Açık
- Gerçekleşti
- Gerçekleşmedi
- İptal
- Süresi doldu
- Belirsiz

Kesin eşleme M0 veri keşfi sonucunda karara bağlanır ve sürümlenmiş metrik tanımında tutulur.

## 9. Hata yönetimi

- Timeout ve geçici ağ hatalarında sınırlı exponential backoff
- Yetki hatalarında otomatik sonsuz retry yok
- Hatalı kayıtların dead-letter kaydı
- Owner ekranında hata özeti
- Secret ve kişisel veri içermeyen yapılandırılmış log

## 10. Salt okunur yöntem politikası

İzin verilen yöntem allowlist'i başlangıçta şunlarla sınırlıdır:

- `fields_get`
- `search`
- `read`
- `search_read`
- `search_count`

`create`, `write`, `unlink`, `action_confirm` ve başka iş eylemleri adaptör yüzeyinde bulunmayacaktır. Salt okunur yetki, gerçek kaydı değiştiren negatif API denemesiyle değil ACL/yetki incelemesiyle doğrulanır.

## 11. Odoo’ya yazma

İlk sürüm salt okunurdur. Odoo üzerinde kayıt oluşturma, güncelleme veya silme fonksiyonları uygulanmayacaktır.

M0 canlı keşif süreci `docs/development/M0_LIVE_DISCOVERY_RUNBOOK.md` ile yürütülür.
