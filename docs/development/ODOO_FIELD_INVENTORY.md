# Odoo Field Inventory

**Durum:** Kaynak kod ve Odoo 19 dokümantasyonu üzerinden başlangıç envanteri hazırlandı. Canlı tenant doğrulaması bekleniyor.

**Tarih:** 24 Temmuz 2026

## 1. Doğrulama seviyeleri

- `source-baseline`: Odoo 19 resmî kaynak/dokümantasyonunda bulunan standart alan.
- `tenant-confirmed`: Ertip Odoo tenant'ında `fields_get` veya model metadata sorgusuyla doğrulanmış alan.
- `business-confirmed`: Alanın Ertip rapor anlamı gerçek kayıt örnekleriyle onaylanmış.
- `pending`: Canlı bağlantı olmadan doğrulanamayan bilgi.

Bu belgede canlı doğrulama yapılmadığı sürece hiçbir alan `tenant-confirmed` veya `business-confirmed` kabul edilmez.

## 2. Odoo 19 entegrasyon yüzeyi

Birincil adaptör External JSON-2 API'dir:

```text
POST /json/2/<model>/<method>
Authorization: bearer <runtime-secret>
X-Odoo-Database: <runtime-value, gerekiyorsa>
Content-Type: application/json
```

Model ve alan keşfi için yalnızca okuma yöntemleri kullanılacaktır:

- `fields_get`
- `search`
- `read`
- `search_read`
- `search_count`

`create`, `write`, `unlink`, `action_confirm` ve başka iş eylemleri entegrasyon istemcisinde yasak olacaktır.

## 3. Model envanteri

### `res.company`

| Alan | Beklenen tip | Kullanım | Durum |
|---|---|---|---|
| `id` | integer | Sabit Odoo şirket kimliği | source-baseline |
| `name` | char | Kaynak görünen adı | source-baseline |
| `active` | boolean | Aktif/pasif durumu | source-baseline |
| `parent_id` | many2one | Şube/üst şirket ilişkisi | source-baseline |
| `currency_id` | many2one | Şirket para birimi | source-baseline |
| `partner_id` | many2one | Şirketin partner kaydı | source-baseline |
| `write_date` | datetime | Artımlı senkronizasyon | source-baseline |

Canlı doğrulama: `id`, `name`, `active`, `parent_id`, `currency_id` alanları okunmalı; erişilebilen şirket sayısı ve entegrasyon kullanıcısının şirket kapsamı kaydedilmelidir.

### `sale.order`

| Alan | Beklenen tip | Rapor anlamı | Durum |
|---|---|---|---|
| `id` | integer | Kayıt bazlı mutabakat anahtarı | source-baseline |
| `name` | char | Teklif/sipariş numarası | source-baseline |
| `company_id` | many2one | İş birimi eşlemesi | source-baseline |
| `partner_id` | many2one | Müşteri | source-baseline |
| `user_id` | many2one | Satış personeli | source-baseline |
| `state` | selection | Kaynak durum | source-baseline |
| `create_date` | datetime | Teklif kayıt kohortu için birincil aday | source-baseline |
| `date_order` | datetime | Taslakta oluşturma, onaylı kayıtta onay tarihi davranışı | source-baseline |
| `validity_date` | date | Süresi dolma değerlendirmesi | source-baseline |
| `write_date` | datetime | Artımlı sync ve değişiklik izi | source-baseline |
| `currency_id` | many2one | Gerçek kayıt para birimi | source-baseline |
| `amount_untaxed` | monetary | Vergisiz tutar | source-baseline |
| `amount_tax` | monetary | Vergi tutarı | source-baseline |
| `amount_total` | monetary | Toplam tutar | source-baseline |
| `order_line` | one2many | Satır ilişkisi | source-baseline |

Odoo 19 standart durum adayları:

- `draft`: Quotation
- `sent`: Quotation Sent
- `sale`: Sales Order
- `cancel`: Cancelled

Canlı tenant'ta seçim listesi `fields_get` ile tekrar alınmalıdır; Studio veya ek modül genişletmesi olabileceği varsayılmalıdır.

### `sale.order.line`

| Alan | Beklenen tip | Kullanım | Durum |
|---|---|---|---|
| `id` | integer | Satır kimliği | source-baseline |
| `order_id` | many2one | Üst teklif/sipariş | source-baseline |
| `company_id` | many2one | Şirket kapsamı | source-baseline |
| `currency_id` | many2one | Satır para birimi | source-baseline |
| `order_partner_id` | many2one | Müşteri | source-baseline |
| `salesman_id` | many2one | Satış personeli | source-baseline |
| `state` | selection | Üst kayıt durumu | source-baseline |
| `display_type` | selection | Bölüm/not satırlarını ayırma | source-baseline |
| `product_id` | many2one | Ürün | source-baseline |
| `product_uom_qty` | float | Miktar | source-baseline |
| `price_unit` | float | Birim fiyat | source-baseline |
| `discount` | float | İskonto | source-baseline |
| `price_subtotal` | monetary | Ara toplam | source-baseline |
| `price_tax` | monetary | Vergi | source-baseline |
| `price_total` | monetary | Satır toplamı | source-baseline |
| `write_date` | datetime | Artımlı sync | source-baseline |

`display_type` dolu bölüm/not satırları ürün ve tutar analizlerinden dışlanmalıdır.

### `res.partner`

Canlı doğrulanacak asgari alanlar:

- `id`
- `name`
- `active`
- `is_company`
- `company_id`
- `commercial_partner_id`
- `country_id`
- `user_id`
- `create_date`
- `write_date`

Müşteri gruplanmasında `partner_id` ile `commercial_partner_id` davranışı örnek kayıtlarla karşılaştırılmalıdır.

### `res.users`

Canlı doğrulanacak asgari alanlar:

- `id`
- `name`
- `active`
- `company_id`
- `company_ids`
- `partner_id`
- `share`
- `write_date`

Personel raporunda kullanıcı hesabı kapalı olsa bile geçmiş tekliflerin kaybolmaması gerekir.

### `res.currency`

Canlı doğrulanacak asgari alanlar:

- `id`
- `name`
- `symbol`
- `position`
- `decimal_places`
- `active`
- `write_date`

İlk raporda adet metrikleri önceliklidir. Farklı para birimleri kur kuralı olmadan tek tutarda toplanmayacaktır.

## 4. Studio ve özel alan keşfi

Özel alan envanteri iki kaynaktan çıkarılacaktır:

1. Her hedef model için `fields_get` sonucu.
2. Yetki varsa `ir.model.fields` üzerinde hedef modeller ve `name` öneki `x_`/`x_studio_` sorgusu.

Her özel alan için kaydedilecek metadata:

- model
- teknik ad
- görünen ad
- tip
- ilişki modeli
- selection değerleri
- required/readonly/store bilgisi
- örnek doluluk oranı
- raporda kullanılıp kullanılmadığı
- iş anlamı sahibi ve onay tarihi

Property alanları standart kolon gibi varsayılmamalı; Studio alanlarıyla property alanları ayrı sınıflandırılmalıdır.

## 5. Canlı doğrulama bekleyen kritik sorular

1. Teklif personeli gerçekten `sale.order.user_id` mi, yoksa Studio alanı mı?
2. Müşteri gruplaması `partner_id` mi, `commercial_partner_id` mi?
3. İş sonucu için `state` dışında özel bir kayıp/sonuç alanı var mı?
4. `validity_date` düzenli ve güvenilir biçimde dolduruluyor mu?
5. Teklif tarihi için iş tarafından kullanılan özel bir alan var mı?
6. İki şirket aynı kullanıcı, partner ve ürün kayıtlarını hangi kapsamda paylaşıyor?
7. Entegrasyon kullanıcısı iki şirketi de salt okunur görebiliyor mu?
