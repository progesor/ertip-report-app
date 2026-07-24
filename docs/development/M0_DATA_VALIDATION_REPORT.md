# M0 Data Validation Report

**Tarih:** 24 Temmuz 2026

**Durum:** Kısmi tamamlandı; canlı Odoo erişim metadata'sı ve runtime secret olmadan tenant sorguları çalıştırılmadı.

## 1. Doğrulanan bilgiler

- Kaynak ürün: Odoo Online Custom plan.
- Kullanıcı beyan edilen ana sürüm: Odoo 19.
- Odoo 19 için tercih edilen dış entegrasyon: External JSON-2 API.
- JSON-2 erişim modeli: `/json/2/<model>/<method>`, bearer API key ve gerektiğinde `X-Odoo-Database` header'ı.
- Studio özel alanlarının varsayılan teknik öneki `x_studio_`; tüm `x_` alanları keşif envanterine alınmalıdır.
- Odoo 19 standart `sale.order.state` değerleri: `draft`, `sent`, `sale`, `cancel`.
- Odoo 19 `sale.order.date_order` alanı sabit teklif oluşturma tarihi değildir: taslak/gönderilmiş kayıtta oluşturma, onaylı kayıtta onay tarihi semantiği taşır.

## 2. Henüz doğrulanamayan canlı bilgiler

- Base URL ve database adı.
- Odoo minor/build sürümü ve JSON-2 endpoint'inin tenant üzerinde yanıtı.
- Entegrasyon kullanıcısının iki şirkete erişimi ve gerçekten salt okunur ACL'i.
- `res.company` ID ve adları.
- Studio alanlarının teknik adları ve dolulukları.
- Personel, müşteri, sonuç ve teklif tarihi için fiilen kullanılan alanlar.
- Tutarsız çıkan kesin ay ve iki eski raporun kayıt ID listeleri.
- Gerçek kayıt örnekleri ve manuel KPI tablosu.

## 3. Önemli risk: tarih alanı kayması

Aynı `sale.order` kaydı teklifken `date_order` ile bir ayda, siparişe dönüştükten sonra başka bir ayda görünebilir. Eski raporlardan biri `create_date`, diğeri `date_order` kullanıyorsa veya aynı rapor farklı zamanlarda çalıştırıldıysa aylık toplamlar değişebilir.

Kanonik öneri:

- Teklif üretim kohortu: `create_date`.
- Güncel sonuç: normalize edilmiş mevcut durum.
- Siparişe dönüşüm dönemi: ayrıca `confirmation_at` ekseni.

Bu öneri canlı kayıtlarla test edilmeden final kabul edilmez.

## 4. Kayıt bazlı mutabakat yöntemi

### 4.1 Girdi sözleşmesi

Aynı dönem ve şirket kapsamı için iki sonuç kümesi hazırlanır:

- `source_a`: eski/Studio raporu veya Odoo ekran dışa aktarımı.
- `source_b`: yeni kanonik sorgu adayı.

Her satırda en az şu alanlar bulunur:

- `id`
- `name`
- `company_id`
- `user_id`
- `partner_id`
- `state`
- `create_date`
- `date_order`
- `validity_date`
- `write_date`
- `currency_id`
- `amount_total`

Her çıktı için ayrıca sorgu zamanı, saat dilimi, kullanılan tarih alanı, domain ve durum filtresi kaydedilir.

### 4.2 Küme karşılaştırması

Tekil anahtar `sale.order.id` olmalıdır.

```text
only_in_a = ids(source_a) - ids(source_b)
only_in_b = ids(source_b) - ids(source_a)
in_both   = ids(source_a) ∩ ids(source_b)
```

`in_both` kayıtlarında alan farkları ayrıca çıkarılır. Teklif satırları üzerinden join yapılıyorsa aynı sipariş ID'sinin çoğalması kontrol edilir.

### 4.3 Fark nedenleri sınıflandırması

Her farklı kayıt tek bir birincil, gerekirse birden fazla ikincil nedene atanır:

1. `company_scope_mismatch`
2. `date_axis_create_vs_order`
3. `timezone_boundary`
4. `state_filter_mismatch`
5. `expired_rule_mismatch`
6. `salesperson_filter_mismatch`
7. `customer_grouping_mismatch`
8. `line_join_duplicate`
9. `late_source_update`
10. `missing_or_custom_field`
11. `unknown`

### 4.4 Zaman dilimi kontrolü

Ay sınırı Türkiye yerel saatiyle belirlenir. Örneğin Temmuz dönemi:

```text
2026-07-01 00:00:00 Europe/Istanbul
2026-08-01 00:00:00 Europe/Istanbul
```

Odoo datetime domain'ine gönderilirken UTC'ye çevrilir ve üst sınır dahil edilmez.

### 4.5 Manuel beklenen KPI tablosu

Mutabakat sonunda aşağıdaki tablo kayıt ID listelerinden elle onaylanır:

| KPI | Beklenen | Kayıt ID'leri | Not |
|---|---:|---|---|
| Toplam teklif | Bekleniyor | Bekleniyor | `create_date` kohortu |
| Gerçekleşti | Bekleniyor | Bekleniyor | `state = sale` adayı |
| Açık | Bekleniyor | Bekleniyor | draft/sent ve geçerli |
| İptal | Bekleniyor | Bekleniyor | cancel |
| Süresi doldu | Bekleniyor | Bekleniyor | türetilmiş |
| Gerçekleşmedi | Bekleniyor | Bekleniyor | iptal + süresi doldu |

## 5. M0 çıkış kararı

M0 henüz kapanmamıştır. Aşağıdakiler tamamlanmadan uygulama koduna geçilmemelidir:

1. Canlı version/API testi.
2. İki şirket ID eşlemesi.
3. Alan ve Studio envanteri.
4. En az sekiz örnek kayıt sınıfı.
5. Tutarsız ayın ID bazlı mutabakatı.
6. Owner onaylı metrik sözlüğü ve golden fixture.
