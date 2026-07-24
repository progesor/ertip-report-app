# Odoo Integration

## 1. Entegrasyon yaklaşımı

- Odoo Online Custom plan API erişimi kullanılır.
- Odoo sürümü keşif aşamasında kesinleştirilir.
- Odoo 19 ve üzeri için External JSON-2 API tercih edilir.
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

İlk keşif, yalnızca standart alan varsayımlarına dayanmayacaktır. Gerçek tenant üzerindeki `ir.model` ve `ir.model.fields` bilgileri incelenmelidir.

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

## 10. Odoo’ya yazma

İlk sürüm salt okunurdur. Odoo üzerinde kayıt oluşturma, güncelleme veya silme fonksiyonları uygulanmayacaktır.
