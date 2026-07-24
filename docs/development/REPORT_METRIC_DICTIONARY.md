# Report Metric Dictionary

**Rapor:** Yurt Dışı Aylık Teklif Performansı

**Sürüm:** `0.1.0-discovery`

**Durum:** Kaynak davranışına göre önerilen kanonik tanımlar hazır; gerçek tenant örnekleriyle onay bekliyor.

## 1. Ortak kapsam

Bir kayıt rapora şu koşullarda adaydır:

1. Model `sale.order`.
2. `company_id`, Yurt Dışı iş birimine eşlenmiş Odoo şirket ID'sidir.
3. Teklif kohort tarihi seçili yerel dönem içindedir.
4. Kayıt ID'si tekil sayılır; satır sayısı teklif sayısını artırmaz.

Dönem sınırları `Europe/Istanbul` saat diliminde yarı açık aralıkla tanımlanır:

```text
[start_of_period, start_of_next_period)
```

Datetime sorguları Odoo'ya gönderilmeden önce UTC'ye dönüştürülür.

## 2. Tarih eksenleri

### `quotation_cohort_at`

Önerilen kaynak: `sale.order.create_date`.

Gerekçe: Odoo 19'da `date_order`, taslak/gönderilmiş teklifte oluşturma zamanını; onaylı kayıtta onay zamanını temsil eder. Bu nedenle `date_order` teklif üretim kohortu için değişmez bir eksen değildir.

İstisna: Canlı tenant'ta iş tarafından kullanılan, güvenilir ve geriye dönük dolu bir Studio “teklif tarihi” alanı bulunursa `create_date` ile kayıt bazında karşılaştırılır ve ayrı ADR ile kabul edilir.

### `confirmation_at`

Birincil aday: `state = sale` olan kayıtlarda `date_order`.

Bu alan gerçek kayıt geçmişiyle doğrulanmadan kesin onay tarihi kabul edilmez. Gerekirse mail tracking veya özel Studio alanı ayrıca değerlendirilir.

### `expires_on`

Kaynak adayı: `validity_date`.

Süresi dolma değerlendirmesi raporun `as_of_date` değerine göre yapılır.

## 3. Durum normalizasyonu

| Normal durum | Önerilen kaynak kuralı | Not |
|---|---|---|
| `realized` / Gerçekleşti | `state = sale` | Siparişe dönüşmüş teklif |
| `open` / Açık | `state in (draft, sent)` ve `validity_date` boş veya `validity_date >= as_of_date` | Açık kayıt gerçekleşmedi sayılmaz |
| `expired` / Süresi doldu | `state in (draft, sent)` ve `validity_date < as_of_date` | Türetilmiş durum |
| `cancelled` / İptal | `state = cancel` | Kaynak iptali |
| `unknown` / Belirsiz | Tanımsız state veya kritik alan eksik | Veri kalitesi uyarısı |

`not_realized` / Gerçekleşmedi sunum metriği:

```text
cancelled + expired
```

Canlı tenant'ta iş sonucunu belirleyen Studio alanı varsa kaynak `state` ile çapraz tablo oluşturulmadan bu eşleme production'a alınmaz.

## 4. KPI tanımları

### `quotation_count`

Seçili kohort ve kapsam içindeki tekil `sale.order.id` sayısı.

### `realized_count`

Kohort içindeki `normalized_status = realized` kayıt sayısı. Teklif sonraki ay siparişe dönüşse bile teklif kohortu ilk oluşturulduğu ayda kalır; güncel durum o kohort satırında gerçekleşti olarak görünür.

### `open_count`

Kohort içindeki `normalized_status = open` kayıt sayısı.

### `not_realized_count`

Kohort içindeki `cancelled + expired` kayıt sayısı.

### `conversion_rate`

```text
realized_count / quotation_count
```

Payda sıfırsa sonuç `null` gösterilir; `0%` gösterilmez.

### `quoted_customer_count`

Seçili kapsam içindeki tekil müşteri sayısı. Gruplama anahtarı canlı doğrulama sonrası `partner_id` veya `commercial_partner_id` olarak sabitlenir.

### `average_resolution_days`

M0'da zorunlu değildir. Güvenilir onay/iptal/sonuç tarihi bulunursa:

```text
resolved_at - quotation_cohort_at
```

olarak hesaplanır. Güvenilir sonuç tarihi yoksa metrik yayımlanmaz.

## 5. Personel ve müşteri kırılımları

- Personel adayı: `sale.order.user_id`.
- Müşteri adayı: `sale.order.partner_id`; kurumsal konsolidasyon için `commercial_partner_id` ayrıca değerlendirilir.
- Boş personel veya müşteri kayıtları sonuçtan düşürülmez; “Atanmamış”/“Belirsiz” grubunda gösterilir.
- Pasif kullanıcıların geçmiş kayıtları korunur.

## 6. Para birimi

- Her kayıt kendi `currency_id` değeriyle saklanır.
- İlk raporun ana KPI'ları adettir.
- USD varsayımı yalnızca açıkça etiketlenmiş özel görünümde kullanılabilir.
- USD ve EUR gibi farklı para birimleri kur dönüşüm kuralı olmadan tek tutarda toplanmaz.

## 7. Versiyonlama ve yürürlük

Bu sözlük gerçek kayıt mutabakatı tamamlanınca `1.0.0` sürümüne yükseltilir. Tarih ekseni, durum veya müşteri gruplanmasını değiştiren kararlar yeni metrik sürümü ve regression fixture güncellemesi gerektirir.
